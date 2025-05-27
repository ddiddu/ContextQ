function onOpen() {
  var ui = SlidesApp.getUi();
  ui.createMenu('ContextQ')
      .addItem('Context', 'menuItem1')
      .addItem('Questions', 'menuItem2')
      .addToUi();
}

function menuItem1() {
  const template = HtmlService.createTemplateFromFile('Sidebar');
  const html = template.evaluate().setTitle('AI Comments');
  SlidesApp.getUi().showSidebar(html);
}

function menuItem2() {
  const comments = generateComments();
  // const comments = [
  //   { text: "Helpfulness: 4.75", feedback: "Consider providing specific examples of stakeholder presentations to illustrate the rating." },
  //   { text: "Applicable to real-world scenario", feedback: "Add a brief description of a relevant real-world scenario to enhance understanding." },
  //   { text: "For important presentations", feedback: "Clarify what qualifies as 'important presentations' to give context to the audience." }
  // ];
  const template = HtmlService.createTemplateFromFile('Sidebar');
  template.comments = comments;
  const html = template.evaluate().setTitle('AI Comments');
  SlidesApp.getUi().showSidebar(html);
}

function getSlideContent() {
  const slides = SlidesApp.getActivePresentation().getSlides();
  let targetIndex = 5; // Slide 6 (0-based index)

  if (targetIndex >= slides.length) {
    return "Slide 6 does not exist.";
  }

  const slide = slides[targetIndex];
  const shapes = slide.getShapes();
  let text = shapes.map(shape => {
    if (shape.getShapeType() === SlidesApp.ShapeType.TEXT_BOX) {
      return shape.getText().asString();
    }
    return '';
  }).join('\n');

  return `Slide 6:\n${text}`;
}

function generateComments() {
  const content = getSlideContent();

  const payload = {
    model: "gpt-4o-mini-2024-07-18",
    messages: [
      {
        role: "system",
        content: "You are an assistant helping improve slide content. Return ONLY a JSON array of feedback cards. Each card must be an object with two keys: `text` and `feedback`. Do not add explanations, markdown, or any extra text."
      },
      {
        role: "user",
        content: `Review the following slide content and return suggestions as a JSON array of cards. Each card must look like: { "text": "...", "feedback": "..." }\n\n${content}`
      }
    ]
  };

  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer REMOVED'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  };

  const response = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', options);
  const json = JSON.parse(response.getContentText());

  try {
    const cards = JSON.parse(json.choices[0].message.content);
    return cards;  // ✅ Return as array of objects
  } catch (e) {
    Logger.log("Invalid JSON from model:\n" + json.choices[0].message.content);
    return [];
  }
}

function highlightSlideText(targetText) {
  const slides = SlidesApp.getActivePresentation().getSlides();

  for (let slide of slides) {
    const shapes = slide.getShapes();
    for (let shape of shapes) {
      if (shape.getShapeType() === SlidesApp.ShapeType.TEXT_BOX) {
        const textRange = shape.getText();
        const text = textRange.asString();

        if (text.includes(targetText)) {
          // Simulate highlight by wrapping the target text
          const start = text.indexOf(targetText);
          const end = start + targetText.length;
          textRange.getRange(start, end).setBold(true).setForegroundColor('#d62828'); // Reddish color
          slide.selectAsCurrentPage();
          shape.select();
          return;
        }
      }
    }
  }

  SlidesApp.getUi().alert("Could not find the text on any slide.");
}

function saveContextData(context) {
  // You can log it, store in PropertiesService, or associate with slide notes
  Logger.log("Saved context: " + JSON.stringify(context));
}