function onOpen() {
  var ui = SlidesApp.getUi();
  ui.createMenu('ContextQ')
      .addItem('Context', 'menuItem1')
      .addItem('Questions', 'menuItem2')
      .addItem('Chat', 'menuItem3')
      .addToUi();
}

function menuItem1() {
  const template = HtmlService.createTemplateFromFile('Sidebar');
  const html = template.evaluate().setTitle('AI Comments');
  SlidesApp.getUi().showSidebar(html);
}

function menuItem2() {
}

function menuItem3() {
  const template = HtmlService.createTemplateFromFile('Sidebar');
  const html = template.evaluate().setTitle('Chat with AI');
  SlidesApp.getUi().showSidebar(html);
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

function saveContextData(context) {
  // You can log it, store in PropertiesService, or associate with slide notes
  Logger.log("Saved context: " + JSON.stringify(context));
}

function getSlideContent() {
  const slides = SlidesApp.getActivePresentation().getSlides();
  let targetIndex = 1; // Slide 2 (0-based index)

  if (targetIndex >= slides.length) {
    Logger.log("Slide index out of bounds. Total slides: " + slides.length);
    return "Slide 6 does not exist.";
  }

  const slide = slides[targetIndex];
  const shapes = slide.getShapes();

  if (!shapes || shapes.length === 0) {
    Logger.log("No shapes found on the slide.");
    return "No shapes found on the slide.";
  }

  const textBoxes = shapes.filter(shape => shape.getShapeType() === SlidesApp.ShapeType.TEXT_BOX);
  if (textBoxes.length === 0) {
    Logger.log("No text boxes found on the slide.");
    return "No text boxes found on the slide.";
  }

  let text = textBoxes
    .map(shape => shape.getText().asString())
    .join('\n');

  Logger.log("Extracted text: " + text);
  return `Slide 6:\n${text}`;
}

function generateComments(selectedContexts) {
  Logger.log("generateComments function called with contexts: " + JSON.stringify(selectedContexts));

  if (!Array.isArray(selectedContexts) || selectedContexts.length === 0) {
    Logger.log("Error: selectedContexts is not a valid array or is empty.");
    return [];
  }

  const slideContent = getSlideContent();
  Logger.log("Slide content: " + slideContent);

  const allQuestions = selectedContexts.map(context => {
    Logger.log("Processing context: " + JSON.stringify(context));
    const content = `Persona: ${context.title}\nPurpose: ${context.purpose}\nAudience: ${context.audience}\nInstructions: ${context.instructions}\nGuardrails: ${context.guardrails}\nExamples: ${context.examples}\nSlide Content: ${slideContent}`;

    const payload = {
      model: "gpt-4o-mini-2024-07-18",
      messages: [
        {
          role: "system",
          content: "You are an assistant helping generate insightful and meaningful questions based on AI personas. Use the entire slide content to generate questions. Tailor the questions to the persona's purpose, audience, and instructions. Avoid redundancy and ensure each question provides unique value. For each question, return ONLY a JSON array of objects. Each object must have three keys: `text`, `question`, and `AI persona`. The `text` field must contain only the specific part of the slide content that the question refers to. Do not add explanations, markdown, or any extra text."
        },
        {
          role: "user",
          content: `Generate questions based on the following AI persona and its associated slide content:\n\n${content}`
        }
      ]
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

    try {
      const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', options);
      const json = JSON.parse(response.getContentText());
      Logger.log("API response: " + JSON.stringify(json));

      const questions = JSON.parse(json.choices[0].message.content);
      Logger.log(`Generated questions for persona "${context.title}": ` + JSON.stringify(questions));

      // Limit to 3 questions per persona
      return {
        persona: context.title,
        questions: questions.slice(0, 3) // Limit to 3 questions
      };
    } catch (e) {
      Logger.log(`Error generating questions for persona "${context.title}": ` + e.message);
      return {
        persona: context.title,
        questions: []
      };
    }
  });

  Logger.log("All questions: " + JSON.stringify(allQuestions));
  return allQuestions;
}

function saveGeneratedQuestions(personaTitle, questions, timestamp) {
  const userProperties = PropertiesService.getUserProperties();
  const existingData = userProperties.getProperty('generatedQuestions');
  const allData = existingData ? JSON.parse(existingData) : [];

  // Check if the persona with the same timestamp already exists
  const isDuplicate = allData.some(item => item.persona === personaTitle && item.timestamp === timestamp);

  if (!isDuplicate) {
    // Append the new data for the persona
    allData.push({
      persona: personaTitle,
      questions: questions,
      timestamp: timestamp
    });

    // Save the updated data back to user properties
    userProperties.setProperty('generatedQuestions', JSON.stringify(allData));
  } else {
    Logger.log(`Duplicate entry detected for persona "${personaTitle}" with timestamp "${timestamp}".`);
  }

  return true; // Indicate success
}

function getSavedQuestions() {
  const userProperties = PropertiesService.getUserProperties();
  const savedData = userProperties.getProperty('generatedQuestions');
  if (savedData) {
    const allData = JSON.parse(savedData);
    Logger.log("Retrieved saved questions: " + JSON.stringify(allData));
    return allData;
  } else {
    Logger.log("No saved questions found.");
    return [];
  }
}

function getAllTimestamps() {
  const userProperties = PropertiesService.getUserProperties();
  const savedData = userProperties.getProperty('generatedQuestions');
  if (!savedData) {
    return [];
  }

  const allData = JSON.parse(savedData);
  const timestamps = allData.map(item => item.timestamp);
  Logger.log("All timestamps: " + JSON.stringify(timestamps));
  return timestamps;
}

function getFilteredQuestionsByPersonaAndVersion(selectedPersona, selectedVersion) {
  const userProperties = PropertiesService.getUserProperties();
  const savedData = userProperties.getProperty('generatedQuestions');
  if (!savedData) {
    return [];
  }

  const allData = JSON.parse(savedData);

  // Filter by persona and version
  const filteredData = allData.filter(item => {
    const matchesPersona = selectedPersona === 'all' || item.persona === selectedPersona;
    const matchesVersion = selectedVersion === 'all' || item.timestamp === selectedVersion;
    return matchesPersona && matchesVersion;
  });

  Logger.log(`Filtered Data: ${JSON.stringify(filteredData)}`);
  return filteredData;
}

function deleteQuestion(persona, timestamp, questionText) {
  const userProperties = PropertiesService.getUserProperties();
  const savedData = userProperties.getProperty('generatedQuestions');
  if (!savedData) {
    return false; // No data to delete
  }

  const allData = JSON.parse(savedData);

  // Find the persona and timestamp, then remove the specific question
  const updatedData = allData.map(item => {
    if (item.persona === persona && item.timestamp === timestamp) {
      item.questions = item.questions.filter(q => q.question !== questionText);
    }
    return item;
  }).filter(item => item.questions.length > 0); // Remove empty personas

  // Save the updated data
  userProperties.setProperty('generatedQuestions', JSON.stringify(updatedData));
  Logger.log("Updated questions after deletion: " + JSON.stringify(updatedData));
  return true;
}

function sendChatMessage(message) {
  const apiKey = getApiKey(); // Retrieve the saved API key
  const model = 'gpt-4o-mini-2024-07-18'; // Use the selected model

  const payload = {
    model: model,
    messages: [
      { role: 'system', content: 'You are an assistant helping with slide-related queries.' },
      { role: 'user', content: message }
    ]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${apiKey}`
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  try {
    const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', options);
    const json = JSON.parse(response.getContentText());
    return json.choices[0].message.content; // Return the assistant's response
  } catch (e) {
    Logger.log('Error sending chat message: ' + e.message);
    return 'Failed to send message. Please check your API key and try again.';
  }
} 