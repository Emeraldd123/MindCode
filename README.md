# MindCode

MindCode is a prompt engineering tool for building web apps with Claude. It turns natural language brainstorming into a live, interactive **mind map**, separating your ideas from Claude's quiet assumptions and identifying crucial unknowns before a single line of code is written.

When you're ready to build, Claude generates the full application—and **every single UI element traces directly back to the bubbles that informed it**.

---

## Quickstart (Fresh Clone)

### Prerequisites
- **Node.js 20+** (tested on Node 20, 22, and 24)
- **Git**

### 1. Install Dependencies
```bash
# Clone the repository
git clone https://github.com/Emeraldd123/MindCode.git
cd MindCode

# Install root & backend dependencies
npm install

# Install web frontend dependencies
npm install --prefix web
```

### 2. Run the App

#### A. Offline / Demo Mode (No API key needed)
Uses deterministic mock responses to run the complete 3-minute demo flow without external calls:
- **macOS / Linux:**
  ```bash
  MINDCODE_FAKE_LLM=1 npx netlify dev
  ```
- **Windows (PowerShell):**
  ```powershell
  $env:MINDCODE_FAKE_LLM="1"; npx netlify dev
  ```
- **Windows (Git Bash / CMD):**
  ```bash
  npx cross-env MINDCODE_FAKE_LLM=1 netlify dev
  ```

Open **[http://localhost:8888](http://localhost:8888)** in your browser.

#### B. Live Mode (OpenRouter / Claude Opus 5.5)
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Add your OpenRouter API key in `.env`:
   ```bash
   OPENROUTER_API_KEY=sk-or-v1-...
   ```
3. Run the development server:
   ```bash
   npx netlify dev
   ```

---

## Running Tests

```bash
# Run backend and AI test suite
npm test

# Run frontend tests
npm test --prefix web

# Build frontend bundle
npm run build --prefix web
```

---

## 3-Minute Demo Flow

Follow the exact steps in [`docs/demo.md`](docs/demo.md) to showcase:
1. Prompt reconstruction into live colored bubbles (solid blue = user, amber dashed = Claude assumed, red = unknown decision).
2. Distinguishing obvious inferences vs creative leaps via inventiveness shading.
3. Brainstorming inside a bubble and approving it.
4. One-click app build with two-way hover and click traceability.
5. Checkpoint timeline exploration.

---

## Team & Development

MindCode was built collaboratively during NOVA by human engineers alongside autonomous coding agents:
- **Claude** (`@claude`)
- **Antigravity** (`@antigravity`)
- **Antigravity2** (`@antigravity2`)
- **Jules** (Google Cloud async coding agent)

Coordinated via the pinned GitHub issue [#1](https://github.com/Emeraldd123/MindCode/issues/1) message board. Full agent rules: [`AGENTS.md`](AGENTS.md).
