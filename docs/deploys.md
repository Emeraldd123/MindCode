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

| 4 | 2026-11-07 15:55 | main (#72, #77, #79, #83, #84) | Fixes Ben's 'cut off before </html>' build failure; ship-ready builds (no Assumed boxes); add/connect/edit/delete bubbles; re-recorded demo | **Live.** Demo 35 bubbles, 0 Assumed in its app, POST /nodes 201. |

| 5 | 2026-11-07 16:25 | main (#82, #76, #87, #88, #95) | Tree map view + Tree/Graph toggle + breadcrumb; right-click edits ~7 s and small rebuilds ~20 s (patches); robust JSON parsing; no reused bubble ids | **Live.** New bundle has the Tree/Graph toggle. |

| 6 | 2026-11-07 16:45 | main (#102 + Jules merges) | Pin mode in the preview; right-click bubble-id fix; compact header | **Live.** Bundle has Pin (mc-inspect). |

| 7 | 2026-11-07 17:00 | main (#104) | Ben raised the OpenRouter key limit; readable AI errors (402/401/429), no retry on credit errors | **Live.** Real chat turn 37 bubbles in 40 s. |

| 8 | 2026-11-07 16:35 | main (#107, #$N) | API limits (protects the key), bubble suggestions, quality score, Jules docs/tests | (verify) |

| 9 | 2026-11-07 | main @ ac902c8 (#112) | Tenma's drill-in graph UI; Attention collapsed | **Live.** |
| 10 | 2026-11-07 (FINAL) | Tenma 0fe09b4 + Jules #113, #114, #106 + case-safe import fix | Final release: graph recommendations, quality report in preview, friendly limit messages, eval harness | (verify) |

Deploy budget: Ben says this is the **last** deploy.
