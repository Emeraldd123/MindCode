# Product: MindCode

## Goal

MindCode is a prompt engineering tool for building apps with Claude. It turns a prompt into a logical structure you can see and edit.

While the user chats with Claude about the app they want, a **mind map** fills in live next to the chat. Each idea is a bubble, colored by where it came from:

| Source | Meaning | Look |
|---|---|---|
| `user` | The user said it | solid, orange **#d67408** |
| `inferred` | Claude assumed it; the user never said it | dashed, green **#17c894** (AI). Pale for low inventiveness (an obvious step), deep for high (a creative leap) |
| `unknown` | It needs a decision, but nobody has made one | outlined in red with a "?" |
| `approved` | The user agreed to it after discussing it with Claude | bold white ✓ badge + thicker border in its own source color (green is reserved for AI) |

The user clicks a bubble to brainstorm about it with Claude, then presses **Approve** once they agree. When ready, they press **Build**, and Claude generates the app (one HTML page) from the map. **Every element of the built app traces back to the bubbles that informed it.** Hover the page title in the preview and the bubbles that shaped it light up. Click a bubble and the parts of the page it shaped are highlighted.

**Who it's for:** builders who are willing to take on some extra mental effort in exchange for control and understanding.

**The problem today:** users scroll back through long chats, accept big tool calls and artifacts built on things that were never discussed and that Claude guessed wrong, and never learn to spot unknowns the way an expert teammate would. The user still writes full natural-language sentences. MindCode makes Claude break them down into a logical structure, and that structure then drives the code.

**User story:** Ben wants to make a web app and starts talking to Claude. He mentions a "chat app", and the map adds an `API` bubble in amber because Claude is assuming it and Ben never mentioned one. Ben clicks it, discusses it with Claude, and approves it. He presses Build. In the preview, he hovers the hero image and sees which bubbles produced it.

## Kano priorities

**Must have (the demo fails without these)**
1. **Prompt reconstruction:** each chat message updates the mind map: bubbles plus parent/child links, each with its source and the user quote that supports it.
2. **Visible sources:** the user / inferred / unknown / approved colors, plus inventiveness shading for inferred bubbles.
3. **Brainstorm and approve:** click a bubble, chat about it with Claude, which can rewrite the bubble, then Approve.
4. **Build with traceability:** the built HTML tags each element with the bubbles behind it. Hovering in either direction highlights the match in the other view.
5. **Checkpoints:** every Build (plus any message that changes the map a lot) is saved as a checkpoint on a timeline. Clicking one shows the map as it was then.

**Nice to have (after the 15:00 demo cut)**
6. **Importance layer:** each bubble gets an importance score (1-5); important bubbles are drawn bigger, and a "Needs your attention" list shows important unknown or inferred bubbles that aren't approved yet.
7. **Lock:** a locked bubble keeps its text, and Build can't change the code it informed unless the user unlocks it.

**Out of scope:** login, multiple users, saving to a database (all state lives in server memory), multi-file apps, deployment of the built app.

## Acceptance criteria

- [ ] Typing "I want a chat app for my study group" produces at least 5 bubbles within 10 s, with at least one `user`, one `inferred` and one `unknown`.
- [ ] Bubble colors match the source table above; inferred bubbles show two clearly different shades for low vs high inventiveness.
- [ ] Clicking a bubble opens a side chat; Claude's reply can update the bubble's text; **Approve** turns it green and the change survives a page reload.
- [ ] **Build** shows the generated app in a preview within 30 s.
- [ ] Hovering any tagged element in the preview highlights its bubbles; clicking a bubble outlines its elements in the preview.
- [ ] Each Build adds a checkpoint; clicking an older checkpoint shows that map (read-only).
- [ ] With `MINDCODE_FAKE_LLM=1` the whole flow runs with no API key (canned responses), and CI tests use that mode.
- [ ] `docs/demo.md` runs end to end from a fresh clone in under 3 minutes.
- [ ] (nice) "Needs your attention" list ordered by importance; locked bubbles survive a rebuild unchanged.
