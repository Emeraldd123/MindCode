# Team rules for every agent (MindCode @ NOVA)

Four humans (Ben, Oliver, Lorien, 内山天満) share three AI agents: `web-agent`, `api-agent` and `ai-agent` (Google Antigravity by default; any shell-capable agent follows the same rules). Agents are not owned by a person. Anyone can run one on their laptop and **any human can give any agent a task** by tagging its handle. Ben is the lead and settles conflicting instructions.

> **Status: pre-idea.** Do NOT write app code until a human posts a `GOAL:` on the board (via `tools/goal`). A GOAL unlocks coding and starts the build loop in section 6.

## 1. The board (pinned GitHub issue)

Every agent reads and posts on the pinned "Message Board" issue via `tools/board` (needs only `bash` + `gh`, logged in). Set `BOARD_ISSUE` if it is not issue #1.

- Start every post with `[<human>'s <agent>]`. Agents use their handle: `[Oliver's web-agent]` (the human is whoever is running it right now). Humans use `[<name>'s Human]`, e.g. `[内山天満's Human]`. Keep it short: what changed, which files or contracts, what you need, from whom.
- **Tag agents by handle:** `@web-agent`, `@api-agent`, `@ai-agent`, `@agents` (all three). **Tag humans by GitHub login:** `@Emeraldd123` (Ben), `@litoli0226` (Oliver), `@lorienzhu` (Lorien), `@TenmaUchiyama` (内山天満). `@all` is everyone, humans and agents.
- **Who am I?** Each agent's clone remembers its handle: `tools/board iam` prints it. If it's empty, ask your human which handle you are and run `tools/board iam <handle>`. One clone (or `git worktree`) per agent.
- **Mentions you or `@all`:** act on it and reply promptly.
- **Not addressed to you:** still read it. Reassess your own work only if it is affected (a contract, a file you own, something already done). Do not redo finished work, and do not reply just to acknowledge.
- Before editing another agent's folders, ask that agent for a handoff on the board and wait for it or Ben.

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

Folders belong to **agents**, not people, so any human can drive any lane.

| Agent | Lane | Folders |
|---|---|---|
| `@ai-agent` (planner) | OpenRouter calls, prompts, MCP tools, integration | `ai/`, `docs/mcp.md` |
| `@web-agent` | React + Vite frontend | `web/` |
| `@api-agent` | FastAPI routes, data, glue | `api/`, `docs/api-contract.md` |
| humans | product, design, QA, demo | `docs/product.md`, `docs/demo.md`, `design/` |
| Ben (`@Emeraldd123`) decides | shared setup | `AGENTS.md`, `.agents/`, `.claude/`, `tools/`, `README.md`, `.env.example` |

`api/` imports from `ai/` (e.g. `from ai.chat import ...`); only `@ai-agent` edits `ai/`.

**Planner:** `@ai-agent`. Only the planner posts a PLAN. If only one or two agents are running, the planner assigns the missing lanes to whoever is up.

**Humans:** anyone can post a `GOAL:`, give a task to any agent (`[Lorien's Human] @web-agent make the button blue`), test a `DONE:` and reply `BUG: @<agent> ...` or `OK`. Conflicting instructions: Ben decides. By default 内山天満 keeps the acceptance criteria and demo script up to date.

## 6. The build loop (GOAL → PLAN → DONE → SHIPPED)

A human starts it with `tools/goal "what to build"`. Agents run the loop in `.agents/workflows/swarm.md` (`/swarm` in Antigravity) until `SHIPPED`. Every post starts with one of these keywords right after the `[<human>'s <agent>]` prefix:

| Keyword | Who | Means |
|---|---|---|
| `GOAL:` | any human (`[Ben's Human]`, `[内山天満's Human]`, ...) | What to build. A newer GOAL replaces an older one; Ben settles conflicts. |
| `PLAN:` | planner agent | The split. Posted within 5 min of a GOAL. |
| `DONE:` | any agent | A task is pushed to `main`, plus how to try it. |
| `NEED: @<agent>` | any agent | A blocker someone else owns. Keep building on a mock meanwhile. |
| `BUG: @<agent>` | any human | Something broken; the owner fixes it next and replies `DONE:`. |
| `SHIPPED:` | planner agent | Runs end to end. How to run it. Tags the human. |
| `STOP` | human | Agents finish the current commit and stop the loop. |

PLAN format (keep it under ~25 lines):

```
[Ben's ai-agent] @all PLAN: <one-line summary>
Contract: <routes, also committed to docs/api-contract.md>
@ai-agent (ai/): 1) ... 2) ...
@web-agent (web/): 1) ... 2) ... 3) ...
@api-agent (api/): 1) ... 2) ... 3) ...
Humans: acceptance criteria + demo script in docs/, then test each DONE
Model: <OpenRouter model slug>   Demo: <the one flow that must work>
```

Speed rules: build in parallel against the contract (mock the other side until it lands), push straight to `main` in small commits during the loop (skip branches and PRs), `git pull --rebase` before every push, no features beyond the GOAL. Humans can redirect at any time with a new `GOAL:` or `STOP`.

Agents and humans often share a GitHub account. That's fine: with a handle set, `tools/board` hides only your own agent's posts, so you still see your human's GOALs and the other agents' posts from the same account.
