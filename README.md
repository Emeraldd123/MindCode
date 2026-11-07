# MindCode

Our NOVA hackathon project. **The idea is not final yet.** This repo only holds the team setup so four teammates (Ben, Oliver, Lorien, 内山天満) and three shared AI agents (`web-agent`, `api-agent`, `ai-agent`) can work side by side without stepping on each other. Anyone can run or task any agent.

## Stack (planned)

| Part | Tech | Folder |
|---|---|---|
| Frontend | [React](https://react.dev/reference/react) + Vite | `web/` |
| Backend | [FastAPI](https://fastapi.tiangolo.com/#example-upgrade) | `api/` |
| AI | OpenRouter client, prompts, MCP | `ai/` |
| LLMs | [OpenRouter](https://openrouter.ai/docs/quickstart) (OpenAI-compatible) | called from `api/` |
| Tools | [MCP servers](https://mcpservers.org) | listed in `docs/mcp.md` |

## How the agents coordinate

One pinned GitHub issue is the **message board**. Each agent reads it with `tools/board unread` and posts with `tools/board post "[Oliver's web-agent] ..."`. Agents are tagged by handle (`@web-agent`), humans by GitHub login. Each agent owns its own folders (owner table in `AGENTS.md`), so they never edit the same files.

- `AGENTS.md`: the full rules (Antigravity and Claude Code both read it)
- `.agents/rules/team.md`: always-on Antigravity rule, a short version of `AGENTS.md`
- `.agents/workflows/board.md`: type `/board` in Antigravity to check the board and reply to mentions
- `.claude/`: hooks so Claude Code sees board posts automatically
- `tools/board`: the board CLI (needs only `bash` + `gh`)

## Kickoff checklist

**Running the agents in Antigravity:** see [`docs/antigravity-setup.md`](docs/antigravity-setup.md).

1. Accept the collaborator invite on GitHub.
2. Install the [GitHub CLI](https://cli.github.com) and run `gh auth login`.
3. Clone the repo **once per agent you'll run** (or use `git worktree add`), and set the handle in each:
   ```bash
   tools/board iam web-agent      # or api-agent / ai-agent
   tools/board whoami
   ```
4. `cp .env.example .env` and add the OpenRouter key.
5. Open the clone in Antigravity and type `/swarm`.

The board is issue [#1](https://github.com/Emeraldd123/MindCode/issues/1). Pin it if it isn't pinned yet.

On Windows, run `tools/board` from Git Bash or WSL.

## Build loop: one goal in, app out

1. Whoever is running each agent opens its clone in Antigravity and types `/swarm`. The three agents wait on the board.
2. Any human posts the goal, from the terminal or straight on issue #1:
   ```bash
   BOARD_HUMAN=Ben tools/goal "a web app that ..."
   ```
   To task one agent directly, comment on issue #1: `[Lorien's Human] @web-agent add a dark mode toggle`.
3. `ai-agent` (planner) posts a `PLAN:` (split, API contract, model). All three agents build their lanes in parallel, push to `main`, and post `DONE:` / `NEED:` to hand off.
4. The planner integrates and posts `SHIPPED:` with run steps. Post a new `GOAL:` to redirect or `STOP` to halt.

Protocol details are in `AGENTS.md` section 6.
