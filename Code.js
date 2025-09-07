function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function onOpen() {
  SlidesApp.getUi()
    .createMenu('Comments')
    .addItem('Generate Comments', 'menuItem1')
    // .addItem('Show Card', 'menuItem2') // debugging
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
  const html = template.evaluate().setTitle('AI Comments');
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

// === NEW: 슬라이드 썸네일 뽑기 (PNG, base64) ===
function getSlideThumbnails(limit = 12, size = 'LARGE') {
  const presId = SlidesApp.getActivePresentation().getId();
  const slides = SlidesApp.getActivePresentation().getSlides();
  const thumbs = [];

  const n = Math.min(limit, slides.length); // 과금/지연 방지: 최대 limit장
  for (let i = 0; i < n; i++) {
    const slide = slides[i];
    const pageId = slide.getObjectId();

    const res = Slides.Presentations.Pages.getThumbnail(
      presId,
      pageId,
      {
        "thumbnailProperties.mimeType": "PNG",
        "thumbnailProperties.thumbnailSize": "LARGE" // SMALL | MEDIUM | LARGE
      }
    );
    
    const url = res.contentUrl;                         // signed URL
    const blob = UrlFetchApp.fetch(url).getBlob();      // PNG
    const b64  = Utilities.base64Encode(blob.getBytes());
    thumbs.push({ slide: i + 1, dataUrl: 'data:image/png;base64,' + b64 });
  }

  return thumbs; // [{slide, dataUrl}]
}

// === NEW: 텍스트 + 이미지 동시 전송 ===
function callVisionLLM(fullText, thumbs, tone, type, context) {
  const prompt = fillPromptTemplate(rawPromptUser, {
    fullText,
    context,
    selectedTone: tone,
    type,
    typeDefinition: (typeof typeDefinitions !== 'undefined' ? typeDefinitions[type] : '') || ""
  });

  const sample = thumbs.slice(0, 6); // 과금/지연 대비

  const promptUser = [
    { type: "text", text: prompt },
    ...sample.map(t => ({
      type: "image_url",
      image_url: { url: t.dataUrl } // data:image/png;base64,.... OK
    }))
  ];

  const payload = {
    model: "gpt-4.1", // 비전 지원
    messages: [{ role: "system", content: rawPromptSystem }, { role: "user", content: JSON.stringify(promptUser) }]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: { 'Authorization': `Bearer ${getApiKey()}` },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', options);
  const json = JSON.parse(response.getContentText());
  if (!json.choices?.length) {
    if (json.error) throw new Error("OpenAI error: " + JSON.stringify(json.error));
    throw new Error("No choices in response: " + response.getContentText());
  }

  const output = json.choices[0].message.content;
  Logger.log("LLM Response: " + output); // Log the LLM response

  return output; // prompt.html이 JSON 배열만 반환하도록 강제
}

function getTypeDefinitions() {
  const content = HtmlService.createHtmlOutputFromFile('promptType').getContent();
  try {
    return JSON.parse(content);
  } catch (e) {
    throw new Error("❌ Failed to parse promptType.html as JSON: " + e.message);
  }
}

const rawPromptUser = HtmlService.createHtmlOutputFromFile('promptUser').getContent();
const rawPromptSystem = HtmlService.createHtmlOutputFromFile('promptSystem').getContent();
const typeDefinitions = getTypeDefinitions();

function fillPromptTemplate(template, replacements) {
  const toneMap = {
    "very positive": "very optimistic",
    "positive": "optimistic",
    // "very critical": "very harsh",
    // "critical": "harsh",
  };
  const mappedTone = toneMap[replacements.selectedTone] || replacements.selectedTone;

  return template
    .replaceAll('${fullText}', replacements.fullText)
    .replaceAll('${context}', typeof replacements.context === 'object' ? replacements.context.context : replacements.context)
    .replaceAll('${selectedTone}', mappedTone)
    .replaceAll('${type}', replacements.type)
    .replaceAll('${typeDefinition}', replacements.typeDefinition);
}

// === REPLACE: 기존 generateComments 전체 교체 ===
function generateComments(selectedContexts, selectedTone = "neutral", selectedType = "all", debugging = false) {
  Logger.log("generateComments called with: " + JSON.stringify({ selectedContexts, selectedTone, selectedType }));

  if (debugging) {
    return [{
      questions: [{
        slide: 1,
        text: "debug",
        question: "What is the main point of this slide?",
        reason: "debug",
        type: "reflective",
        tone: "neutral",
        assistanceLevel: "low"
      }]
    }];
  }

  if (!Array.isArray(selectedContexts) || selectedContexts.length === 0) {
    Logger.log("Error: selectedContexts invalid/empty");
    return [];
  }

  // 1) 텍스트/노트 수집 (기존)
  const slideContent = getSlideContent();
  const fullText = slideContent.map(s => {
    const contentPart = `Slide ${s.slide} (Visible Text):\n${s.content}`;
    const notesPart   = s.notes ? `Slide ${s.slide} (Speaker Notes):\n${s.notes}` : '';
    return [contentPart, notesPart].filter(Boolean).join("\n\n");
  }).join("\n\n");

  // 2) 이미지 썸네일 수집 (NEW)
  const thumbs = getSlideThumbnails(12, 'LARGE'); // 필요시 limit 조정

  const allQuestions = selectedContexts.map(context => {
    const contextString = typeof context === 'object' ? context.context : context;

    const typesToGenerate = selectedType === "all"
      ? ["reflective", "feedback"]
      : [selectedType === "low" ? "reflective" : "feedback"];

    const questionsByType = [];

    for (const type of typesToGenerate) {
      try {
        let content;

        // ✅ 텍스트+이미지 동시 경로
        content = callVisionLLM(fullText, thumbs, selectedTone, type, contextString); // Pass contextString here

        // 공통 파싱 (prompt.html: JSON 배열만)
        const outputs = JSON.parse(content.trim());
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

    return { questions: questionsByType };
  });

  return allQuestions;
}

function logToggleExplanation(id, newState) {
  Logger.log(`Explanation toggled for ID: ${id}, New State: ${newState}`);
}

function logThumbToggle(id, direction, isActive) {
  Logger.log(`Thumb toggled: ID: ${id}, Direction: ${direction}, Active: ${isActive}`);
}

function logCardSelection(id, isSelected, allowMultiple) {
  Logger.log(`Card toggled: ID: ${id}, Selected: ${isSelected}`);
}

function logFilterAction(tone, type, context) {
  Logger.log(`Filter applied: Tone: ${tone}, Type: ${type}, Context: ${context}`);
}