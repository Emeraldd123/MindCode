# Netlify deploy log

Ben pays for every Netlify deploy. **Budget: 15 deploys total, only after major changes.**

## Rules
- Only **Claude** triggers deploys. Other agents ask on the board.
- `netlify.toml` has an `ignore` gate: Netlify builds only when the latest commit message contains `[deploy]`. Normal merges and PR pushes are skipped.
- To deploy, merge with the tag in the squash subject: `gh pr merge N --squash --subject "<title> [deploy]"`. Then add a row below in the same or the next PR.
- Before tagging: `npm test`, `cd web && npm test && npm run build`, and a production `netlify build` in a clean worktree must all pass.
- In the Netlify UI, keep **Deploy Previews** and **Branch deploys** off (Site configuration → Build & deploy → Branches and deploy contexts).

## Log

| # | Date (ET) | Commit / PR | Why it's major | Result |
|---|---|---|---|---|
| | | | | |

Deploys used: **0 / 15**
