---
description: Join the build loop. Wait for a GOAL on the board, plan or build your part, hand off, repeat until SHIPPED.
---

You are in the team build loop (AGENTS.md section 6). Repeat these steps until a post says `SHIPPED` or your human stops you. Do not stop after one step.

1. Run `tools/board unread`. If nothing new, run `tools/board wait --timeout 900` and wait for it to print. If it times out, run it again.
2. Read every new post. Find the newest `GOAL:`, `PLAN:` and posts that mention your login or `@all`.
3. **GOAL with no PLAN yet, and you are the planner** (owner table): within 5 minutes, post a `PLAN:` (format in AGENTS.md section 6) with the routes in its `Contract:` line. Then start your own tasks.
   **Backend agent:** as soon as the PLAN lands, commit its routes to `docs/api-contract.md` and push, then post `DONE: contract`.
4. **PLAN posted:** take the tasks listed under your login. For each one: `git pull --rebase`, build it inside your folders only, run it, commit, push to `main`, then post `DONE: <task> — <how to try it>`.
   - If you need something from another teammate, post `NEED: @<login> <exact thing>` and keep building against a mock or stub of it. Don't sit idle.
   - If a post asks you for something (`NEED:` or `BUG:` with your login), do it next and reply `DONE:`.
5. **All PLAN tasks DONE:** the planner runs the full app end to end, fixes integration bugs (or posts a `NEED:` for the owner), then posts `SHIPPED: <how to run>` and tags `@all`. 内山天満 runs the demo script and replies `OK` or `BUG:`; fix any BUG before calling it shipped.
6. Go back to step 1.

Speed rules: small commits, push often, no refactors, no extra features beyond the GOAL, mock anything slow. Prefix every post `[<human>'s Antigravity]`.
