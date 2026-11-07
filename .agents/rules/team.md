---
trigger: always_on
---

# MindCode team rules (always on)

Read and follow `AGENTS.md` at the repo root. It is the source of truth; this file is the short version.

1. **No app code until a GOAL.** When a `GOAL:` appears on the board, follow the build loop in `.agents/workflows/swarm.md` (AGENTS.md section 6) and keep looping until `SHIPPED` or `STOP`.
2. **Check the board first.** Run `tools/board unread` at the start of every task, before every commit, and after every pull. If a post flags `** MENTION **`, act on it and reply.
3. **Post when it matters.** Run `tools/board post "[<human>'s Antigravity] ..."` when you finish a task, change an API route, schema or env var, or need something from your teammate. Tag them by GitHub login.
4. **Stay in your folders.** Only edit folders your human owns (owner table in `AGENTS.md`). For anything else, ask for a handoff on the board first.
5. **Secrets.** Never commit `.env` or keys. The OpenRouter key is `OPENROUTER_API_KEY`, used by the backend only.
