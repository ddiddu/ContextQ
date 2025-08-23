function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function onOpen() {
  SlidesApp.getUi()
    .createMenu('AI')
    .addItem('Generate Comments', 'menuItem1')
    .addItem('Show Card', 'menuItem2')
    .addItem('Save Settings', 'showSettings') // new
    .addToUi();
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Material Test')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function menuItem1() {
  const template = HtmlService.createTemplateFromFile('index');
  const html = template.evaluate().setTitle('Let’s help you prepare for presentation.');
  SlidesApp.getUi().showSidebar(html);
}

function menuItem2() {
  const template = HtmlService.createTemplateFromFile('cardView');
  const html = template.evaluate().setTitle('Card UI Preview');
  SlidesApp.getUi().showSidebar(html);
}

function showSettings() {
  const template = HtmlService.createTemplateFromFile('settings');
  const html = template.evaluate().setTitle('Settings');
  SlidesApp.getUi().showSidebar(html);
}

function getApiKeyStatus() {
  const userProperties = PropertiesService.getUserProperties();
  const apiKey = userProperties.getProperty('API_KEY');
  
  return {
    hasKey: !!apiKey, // Check if the key exists
    masked: apiKey ? apiKey.replace(/.(?=.{4})/g, '*') : null // Mask all but the last 4 characters
  };
}

// function saveApiKey(key) {
//   PropertiesService.getUserProperties().setProperty('API_KEY', key);
// }

// function getApiKey() {
//   const apiKey = PropertiesService.getUserProperties().getProperty('API_KEY');
//   if (!apiKey) {
//     throw new Error("API Key not found. Please save it using the Save Settings option.");
//   }
//   return apiKey;
// }

function saveApiKey(apiKey) {
  // Save the API key to the user's properties or another storage
  PropertiesService.getUserProperties().setProperty('API_KEY', apiKey);
  return "API Key saved successfully!";
}
function getApiKey() {
  const apiKey = PropertiesService.getUserProperties().getProperty('API_KEY');
  if (!apiKey) {
    throw new Error("API Key not found. Please save it using the Save Settings option.");
  }
  return apiKey;
}

function getSlideContent() {
  const slides = SlidesApp.getActivePresentation().getSlides();
  const endIndex = Math.min(4, slides.length - 1); // Adjust range as needed

  const structuredSlides = [];

  for (let i = 0; i <= endIndex; i++) {
    const slide = slides[i];
    const shapes = slide.getShapes();

    const textItems = shapes
      .filter(shape => shape.getText && typeof shape.getText === "function")
      .map(shape => shape.getText().asString().trim())
      .filter(text => text !== "");

    const speakerNotesObj = slide.getNotesPage().getSpeakerNotesShape();
    let speakerNotes = "";
    if (speakerNotesObj && speakerNotesObj.getText) {
      speakerNotes = speakerNotesObj.getText().asString().trim();
    }

    structuredSlides.push({
      slide: i + 1,
      content: textItems.join('\n'),
      notes: speakerNotes || null
    });
  }

  Logger.log("Structured slide content with notes:\n" + JSON.stringify(structuredSlides, null, 2));
  return structuredSlides;
}

function getTypeDefinitions() {
  const content = HtmlService.createHtmlOutputFromFile('promptType').getContent();
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error("❌ Failed to parse promptType.html as JSON: " + e.message);
  }
}

const rawPromptTemplate = HtmlService.createHtmlOutputFromFile('prompt').getContent();
const typeDefinitions = getTypeDefinitions();

function fillPromptTemplate(template, replacements) {
  const toneMap = {
    "very positive": "very optimistic",
    "positive": "optimistic"
  };
  const mappedTone = toneMap[replacements.selectedTone] || replacements.selectedTone;

  return template
    .replaceAll('${fullText}', replacements.fullText)
    .replaceAll('${context}', replacements.context.context)
    // .replaceAll('${selectedTone}', replacements.selectedTone)
    .replaceAll('${selectedTone}', mappedTone)
    .replaceAll('${type}', replacements.type)
    .replaceAll('${typeDefinition}', replacements.typeDefinition);
}

