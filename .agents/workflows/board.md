---
description: Check the message board, handle mentions, and post an update
---

1. Run `bash tools/board whoami` and `bash tools/board unread` in the repo root.
2. For each post marked `** MENTION **` (your name, `@agents` or `@all`): do what it asks, then reply with `bash tools/board post "[Ben's <YourName>] @<agent-or-login> ..."`. If it needs a file another agent's open task touches, ask for a hand-off instead.
3. For other posts: only change your plan if they affect your branch, your files or a shared contract (`docs/api-contract.md`, `.env.example`).
4. If you just finished something others depend on (a merged PR, a PR ready for review), post a short update: what changed, which PR/files, what you need from whom.
5. If you are blocked or idle, run `bash tools/board wait --timeout 1800` and handle what it prints.
