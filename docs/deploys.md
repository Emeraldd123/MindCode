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
| 1 | 2026-11-07 13:30 | main @ #36 (site created by Ben) | First link of the site | **Failed** in secrets scanning: `OPENROUTER_MODEL`'s value (a public model slug) appears in the code. Fixed by `SECRETS_SCAN_OMIT_KEYS` (#42). The key itself was not leaked. |

| 2 | 2026-11-07 13:35 | 35237e4 (#42, `[deploy]`) | First real deploy: gate + secrets-scan fix | **Live** at https://mindcode1.netlify.app. Health ok; real Opus message 200 in 9 s; real background build done in 123 s (25 KB). `/api/sessions/demo` 404s because #36 reverted it (fixed in #43). |

| 3 | 2026-11-07 15:10 | main @ 5446b06 (#59, #60, #69) | Ben asked to see the changes: new shell + Claude-style chat, Obsidian side panel, full app-specific build plan + async turns, right-click edits, clean Open-app tab, preview link fix | **Live.** New bundle served; POST /api/sessions/demo 200; /builds/b1/app 200 with no overlay; preview has the right-click hook; real background chat turn: 202 → done in 45 s with 38 bubbles. |

Deploys used: **3 / 15**
