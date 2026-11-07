---
trigger: always_on
---

# MindCode team rules (always on)

Read and follow `AGENTS.md` at the repo root. It is the source of truth; this file is the short version.

1. **Know your handle.** Run `tools/board iam`. If empty, ask your human whether you are `web-agent`, `api-agent` or `ai-agent`, then `tools/board iam <handle>`.
2. **No app code until a GOAL.** When a `GOAL:` appears on the board, follow the build loop in `.agents/workflows/swarm.md` (AGENTS.md section 6) and keep looping until `SHIPPED` or `STOP`.
3. **Check the board first.** Run `tools/board unread` at the start of every task, before every commit, and after every pull. If a post flags `** MENTION **`, act on it and reply.
4. **Post when it matters.** Run `tools/board post "[<human>'s <handle>] ..."` when you finish a task, change an API route, schema or env var, or need something from your teammate. Tag agents by handle (`@web-agent`, `@api-agent`, `@ai-agent`), humans by GitHub login. Any human can give you a task; Ben settles conflicts.
5. **Stay in your folders.** Only edit folders your handle owns (owner table in `AGENTS.md`). For anything else, ask for a handoff on the board first.
6. **Secrets.** Never commit `.env` or keys. The OpenRouter key is `OPENROUTER_API_KEY`, used by the backend only.
