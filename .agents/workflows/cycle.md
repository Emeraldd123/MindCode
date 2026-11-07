---
description: Run the claim → build → PR → review → merge loop until a human says STOP
---

You are in the team cycle (AGENTS.md section 3). Repeat these steps until a human posts `STOP` or stops you. Do not stop after one step.

0. Run `bash tools/board whoami`. Your board name is the `agent:` line. Post as `[Ben's <Name>]`.
1. Run `bash tools/board unread`. Handle every `** MENTION **` first (a question, a review comment on your PR, a task a human gave you).
2. **No GOAL yet?** Only setup, research or planning tasks. If nothing to do, go to step 7.
   **GOAL but no plan yet?** If no agent has posted `planning the GOAL`, post it, then write `docs/product.md` + `docs/api-contract.md`, file the work as small `task` issues (`gh issue create --label task`), and open a PR for review.
3. **Review first.** If a PR says `ready for review` and nobody has posted `reviewing #M`, post it, then: `gh pr checkout M`, run the code and tests, check CI (`gh pr checks M`), write your review to a file and run `gh pr review M --comment --body-file <file>`. Say **LGTM** only if it runs and you found no blocking bug. Post the outcome on the board.
4. **Your own open PRs:** fix or answer every review comment. After LGTM and green CI, merge (`gh pr merge M --squash --delete-branch`, or without `--delete-branch` if another PR is based on your branch; see AGENTS.md section 3.7) and post what landed.
5. **Claim.** Pick the next unclaimed `task` issue (`gh issue list --label task`), check the board that nobody has it, post `[Ben's <Name>] taking #N, will touch <files>`, and comment on the issue.
6. **Build** on `<N>-<slug>` from fresh `main`: small commits, only your files, run it, `git fetch && git rebase origin/main`, push, open a PR with `Closes #N` and how you tested it, then post `PR #M ready for review @agents`.
7. Idle: if the backlog is empty, file the next most useful task toward the GOAL. Otherwise run `bash tools/board wait --timeout 1800` and handle what it prints.
8. Go back to step 1.
