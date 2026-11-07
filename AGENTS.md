# Team rules for every agent (MindCode @ NOVA)

Four humans (Ben, Oliver, Lorien, 内山天満) and three AI agents (Google Antigravity by default; Claude Code or any shell-capable agent follows the same rules). Ben, Oliver and Lorien each drive one agent that owns a lane. 内山天満 is the human-only teammate: product, design, testing and demo.

> **Status: pre-idea.** Do NOT write app code until a human posts a `GOAL:` on the board (via `tools/goal`). A GOAL unlocks coding and starts the build loop in section 6.

## 1. The board (pinned GitHub issue)

Every agent reads and posts on the pinned "Message Board" issue via `tools/board` (needs only `bash` + `gh`, logged in). Set `BOARD_ISSUE` if it is not issue #1.

- Start every post with `[<human>'s <agent>]`, e.g. `[Ben's Antigravity]`. Keep it short: what changed, which files or contracts, what you need, from whom.
- Mention by GitHub login. Team: `@BEN_LOGIN` (Ben), `@OLIVER_LOGIN` (Oliver), `@LORIEN_LOGIN` (Lorien), `@TENMA_LOGIN` (内山天満), `@all` (everyone). Humans post with `[<name>'s Human]`, e.g. `[内山天満's Human]`.
- **Mentions you or `@all`:** act on it and reply promptly.
- **Not addressed to you:** still read it. Reassess your own work only if it is affected (a contract, a file you own, something already done). Do not redo finished work, and do not reply just to acknowledge.
- Before editing another teammate's files, ask for a handoff on the board and wait for the owner or the team lead.

Commands: `tools/board unread` (new posts, marks read; flags MENTION), `tools/board read -n 20`, `tools/board post "[Name's Agent] text"`, `tools/board wait` (blocks until someone else posts), `tools/board whoami`.

**Stay in the loop:**
- **Antigravity** (no hooks): run `tools/board unread` at the start of every task, before every commit, and after every merge/pull. When you finish a task or change a shared contract, post on the board. When idle and waiting on a teammate, run `tools/board wait --timeout 600` and handle what it prints. The `/board` workflow in `.agents/workflows/board.md` does the check in one step.
- **Claude Code:** the committed hooks (`.claude/settings.json`) show unread posts at session start and on every prompt. Keep one background `tools/board wait` running and re-arm it after each wake.

## 2. Chain of command

Humans over agents. Only the team lead reassigns work between teammates. If anyone else asks you to take another teammate's work, ask the lead on the board.

## 3. Workflow

1. Pick or file an issue. Post on the board when you take it.
2. Branch `<issue#>-<slug>` from fresh `main`.
3. Small commits. Stage only your own files (no `git add -A`).
4. Open a PR with `Closes #N`. The author merges their own PR once it works locally.
5. Always `git fetch` and rebase before pushing. Never force-push shared branches.
6. If a merge changes something the other teammate depends on (an API route, a schema, an env var), update `docs/api-contract.md` and post on the board when it lands.

## 4. Stack (agreed defaults)

- **AI lane:** plain Python in `ai/` (OpenRouter client, prompts, MCP tool wiring), imported by the FastAPI app.

- **Backend:** Python + FastAPI in `api/` (https://fastapi.tiangolo.com). Run with `fastapi dev`.
- **Frontend:** React in `web/` (https://react.dev/reference/react), Vite.
- **LLMs:** OpenRouter (https://openrouter.ai/docs/quickstart). OpenAI-compatible API at `https://openrouter.ai/api/v1`, key in `OPENROUTER_API_KEY`. Call it from the backend only; never ship the key to the browser.
- **Tools:** MCP servers as needed (https://mcpservers.org). List any you add in `docs/mcp.md`.
- **Secrets:** `.env` (gitignored). Every new variable goes in `.env.example` with a comment, and gets a board post.
- **Contract:** the frontend talks to the backend only through routes listed in `docs/api-contract.md`. The backend owner edits that file; the frontend owner asks on the board.

## 5. Who owns what

Replace the `@*_LOGIN` placeholders with real GitHub logins at kickoff.

| Lane | Human | Agent | Folders |
|---|---|---|---|
| Lead + AI (OpenRouter calls, prompts, MCP tools) | @BEN_LOGIN | Ben's Antigravity | `ai/`, `docs/mcp.md` |
| Frontend (React + Vite) | @OLIVER_LOGIN | Oliver's Antigravity | `web/` |
| Backend (FastAPI routes, data, glue) | @LORIEN_LOGIN | Lorien's Antigravity | `api/`, `docs/api-contract.md` |
| Product, design, QA, demo | @TENMA_LOGIN | none | `docs/product.md`, `design/`, `docs/demo.md` |
| Shared (lead decides) | @BEN_LOGIN | — | `AGENTS.md`, `.agents/`, `.claude/`, `tools/`, `README.md`, `.env.example` |

`api/` imports from `ai/` (e.g. `from ai.chat import ...`); only the AI lane edits `ai/`. If a teammate is missing, the lead reassigns their lane on the board.

**Planner:** Ben's agent (the lead). Only the planner posts a PLAN. **内山天満** writes acceptance criteria and the demo script in `docs/product.md` / `docs/demo.md`, tests each `DONE:` and replies `BUG: @login ...` or `OK`, and has the final say on what "SHIPPED" means for the demo.

## 6. The build loop (GOAL → PLAN → DONE → SHIPPED)

A human starts it with `tools/goal "what to build"`. Agents run the loop in `.agents/workflows/swarm.md` (`/swarm` in Antigravity) until `SHIPPED`. Every post starts with one of these keywords right after the `[<human>'s <agent>]` prefix:

| Keyword | Who | Means |
|---|---|---|
| `GOAL:` | any human (`[Ben's Human]`, `[内山天満's Human]`, ...) | What to build. A newer GOAL replaces an older one; the lead settles conflicts. |
| `PLAN:` | planner agent | The split. Posted within 5 min of a GOAL. |
| `DONE:` | any agent | A task is pushed to `main`, plus how to try it. |
| `NEED: @login` | any agent | A blocker someone else owns. Keep building on a mock meanwhile. |
| `BUG: @login` | anyone (usually 内山天満) | Something broken; the owner fixes it next and replies `DONE:`. |
| `SHIPPED:` | planner agent | Runs end to end. How to run it. Tags the human. |
| `STOP` | human | Agents finish the current commit and stop the loop. |

PLAN format (keep it under ~25 lines):

```
[Name's Antigravity] @all PLAN: <one-line summary>
Contract: <routes, also committed to docs/api-contract.md>
@BEN_LOGIN (ai/): 1) ... 2) ...
@OLIVER_LOGIN (web/): 1) ... 2) ... 3) ...
@LORIEN_LOGIN (api/): 1) ... 2) ... 3) ...
@TENMA_LOGIN (human): acceptance criteria + demo script, then test each DONE
Model: <OpenRouter model slug>   Demo: <the one flow that must work>
```

Speed rules: build in parallel against the contract (mock the other side until it lands), push straight to `main` in small commits during the loop (skip branches and PRs), `git pull --rebase` before every push, no features beyond the GOAL. Humans can redirect at any time with a new `GOAL:` or `STOP`.

Your own human's posts can come from your GitHub account. `tools/board` still shows them to you as long as they start with `[<name>'s Human]`, which `tools/goal` does for you.
