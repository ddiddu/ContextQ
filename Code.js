function onOpen() {
  var ui = SlidesApp.getUi();
  ui.createMenu('ContextAI')
      .addItem('Generate Comments', 'menuItem1')
      .addToUi();
}

function menuItem1() {
  const template = HtmlService.createTemplateFromFile('Sidebar');
  const html = template.evaluate().setTitle('Let’s Improve Your Slides.');
  SlidesApp.getUi().showSidebar(html);
}

function doGet() {
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle('Material Test')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
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
      .filter(shape =>
        shape.getText && typeof shape.getText === "function"
      )
      .map(shape => shape.getText().asString().trim())
      .filter(text => text !== "");

    const slideText = textItems.join('\n');

    if (slideText) {
      structuredSlides.push({ slide: i + 1, content: slideText });
    }
  }

  Logger.log("Structured slide content:\n" + JSON.stringify(structuredSlides, null, 2));
  return structuredSlides;
}

function generateComments(selectedContexts) {
  Logger.log("generateComments function called with contexts: " + JSON.stringify(selectedContexts));

  if (!Array.isArray(selectedContexts) || selectedContexts.length === 0) {
    Logger.log("Error: selectedContexts is not a valid array or is empty.");
    return [];
  }

  const slideContent = getSlideContent(); // [{slide: 1, content: "..."}]
  Logger.log("Structured slide content: " + JSON.stringify(slideContent));

  const tones = ["very positive", "positive", "neutral", "critical", "very critical"];

  const allQuestions = selectedContexts.map(context => {
    Logger.log("Processing context: " + JSON.stringify(context));

    const questionsWithTones = tones.flatMap(tone => {
      try {
        // 🔹 STEP 1: Extract relevant slide fragments (1–2 per slide)
        const fragmentExtractionPayload = {
          model: "gpt-4.1",
          messages: [
            {
              role: "system",
              content: `
You are a slide reviewer. You will receive an array of slides in JSON format:
[{ "slide": 1, "content": "..." }, ...]

For each slide, return up to 2 short phrases or sentences that could benefit from reflection or revision.

Return a JSON array of objects:
[
  { "slide": 1, "text": "..." },
  { "slide": 2, "text": "..." },
  ...
]
              `.trim()
            },
            {
              role: "user",
              content: JSON.stringify(slideContent)
            }
          ]
        };

        const fragmentOptions = {
          method: 'post',
          contentType: 'application/json',
          headers: {
            'Authorization': `Bearer ${getApiKey()}`
          },
          payload: JSON.stringify(fragmentExtractionPayload),
          muteHttpExceptions: true
        };

        const fragmentResponse = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', fragmentOptions);
        const fragmentJson = JSON.parse(fragmentResponse.getContentText());
        const slideFragments = JSON.parse(fragmentJson.choices[0].message.content);

        Logger.log(`Extracted fragments: ${JSON.stringify(slideFragments)}`);

        // 🔹 STEP 2: Generate feedback/questions based on those fragments
        const feedbackGenerationPayload = {
          model: "gpt-4.1",
          messages: [
            {
              role: "system",
              content: `
You are an assistant generating 10 thoughtful comments about a set of slide fragments from a presentation.

Each input fragment includes:
- "slide": the slide number
- "text": the quoted slide content

Your task:
1. Read and interpret each fragment carefully.
2. Reflect on each: Is it vague, unclear, strategic, or improvable?
3. Select fragments from **at least 5 different slides** to comment on.
4. For each selected fragment, generate:
    - A question or feedback item
    - A step-by-step explanation of your reasoning

You must generate 10 outputs per slide in the "${tone}" tone: <!-- provide one instrucutions per one tone -->
- 5 items of type: "reflective" (low AI assistance, open-ended question)
- 5 items of type: "feedback" (high AI assistance, critique + revision)

Each output must be a JSON object with:
- "slide": the slide number
- "text": a quoted or lightly paraphrased excerpt from the original slide that the comment refers to. This should neutrally identify what is being critiqued — without inserting any evaluative language. Do not include feedback, interpretation, or suggestions in this field.
- "output": your generated comment
- "reason": a **step-by-step chain-of-thought** showing how you arrived at the comment
- "type": either "reflective" or "feedback"

Do not skip or summarize your thinking. Treat the "reason" field as your internal monologue — write it out like you're thinking aloud, step by step.

---

### Reflective Questions (Low AI Assistance)
- Ask open-ended questions to prompt reflection or clarification.
- Avoid giving answers or rewording the content.
- Encourage the presenter to deepen their reasoning or precision.

---

### Actionable Feedback (High AI Assistance)
- Your goal is to clearly identify a weakness, ambiguity, or missed opportunity in the original text.
- You must also suggest a **specific revision** or improved phrasing.
- You **may choose your own sentence structure** — but the revised version must be clearly presented.

You may use one of the following styles:
- “Consider rephrasing as: ‘...’”
- “This could be clearer if written as: ‘...’”
- “A more effective version might be: ‘...’”
- Or, embed the revision naturally within your feedback sentence.

You must include both a critique and a suggested revision.  
Do **not** only point out the problem — always offer a concrete improvement.

Avoid vague suggestions like “be more clear” or “reword this.” Instead, show how.

---

### Chain-of-Thought Reasoning Instructions
For the "reason" field, provide a short **step-by-step explanation** (2–4 steps) that includes:
1. How you interpreted the original text.
2. Why it might be vague, misleading, weak, or strategic.
3. How you decided what kind of comment to give (reflective or actionable).
4. (For feedback only) Why your rewrite improves the original.

Use natural, numbered reasoning steps. Do not just say “this is vague.”

---

### Tone Calibration Instructions
Your comments must follow distinct linguistic patterns based on tone. Use the following rules to ensure tone is immediately recognizable:

- **Very Positive**  
  - Emphasize strengths first, use affirming language (“Excellent”, “Clear strength”, “Well done”)  <!-- remove the prompt examples --!>
  - Suggestions are always framed as light enhancements  

- **Positive**  
  - Supportive, includes suggestions framed gently (“You could consider…”, “Might be strengthened by…”)  
  - Acknowledge effort before suggesting improvement  
  - No strong critique words or urgency

- **Neutral**  
  - Balanced, analytical tone.  
  - No praise or critique — simply describe and suggest.  
  - Avoid emotional or judgmental phrasing.

- **Critical**  
  - Prioritize clarity, point out issues directly.  
  - Use improvement-focused verbs (“clarify”, “avoid”, “strengthen”)  
  - Do not hedge suggestions — they should be actionable and necessary.

- **Very Critical**  
  - Be strategic and candid.  
  - Highlight serious flaws, misalignments, or risks.  
  - Use urgent, precise language (“undermines”, “misleads”, “must revise”). <!-- urgency remove --!>  
  - Do not soften the feedback — this tone assumes a probe or expert review context.

Your language must visibly shift between tones. If two tones would produce identical wording, revise your approach to make the distinction clearer.

---

All interpretation must appear **only in the "output" or "reason"** fields.

Return only a JSON array of 10 objects. Do not include markdown, headers, or extra commentary.
              `.trim()
            },
            {
              role: "user",
              content: `
Context: ${context.context}

Fragments:
${JSON.stringify(slideFragments)}
              `.trim()
            }
          ]
        };

        const feedbackOptions = {
          method: 'post',
          contentType: 'application/json',
          headers: {
            'Authorization': `Bearer ${getApiKey()}`
          },
          payload: JSON.stringify(feedbackGenerationPayload),
          muteHttpExceptions: true
        };

        const feedbackResponse = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', feedbackOptions);
        const feedbackJson = JSON.parse(feedbackResponse.getContentText());
        const outputs = JSON.parse(feedbackJson.choices[0].message.content);

        Logger.log(`Generated outputs for tone "${tone}": ` + JSON.stringify(outputs));

        const reflectiveQuestions = outputs.filter(o => o.type === "reflective").map(o => ({
          slide: o.slide,
          text: o.text,
          question: o.output,
          reason: o.reason || null, // if you’ve added CoT
          fullSlideContent: slideContent, // ✅ Add full original slides here
          type: "reflective",
          tone: tone,
          persona: context.title,
          assistanceLevel: "low"
        }));
        
        const actionableFeedback = outputs.filter(o => o.type === "feedback").map(o => ({
          slide: o.slide,
          text: o.text,
          question: o.output,
          reason: o.reason || null,
          fullSlideContent: slideContent, // ✅ Also include here
          type: "actionable_feedback",
          tone: tone,
          persona: context.title,
          assistanceLevel: "high"
        }));

        return [...reflectiveQuestions, ...actionableFeedback];

      } catch (e) {
        Logger.log(`Error generating outputs for tone "${tone}": ` + e.message);
        return [];
      }
    });

    return {
      persona: context.title,
      questions: questionsWithTones
    };
  });

  Logger.log("All questions with tones: " + JSON.stringify(allQuestions));
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