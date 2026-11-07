# MindCode

MindCode shows every assumption Claude would make while building your app, as an editable mind map, then builds the app and traces every element back to a bubble.

---

## Live Links

- **Live Application:** [https://mindcode1.netlify.app](https://mindcode1.netlify.app)
- **Instant Preloaded Demo:** [https://mindcode1.netlify.app/?demo=1](https://mindcode1.netlify.app/?demo=1) (or `http://localhost:8888/?demo=1` locally)

---

## Features

- **Prompt Decomposition into 4 Facets:** Turns conversational prompts into structured architecture spanning Design, Audience, Functionality, and Cost.
- **Visual Source & Inventiveness Color Coding:**
  - **User decisions (Orange `#d67408`):** Elements directly supported by user quotes.
  - **Claude assumptions (Green `#17c894`):** Inferred capabilities with inventiveness shading (pale green for obvious choices, deep green for creative leaps).
  - **Open questions (Red with `?`):** Unresolved architectural decisions requiring user input.
  - **Approved (✓ badge):** Explicitly confirmed decisions.
- **Interactive Mind Map Editing:** Click any bubble to view its breadcrumb path and details in an Obsidian-style side drawer, chat directly with Claude about the node, edit labels and details, or add child bubbles.
- **Full & Incremental App Generation:**
  - Full app generation (single-file standalone HTML) synthesized directly from approved and proposed nodes.
  - Fast incremental rebuilds (~20 seconds) applying targeted FIND/REPLACE patches when small changes are made to the plan.
- **Preview Right-Click Edits (~7 seconds):** Right-click any UI element inside the live sandbox preview to request targeted styling or layout adjustments directly on that element.
- **Bidirectional Traceability:**
  - Every generated HTML element carries `data-mc` (node IDs) and `data-mc-el` (element ID) attributes.
  - Hovering elements in the app preview illuminates the mind map bubbles that informed them; selecting bubbles highlights corresponding preview elements.
  - Server-side trace audits quantify structural coverage and node breakdown.
- **Checkpoint Timeline & Restores:** Every build and significant map evolution creates a point-in-time checkpoint with full time-travel inspection and restore support.
- **Clean App View & Download:** Inspect standalone apps via "Open app ↗" or download the complete offline HTML bundle.

---

## Running Locally

### Prerequisites
- **Node.js 20+**
- **npm**
- **Git**

### Installation & Development Server

Run from the repository root:
```bash
npm install && npm install --prefix web && npx netlify dev
```

> **Note for Windows users:**
> If your directory path contains an ampersand (`&`) (e.g. `Coding & Projects\...`), `npx` will fail to resolve binaries. Ensure your repo clone path contains no `&` characters or run Netlify Dev via Git Bash / PowerShell using quotes or npm scripts.

Once started, open **[http://localhost:8888](http://localhost:8888)** (or append `/?demo=1` for the preloaded demo).

---

## Environment Variables

Configure environment variables in `.env` (copy from `.env.example`):

| Variable | Description | Default / Mode |
|---|---|---|
| `OPENROUTER_API_KEY` | Your OpenRouter API key for live model generation (`anthropic/claude-opus-5.5`). | Optional in fake mode |
| `OPENROUTER_MODEL` | Model slug to use on OpenRouter. | `anthropic/claude-opus-5.5` |
| `MINDCODE_FAKE_LLM` | Set to `1` to use deterministic offline mock responses without external network calls or API keys. | `""` (set to `1` for offline demo/tests) |

To run locally in fake/offline mode without an API key:
- **macOS / Linux:** `MINDCODE_FAKE_LLM=1 npx netlify dev`
- **Windows (PowerShell):** `$env:MINDCODE_FAKE_LLM="1"; npx netlify dev`
- **Windows (CMD / Git Bash):** `npx cross-env MINDCODE_FAKE_LLM=1 netlify dev`

---

## Running Tests

```bash
# Run backend API and AI test suites (offline fake mode)
MINDCODE_FAKE_LLM=1 npm test

# Typecheck TypeScript files
npm run typecheck

# Run frontend tests
npm test --prefix web

# Build frontend production bundle
npm run build --prefix web
```

---

## Deployments & Build Budget

Netlify deployment builds consume paid build minutes and are strictly gated to avoid unnecessary charges. Builds trigger only on commits whose message contains `[deploy]`.

Refer to [`docs/deploys.md`](docs/deploys.md) for deploy rules, team roles, and historical deploy logs.

---

## Demo Script

See [`docs/demo.md`](docs/demo.md) for the 3-minute walkthrough script covering the preloaded demo, mind map exploration, node side-panel editing, incremental rebuilding, right-click preview editing, and checkpoints.
