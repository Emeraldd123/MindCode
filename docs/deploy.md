# Deploying MindCode to Netlify

MindCode runs as a single unified deployment on [Netlify](https://www.netlify.com/):
- **Frontend**: Single-Page React + Vite app (built to `web/dist`).
- **Backend**: TypeScript Netlify Functions in `netlify/functions/` (routed to `/api/*`).
- **Session Store**: Serverless key-value persistence via **Netlify Blobs** (with in-memory fallback for local dev without Netlify CLI).

---

## 1. Prerequisites

- A GitHub repository with MindCode code.
- A [Netlify account](https://app.netlify.com/).
- An [OpenRouter API Key](https://openrouter.ai/keys) with credit (unless running in fake mode).

---

## Deploy budget (read first)
Ben pays per deploy: **15 deploys max**, only after major changes. `netlify.toml` skips every build unless the commit message contains `[deploy]`. Only Claude adds that tag. See **[docs/deploys.md](deploys.md)** for the rules and the log. After connecting the site, turn **off** Deploy Previews and Branch deploys in the Netlify UI.

## 2. One-Click / Git Connect Setup

1. Log in to [Netlify](https://app.netlify.com/) and click **Add new site** → **Import an existing project**.
2. Authorize and select your GitHub repository (`MindCode`).
3. Netlify will automatically detect configuration from `netlify.toml`:
   - **Base directory**: `.` (root)
   - **Build command**: `npm ci --prefix web && npm run build --prefix web`
   - **Publish directory**: `web/dist`
   - **Functions directory**: `netlify/functions`
4. Click **Deploy MindCode**. This first build will be **skipped** by the deploy gate, which is expected. Claude's next `[deploy]` merge does the first real deploy.

---

## 3. Environment Variables

Navigate to **Site configuration** → **Environment variables** in the Netlify dashboard and add:

| Variable | Required | Description | Example |
|---|---|---|---|
| `OPENROUTER_API_KEY` | Yes (for live AI) | Secret API key from OpenRouter. Never commit to git. | `sk-or-v1-...` |
| `OPENROUTER_MODEL` | No | Model slug to use. Defaults to `anthropic/claude-opus-5.5`. | `anthropic/claude-opus-5.5` |
| `MINDCODE_FAKE_LLM` | No | Set to `1` to run deterministic canned demo responses without calling OpenRouter. Defaults to `0`. | `0` |
| `OPENROUTER_SITE_URL` | No | Attribution URL for OpenRouter rankings. | `https://github.com/Emeraldd123/MindCode` |
| `OPENROUTER_APP_NAME` | No | Application name header for OpenRouter. | `MindCode` |

> [!NOTE]
> Netlify automatically injects credentials for **Netlify Blobs** into functions. No manual Blobs credentials or setup are required.

---

## 4. Architecture & Routing

All routing is pre-configured via `netlify.toml`:
- `/api/*`: Handled by `netlify/functions/api.mts` (synchronous API endpoints: sessions, chat, node inspection, approval).
- Background builds: Handled by `netlify/functions/build-background.mts` (asynchronous generation avoiding function timeout).
- `/*`: Single-page app rewrite falling back to `/index.html`.

---

## 5. Local Development (`netlify dev`)

To test locally with the exact same environment and proxies that Netlify uses in production:

```bash
# 1. Install root and frontend dependencies
npm install
npm install --prefix web

# 2. Copy environment file and configure keys
cp .env.example .env
# Edit .env with your OPENROUTER_API_KEY (or keep MINDCODE_FAKE_LLM=1 for offline testing)

# 3. Start local development server
npx netlify dev
```

Open [http://localhost:8888](http://localhost:8888) to use MindCode.

---

## 6. Verification Checklist

After deploying to Netlify:
1. **Health Check**: Visit `https://<your-site>.netlify.app/api/health` — should return `{"ok":true}`.
2. **Session Creation**: Open the main site — the chat interface should initialize a new session.
3. **Extraction**: Type `"I want a chat app for my study group"` — bubbles should appear in the center Mind Map.
4. **Build & Preview**: Click **Build** and verify that the preview renders the generated app with trace highlighting.
