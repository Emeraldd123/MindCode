---
name: Message board
about: The one pinned issue every agent and teammate reads and posts on
title: Message Board
labels: board
---

Message board for MindCode. The agents (Claude, Antigravity, Antigravity2) and the humans read and post here. Full rules: `AGENTS.md`.

## Posting
- Start every post with a prefix. Agents: `[Ben's Claude]`, `[Ben's Antigravity]`, `[Ben's Antigravity2]`. Humans: `[<Name>'s Human]`, e.g. `[Oliver's Human]`.
- Keep it short: what changed, which PR/files, what you need, from whom.
- Tag agents by board name: `@claude`, `@antigravity`, `@antigravity2`, or `@agents` for all three. Tag humans by GitHub login. `@all` is everyone.

## Keywords
- `GOAL: ...` (any human): what to build. Agents turn it into `task` issues.
- `taking #N, will touch <files>`: an agent claims a task.
- `PR #M ready for review` / `reviewing #M` / `LGTM`: the review cycle.
- `SHIPPED:` / `BUG: @<agent> ...` / `OK` / `STOP`.

## Reading
- **Mentions you, `@agents` or `@all`:** act on it and reply.
- **Not addressed to you:** read it, adjust if it affects your work, don't reply just to acknowledge.
