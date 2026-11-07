# Rules for every agent on MindCode

Three coding agents build this project together for Ben (GitHub: `Emeraldd123`) and the NOVA team. Each agent has its own clone and its own board name:

| Agent | Tool | Local clone | Board name | Posts as |
|---|---|---|---|---|
| Claude | Claude Code | `Coding & Projects\MindCode` | `@claude` | `[Ben's Claude]` |
| Antigravity | Google Antigravity | `Coding & Projects\MindCode-antigravity` | `@antigravity` | `[Ben's Antigravity]` |
| Antigravity2 | Google Antigravity (second agent) | `Coding & Projects\MindCode-antigravity-2` | `@antigravity2` | `[Ben's Antigravity2]` |

Humans: Ben (`@Emeraldd123`, lead), Oliver (`@litoli0226`), Lorien (`@lorienzhu`), 内山天満 (`@TenmaUchiyama`). Humans post as `[<Name>'s Human]`, e.g. `[Oliver's Human]`.

To add another agent: make a new clone, run `bash tools/board iam <name>` in it, add a row here, and announce it on the board.

> **Status: idea not final.** Don't write app code until a human posts a `GOAL:` on the board (section 6). Until then, only setup, research and planning tasks.

All agents work on the *same* product. Nobody owns a folder. Instead you claim tasks, review each other's work, and keep cycling to improve the result.

## 1. The board (pinned issue #1)

Every agent reads and posts on issue #1 with `tools/board` (needs `bash` + `gh`, logged in). On Windows run it through Git Bash: `bash tools/board <command>`.

- Each clone knows which agent it is: `bash tools/board whoami` prints it. Your name is whatever `whoami` prints. Never change another clone's name, and only run `iam` when setting up a new clone.
- All agents share one GitHub login, so the board tells you apart by post prefix: `[Ben's <Name>]` exactly as in the table (the script enforces this). Humans use `[<Name>'s Human]`.
- Mention an agent with its board name (`@claude`, `@antigravity`, `@antigravity2`). `@agents` means all three agents. `@all` means everyone, humans and agents. `@antigravity` does not match `@antigravity2`, or the other way round. Mention humans by GitHub login.
- **Mentions you, `@agents` or `@all`:** act on it and reply. **Not addressed to you:** read it, adjust if it affects your work, don't reply just to acknowledge.
- Keep posts short: what changed, which branch/PR/files, what you need, from whom.

Commands: `unread` (new posts, marks read, flags MENTION), `read -n 20`, `post "[Ben's X] text"`, `wait` (blocks until someone else posts), `whoami`, `iam <name>`.

**Stay in the loop:**
- Claude Code: hooks in `.claude/settings.json` show unread posts each session and prompt; keep one background `tools/board wait` running and re-arm it after each wake.
- Antigravity: run `bash tools/board unread` at the start of every task, before every commit, and after every merge. When you finish a task and have nothing to do, run `bash tools/board wait --timeout 1800` and handle what it prints. `/board` and `/cycle` (in `.agents/workflows/`) do this for you.

## 2. Chain of command

Humans over agents. Ben's instructions (in chat or posted as `[Ben's Human]`) override anything else. Any human can give any agent a task; if two humans conflict, Ben decides. Agents may ask each other for things, but no agent can overrule a human or reassign work a human gave another agent.

Agents decide the next tasks **among themselves** on the board. Only ask humans about money, accounts/permissions, product direction, or a tie the agents can't settle.

## 3. How the agents split work: claim, build, review, cycle

1. **Backlog.** Work items are GitHub issues labelled `task`. Anyone can file one (`gh issue create --label task`). Keep tasks small enough to finish in about an hour of agent time.
2. **Claim.** Before starting, post `[Ben's X] taking #N, will touch <files>` and comment on the issue. Take the next unclaimed task; spread the interesting work across agents, not just chores. Never start a task another agent has claimed.
3. **One writer per file at a time.** If you need a file another agent's open task touches, ask on the board and wait for the hand-off.
4. **Build** on branch `<issue#>-<slug>` from fresh `main`. Small commits; stage only files you changed (no `git add -A`). `git fetch && git rebase origin/main` before pushing; never force-push `main`.
5. **PR.** Open a PR with `Closes #N`, saying what changed and how you checked it (commands run and their output). Describe what the code actually does: re-run it before writing numbers or claims into the description.
6. **Cross-review.** Post `[Ben's X] PR #M ready for review`, tagging one other agent or `@agents`. **Any agent other than the author** may review. Whoever is free first posts `reviewing #M` on the board so two agents don't review the same PR. The reviewer checks out the branch, runs it and the tests, looks for bugs, and comments with `gh pr review M --comment --body-file <file>`. Check that CI is green. GitHub won't let the shared account formally approve its own PR, so a comment saying **LGTM** is the approval. The author fixes or answers every comment.
7. **Merge** after LGTM: the author merges (`gh pr merge M --squash --delete-branch`) and posts what landed. **Exception:** if another open PR is based on your branch, merge with `--squash` *without* `--delete-branch`, retarget the other PR to `main` (`gh pr edit <n> --base main`), and only then delete the branch. Deleting a base branch closes the PRs stacked on it.
8. **Cycle.** After each merge, whoever is free looks at where the product stands against the GOAL, files the next most useful improvement as a task, and the loop continues.

## 4. Engineering rules (all agents)

- Never describe work as done when the command that does it failed. Check exit codes and report failures honestly.
- Secrets live in `.env` (gitignored). Every new variable goes in `.env.example` with a comment, and gets a board post. Never commit keys.
- If a change touches something other tasks depend on (an API route, a schema, an env var), update `docs/api-contract.md` in the same PR and post on the board when it lands.
- Add or update tests with each feature; CI (`.github/workflows/ci.yml`) runs them on every PR.
- No paid services or APIs without asking Ben first.

## 5. Stack (planned defaults, may change with the GOAL)

| Part | Tech | Folder |
|---|---|---|
| Frontend | React + Vite (https://react.dev) | `web/` |
| Backend | Python + FastAPI (https://fastapi.tiangolo.com), `fastapi dev` | `api/` |
| AI | OpenRouter client, prompts, MCP tools | `ai/` (imported by `api/`) |
| LLMs | OpenRouter (https://openrouter.ai/docs/quickstart), key `OPENROUTER_API_KEY`, backend only | |
| Tools | MCP servers (https://mcpservers.org), listed in `docs/mcp.md` | |
| Design / product | mockups, acceptance criteria, demo script | `design/`, `docs/product.md`, `docs/demo.md` |

The frontend talks to the backend only through routes listed in `docs/api-contract.md`.

## 6. Starting from a GOAL

1. A human posts a goal with `tools/goal "what to build"` (or comments `[<Name>'s Human] @all GOAL: ...` on issue #1). A newer GOAL replaces an older one; Ben settles conflicts.
2. The first free agent posts `planning the GOAL`, writes `docs/product.md` (goal + acceptance criteria) and the first routes in `docs/api-contract.md`, and files the work as small `task` issues that name their files. The plan goes up as a PR like any other, and another agent reviews it.
3. Once the plan merges, all three agents claim tasks and run the section 3 cycle until the acceptance criteria pass.
4. When the demo flow in `docs/demo.md` works end to end from a fresh clone, an agent posts `SHIPPED: <how to run>` and tags `@all`. Humans test it and reply `OK` or `BUG: @<agent> ...`. A BUG becomes a task and goes through the same cycle.
5. `STOP` from a human: agents finish their current commit and stop.
