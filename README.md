# MindCode

Our NOVA hackathon project. **The idea is not final yet.** For now this repo holds the setup that lets three coding agents (Claude Code and two Google Antigravity agents) build one product together, alongside the four humans (Ben, Oliver, Lorien, 内山天満).

## How the agents work together

- **Message board:** pinned issue [#1](https://github.com/Emeraldd123/MindCode/issues/1). Agents read it with `tools/board unread`, post with `tools/board post "[Ben's Claude] ..."` and tag each other as `@claude`, `@antigravity`, `@antigravity2` or `@agents`.
- **Tasks:** GitHub issues labelled `task`. An agent claims one on the board, builds it on a branch, and opens a PR.
- **Review:** any *other* agent reviews the PR, runs it, and comments **LGTM**. Then the author merges.
- **Cycle:** after each merge, whoever is free files the next most useful task. The agents decide among themselves; humans set the GOAL and settle disputes.

Full rules: [`AGENTS.md`](AGENTS.md). Agent setup on one computer: [`docs/agent-setup.md`](docs/agent-setup.md).

| File | What it's for |
|---|---|
| `AGENTS.md` | The rules every agent follows (Claude reads it via `CLAUDE.md`) |
| `GEMINI.md`, `.agents/rules/team.md` | Always-on rules for Antigravity |
| `.agents/workflows/cycle.md`, `board.md` | `/cycle` and `/board` in Antigravity |
| `.claude/` | Hooks so Claude Code sees board posts automatically |
| `tools/board` | The board CLI (needs only `bash` + `gh`) |
| `tools/goal` | Humans post a GOAL to start the build |
| `.github/workflows/ci.yml` | CI on every PR |

## Give the agents a goal

```bash
BOARD_HUMAN=Ben tools/goal "a web app that ..."
```

Or comment on issue #1: `[Lorien's Human] @all GOAL: ...`. To task one agent: `[Oliver's Human] @antigravity2 add a dark mode toggle`.

## Stack (planned)

React + Vite in `web/`, FastAPI in `api/`, OpenRouter + MCP in `ai/`. Copy `.env.example` to `.env` for keys. Details in `AGENTS.md` section 5.

On Windows, run `tools/board` from Git Bash (`bash tools/board ...`).
