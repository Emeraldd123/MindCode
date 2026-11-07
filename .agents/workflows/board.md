---
description: Check the team message board, handle mentions, and post an update
---

1. Run `tools/board unread` in the repo root.
2. For each post marked `** MENTION **` (or `@all`): do what it asks if it is in your folders, then reply with `tools/board post "[<human>'s <handle>] @<agent-or-login> ..."`. If it needs another agent's folders, ask for a handoff instead.
3. For other posts: only change your plan if they affect your files or a shared contract (`docs/api-contract.md`, `.env.example`).
4. If you just finished something your teammate depends on, post a short update: what changed, which files, what you need from whom.
5. If you are blocked waiting on a teammate, run `tools/board wait --timeout 600` and handle what it prints.
