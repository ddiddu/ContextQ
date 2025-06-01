# ContextQ: Contextual Questioner for Google Slides

**ContextQ** is a Google Slides add-on designed to generate contextual audience questions using AI personas. This tool leverages contextual inputs such as presentation purpose and audience demographics to foster reflexive thinking during slide creation.



## **Features**

### **Context Management**
- Add, view, and modify AI personas with contextual details:
  - Persona title
  - Presentation purpose
  - Audience settings
  - Core instructions
  - Guardrails
  - Example questions
- Save and manage multiple personas for different contexts.

### **Question Generation**
- Generate audience questions based on selected personas.
- Use OpenAI's GPT-4 model to create insightful and meaningful questions tailored to the persona's purpose and audience.

### **Versioning and Filtering**
- Save generated questions with timestamps for version control.
- Filter questions by persona or version for easy access.

### **Interactive UI**
- Tab-based interface for managing contexts, questions, and settings.
- Dynamic dropdowns for selecting personas and versions.
- Loading indicators and overlays for better user feedback during operations.



## **File Structure**

### **HTML**
- `Sidebar.html`: Contains the UI structure and embedded JavaScript for managing contexts, questions, and settings.

### **JavaScript**
- Embedded in `Sidebar.html`:
  - Handles DOM manipulation, event listeners, and client-side logic.
  - Google Apps Script does not support standalone `.js` files for client-side logic.

### **Server-Side Code**
- `Code.js`: Contains server-side logic for interacting with Google Slides and OpenAI's API.



## **Installation**

1. Clone this repository:
   ```bash
   git clone https://github.com/your-repo/contextq.git
   cd contextq
   ```
2. Install [Google Apps Script CLI (clasp)](https://github.com/google/clasp):
   ```
   npm install -g @google/clasp
   ```
3. Authenticate with your Google account:
   ```
   clasp login
   ```
4. Push the project to Google Apps Script:
   ```
   clasp push
   ```
5. Open the script editor in Google Apps Script:
   ```
   clasp open
   ```
6. Deploy the add-on:
   - Go to Deploy > Test deployments in the Apps Script editor.
   - Install the add-on in Google Slides.



## Usage ##
1. Open a Google Slides presentation.
2. Navigate to the ContextQ menu in the toolbar.
3. Use the following tabs:
   - **Context**: Add or modify AI personas with contextual details.
   - **Questions**: Generate and manage audience questions.
   - **Settings**: Configure API keys and model preferences.
