# ContextQ

ContextQ is a Google Slides Apps Script add-on that generates AI comments for your deck based on:

- your presentation context (purpose, audience, etc.)
- selected comment tone (critical ↔ positive)
- selected comment type (question, feedback, or both)
- slide text, speaker notes, and slide thumbnails

The sidebar workflow guides users through context input, tone/type selection, generation, and filtering.

## What it does

- Adds a custom Google Slides menu: **Comments**
- Opens a sidebar UI to collect presentation context
- Generates comments with OpenAI using prompt templates
- Supports two comment styles:
  - `reflective` (question-like)
  - `feedback` (actionable suggestions)
- Allows post-generation filtering by tone and type
- Stores each user's API key in Apps Script User Properties

## Tech stack

- Google Apps Script (V8)
- Google Slides API (advanced service)
- HtmlService templates for sidebar UI
- Material Web Components (loaded from CDN)
- OpenAI Chat Completions API

## Project structure

- `Code.js`: server-side Apps Script entry points, Slides extraction, OpenAI calls
- `index.html`: sidebar shell and main workflow page
- `script.html`: client-side sidebar logic (step flow, generate/filter actions)
- `render.html`: comment card renderer template
- `settings.html`: API key settings page
- `head.html`: shared head imports (Material Web, fonts)
- `style.html`: shared UI styles
- `promptSystem.html`: system prompt template
- `promptUser.html`: user prompt template
- `promptType.html`: JSON definitions for comment types
- `cardView.html`: card preview/debug UI
- `appsscript.json`: Apps Script manifest and OAuth scopes
- `config.json`: local config (do **not** commit secrets)

## Setup

### 1) Prerequisites

- Google account with access to Google Slides
- Node.js + npm
- `clasp` CLI

Install clasp:

```bash
npm install -g @google/clasp
```

### 2) Apps Script project linkage

From this project directory:

```bash
clasp login
clasp create --type slides --title "ContextQ"
clasp push
clasp open
```

If you already have an Apps Script project, set `.clasp.json` to that script ID and run `clasp push`.

### 3) Enable required service

In Apps Script editor:

- **Services** → add **Google Slides API** (advanced service)

### 4) Deploy for testing

- **Deploy** → **Test deployments**
- Install and authorize in Google Slides

## Usage

1. Open a Slides deck.
2. Use menu **Comments → Generate Comments**.
3. Enter presentation context and click **Save**.
4. Choose example tone cards, then choose type cards.
5. Generate comments.
6. Adjust tone slider / type radio and click **Apply** to filter or generate missing combinations.
7. Use **Comments → Save Settings** to store your OpenAI API key.

## Security notes

- API keys are stored with `PropertiesService.getUserProperties()` per user.
- Never commit real API keys to source control.
- If a key has ever been committed (for example in `config.json`), rotate it immediately.

## Prompting flow

- `promptSystem.html` defines response format and output constraints.
- `promptUser.html` injects:
  - selected tone
  - selected type + definition
  - presentation context
  - serialized slide text/notes
- `promptType.html` provides type semantics (`reflective`, `feedback`).

## Notes and limitations

- Slide content extraction is currently limited to the first few slides by server logic.
- Output shape is expected to be raw JSON array from the model.
- Material components are loaded from public CDNs; internet access is required.

## Troubleshooting

- **"API Key not found"**: open **Comments → Save Settings** and save a key.
- **No output / generation error**: check Apps Script execution logs and API quota.
- **Missing menu**: reload Slides after deployment/install.
- **Thumbnail issues**: verify Slides advanced service is enabled and authorized.
