# Running the three agents on one computer

Claude Code and two Google Antigravity agents each work in their **own clone** of this repo, so they never overwrite each other's files or board state. They all share Ben's GitHub login and tell each other apart by board name.

## 1. One-time setup

- Install [Git](https://git-scm.com) (on Windows this includes **Git Bash**) and the [GitHub CLI](https://cli.github.com), then run `gh auth login` once.

## 2. One clone per agent

From Git Bash, in `Downloads/Coding & Projects`:

```bash
git clone https://github.com/Emeraldd123/MindCode MindCode
git clone https://github.com/Emeraldd123/MindCode MindCode-antigravity
git clone https://github.com/Emeraldd123/MindCode MindCode-antigravity-2
(cd MindCode && bash tools/board iam claude)
(cd MindCode-antigravity && bash tools/board iam antigravity)
(cd MindCode-antigravity-2 && bash tools/board iam antigravity2)
```

Check each: `bash tools/board whoami` prints the GitHub login and `agent: <name>`. The name is stored in `.board/agent` (gitignored), so it survives pulls.

## 3. Claude Code

Open `MindCode` in Claude Code. The hooks in `.claude/settings.json` show unread board posts at the start of every session and every prompt, and Claude keeps one background `tools/board wait` running. To let Claude merge reviewed PRs without asking each time, allow `Bash(gh pr merge:*)` in your local `.claude/settings.local.json` (gitignored).

## 4. Antigravity (two agents)

- Open `MindCode-antigravity` and `MindCode-antigravity-2` as two separate workspaces. Antigravity loads `GEMINI.md` and `.agents/rules/team.md` automatically.
- Set terminal command execution so the agents can run commands without asking each time (auto-execute, or at least allow `bash tools/board`, `git`, `gh`, `npm`, `pip`/`uv`, `fastapi`). Otherwise every `tools/board wait` pauses for your click and the loop stalls.
- Antigravity's terminal may default to PowerShell; the rules tell agents to call `bash tools/board ...`.
- In each workspace, start a conversation and type `/cycle`.

## 5. Give the goal

```bash
BOARD_HUMAN=Ben tools/goal "your idea here"
```

The first free agent plans it into `task` issues; then all three claim, build, review and merge (AGENTS.md sections 3 and 6). If an Antigravity agent finishes and stops looping, type `/cycle` again.

## Teammates

Oliver, Lorien and 内山天満 don't need to run agents. They watch issue #1, post goals or tasks as `[<Name>'s Human]`, and test `SHIPPED:` posts. To give them push access, Ben invites them as collaborators.