function generateComments(selectedContexts, selectedTone = "neutral", selectedType = "all", debugging = false) {
  Logger.log("generateComments function called with contexts: " + JSON.stringify(selectedContexts));
  Logger.log("Selected tone: " + selectedTone);
  Logger.log("Selected type: " + selectedType);

  if (debugging) {
    const sampleComments = [{
      questions: [{
        slide: 1,
        text: "Sample text from slide 1",
        question: "What is the main point of this slide?",
        reason: "The slide content is vague and could benefit from clarification.",
        type: "reflective",
        tone: "neutral",
        assistanceLevel: "low"
      }]
    }];
    return sampleComments;
  }

  if (!Array.isArray(selectedContexts) || selectedContexts.length === 0) {
    Logger.log("Error: selectedContexts is not a valid array or is empty.");
    return [];
  }

  const slideContent = getSlideContent(); // [{slide: 1, content: "..."}]
  // const fullText = slideContent.map(s => `Slide ${s.slide}:\n${s.content}`).join("\n\n");

  const fullText = slideContent.map(s => {
    const contentPart = `Slide ${s.slide} (Visible Text):\n${s.content}`;
    const notesPart = s.notes ? `Slide ${s.slide} (Speaker Notes):\n${s.notes}` : '';
    return [contentPart, notesPart].filter(Boolean).join("\n\n");
  }).join("\n\n");

  const rawPromptTemplate = HtmlService.createHtmlOutputFromFile('prompt').getContent();

  const allQuestions = selectedContexts.map(context => {
    const typesToGenerate = selectedType === "all"
      ? ["reflective", "feedback"]
      : [selectedType === "low" ? "reflective" : "feedback"];

    const questionsByType = [];

    for (const type of typesToGenerate) {
      try {
        const prompt = fillPromptTemplate(rawPromptTemplate, {
          fullText,
          context,
          selectedTone,
          type,
          typeDefinition: typeDefinitions[type] || ""
        });

        Logger.log("Generated prompt for type '" + type + "':\n" + prompt);

        const payload = {
          // model: "gpt-4.1-mini",
          model: "gpt-4.1",
          messages: [{ role: "user", content: prompt }]
        };

        const options = {
          method: 'post',
          contentType: 'application/json',
          headers: {
            'Authorization': `Bearer ${getApiKey()}`
          },
          payload: JSON.stringify(payload),
          muteHttpExceptions: true
        };

        const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', options);
        const responseText = response.getContentText();

        Logger.log("Raw API response:\n" + responseText);

        let responseJson;
        try {
          responseJson = JSON.parse(responseText);
        } catch (e) {
          throw new Error("❌ Failed to parse API response as JSON:\n" + responseText);
        }

        if (!responseJson.choices || !Array.isArray(responseJson.choices) || responseJson.choices.length === 0) {
          if (responseJson.error) {
            throw new Error("❌ OpenAI API error: " + JSON.stringify(responseJson.error));
          } else {
            throw new Error("❌ API response missing 'choices':\n" + responseText);
          }
        }

        const content = responseJson.choices[0].message.content;
        Logger.log("✅ Parsed model output:\n" + content);

        let outputs;
        try {
          outputs = JSON.parse(content.trim());
        } catch (e) {
          Logger.log("❌ Failed to parse model output as JSON:\n" + content);
          throw new Error("Failed to parse model output: " + e.message);
        }

        const formatted = outputs.map(o => ({
          slide: o.slide,
          question: o.output,
          reason: o.reason || null,
          type: type,
          tone: selectedTone,
          assistanceLevel: type === "reflective" ? "low" : "high"
        }));

        questionsByType.push(...formatted);

      } catch (e) {
        Logger.log(`❌ Error generating ${type} outputs: ` + e.message);
      }
    }

    return {
      questions: questionsByType
    };
  });

  return allQuestions;
}