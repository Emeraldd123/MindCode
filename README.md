# MindCode

Our NOVA hackathon project. **The idea is not final yet.** This repo only holds the team setup so two Antigravity agents can work side by side without stepping on each other.

## Stack (planned)

| Part | Tech | Folder |
|---|---|---|
| Frontend | [React](https://react.dev/reference/react) + Vite | `web/` |
| Backend | [FastAPI](https://fastapi.tiangolo.com/#example-upgrade) | `api/` |
| LLMs | [OpenRouter](https://openrouter.ai/docs/quickstart) (OpenAI-compatible) | called from `api/` |
| Tools | [MCP servers](https://mcpservers.org) | listed in `docs/mcp.md` |

## How the two agents coordinate

One pinned GitHub issue is the **message board**. Each agent reads it with `tools/board unread`, posts with `tools/board post "[Ben's Antigravity] ..."`, and tags the other teammate by GitHub login. Each person owns their own folders (see the owner table in `AGENTS.md`), so the agents never edit the same files.

- `AGENTS.md`: the full rules (Antigravity and Claude Code both read it)
- `.agents/rules/team.md`: always-on Antigravity rule, a short version of `AGENTS.md`
- `.agents/workflows/board.md`: type `/board` in Antigravity to check the board and reply to mentions
- `.claude/`: hooks so Claude Code sees board posts automatically
- `tools/board`: the board CLI (needs only `bash` + `gh`)

## Kickoff checklist

1. Add your teammate as a collaborator on the repo.
2. Open a new issue from the **Message board** template and pin it. If it is not #1, every teammate runs `export BOARD_ISSUE=<number>`.
3. Replace `@TEAMMATE_1` / `@TEAMMATE_2` in `AGENTS.md` with real GitHub logins.
4. Each teammate: install the [GitHub CLI](https://cli.github.com), run `gh auth login`, then `tools/board whoami`.
5. `cp .env.example .env` and add the OpenRouter key.
6. Once the idea is final: fill in the owner table in `AGENTS.md`, then start the build loop below.

On Windows, run `tools/board` from Git Bash or WSL.

## Build loop: one goal in, app out

1. Each teammate opens the repo in Antigravity and types `/swarm`. Their agent waits on the board.
2. A human posts the goal:
   ```bash
   BOARD_HUMAN=Ben tools/goal "a web app that ..."
   ```
3. The planner agent posts a `PLAN:` (split, API contract, model). Both agents build their halves in parallel, push to `main`, and post `DONE:` / `NEED:` to hand off.
4. The planner integrates and posts `SHIPPED:` with run steps. Post a new `GOAL:` to redirect or `STOP` to halt.

Protocol details are in `AGENTS.md` section 6.
