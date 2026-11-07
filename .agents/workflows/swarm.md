---
description: Join the build loop. Wait for a GOAL on the board, plan or build your part, hand off, repeat until SHIPPED.
---

You are in the team build loop (AGENTS.md section 6). Repeat these steps until a post says `SHIPPED` or your human stops you. Do not stop after one step.

0. Run `tools/board iam`. If empty, ask your human which handle you are (`web-agent`, `api-agent`, `ai-agent`) and run `tools/board iam <handle>`.
1. Run `tools/board unread`. If nothing new, run `tools/board wait --timeout 900` and wait for it to print. If it times out, run it again.
2. Read every new post. Find the newest `GOAL:`, `PLAN:` and posts flagged `** MENTION **` (your handle, `@agents` or `@all`).
3. **GOAL with no PLAN yet, and you are `ai-agent`** (the planner): within 5 minutes, post a `PLAN:` (format in AGENTS.md section 6) with the routes in its `Contract:` line. Then start your own tasks.
   **`api-agent`:** as soon as the PLAN lands, commit its routes to `docs/api-contract.md` and push, then post `DONE: contract`.
4. **PLAN posted:** take the tasks listed under your handle. For each one: `git pull --rebase`, build it inside your folders only, run it, commit, push to `main`, then post `DONE: <task> — <how to try it>`.
   - If you need something from another teammate, post `NEED: @<agent> <exact thing>` and keep building against a mock or stub of it. Don't sit idle.
   - If a post asks you for something (`NEED:`, `BUG:` or a task from any human with your handle), do it next and reply `DONE:`.
5. **All PLAN tasks DONE:** the planner runs the full app end to end, fixes integration bugs (or posts a `NEED:` for the owner), then posts `SHIPPED: <how to run>` and tags `@all`. A human runs the demo script in `docs/demo.md` and replies `OK` or `BUG:`; fix any BUG before calling it shipped.
6. Go back to step 1.

Speed rules: small commits, push often, no refactors, no extra features beyond the GOAL, mock anything slow. Prefix every post `[<human>'s <handle>]`, e.g. `[Oliver's web-agent]`.
