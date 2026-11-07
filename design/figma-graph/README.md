# Figma → Graph (mind map) hand-off

Drop the Figma export for the **Graph** (mind map pane) here, as-is:

- Figma file: https://www.figma.com/design/E9vRyDMfgEeXy5kyMKxXGb/Hackathon?node-id=16-284
- Put generated code (React/JSX, CSS, Tailwind, SVG) in this folder, e.g. `design/figma-graph/export/`.
- Also add a PNG screenshot of each frame/state (`node-user.png`, `node-ai.png`, …) so the result can be checked visually.

This folder is reference only. The code that ships lives in `web/src/` (see below).

## What the design replaces vs. what stays

| Part | File | Swap with Figma? |
|---|---|---|
| Bubble look (shape, colors, fonts, shadows, badges, tooltip) | `web/src/MindMap.jsx` → `MindMapNode`, `web/src/mindmap.css` | **Yes** |
| Branch line colors/width/dash | `MindMap.jsx` → `edgeStyle()`, `branchEdges()` | **Yes** (values only) |
| Legend, empty state, background grid, controls, minimap colors | `MindMap.jsx` (bottom), `mindmap.css` | **Yes** |
| Bubble sizes by depth/importance | `MindMap.jsx` → `DEPTH_SIZES`, `bubbleSize()` | Values only |
| Radial layout (positions) | `MindMap.jsx` → `radialLayout()` | No (logic; keep) |
| Data shape, props, click/select | `MindMap` props, `docs/api-contract.md` | No |

Figma code is static: it doesn't know about React Flow, so it gets ported into `MindMapNode` +
`mindmap.css`, not pasted in as a whole component.

## States the design must cover

Each bubble is a `MapNode` (see `docs/api-contract.md`). These are the visual states and the CSS class
`bubbleClass()` already puts on the bubble for each:

| State | Class | Current look |
|---|---|---|
| User wrote it | `source-user` | orange `#d67408` |
| AI assumed, obvious | `source-inferred source-inferred-low` | pale green |
| AI assumed, creative leap (inventiveness ≥ 0.6) | `source-inferred-high has-creative-leap` | deep green `#17c894` + ✦ badge |
| Unknown / needs a decision | `source-unknown` | red `#ef4444` + ? badge |
| Approved | `status-approved` | white + ✓ corner badge |
| Locked | `status-locked` | 🔒 badge |
| Depth: center / branch / leaf | `depth-0` / `depth-1` / `depth-2` | 180 / 128 / 100 px circles |
| Importance 1–5 | `importance-1` … `importance-5` | size ×0.88 … ×1.12 |
| Selected (clicked) | `node-selected` | |
| Highlighted (chat hover) | `node-highlighted` | |
| Just changed by the AI | `node-changed` | |
| Kind icon (goal, feature, page, component, data, api, style, constraint) | `.mindmap-kind-icon` | emoji, `KIND_ICONS` |
| Hover tooltip (detail + evidence quotes) | `.mindmap-tooltip` | |

Edges: `has` (slate solid), `needs` (light slate, animated), `informs` (sky blue dashed).

Palette rule from Ben: **user = orange, AI = green**, approved = white (not green).
If the Figma design changes that, check with Ben first.

## Apply checklist

1. Export lands in this folder + screenshots.
2. Port styles into `web/src/mindmap.css` (keep the class names above) and markup into `MindMapNode`.
3. Update `edgeStyle()` / `DEPTH_SIZES` values and `MindMap.test.js` expectations if they change.
4. `npm test --prefix web` and check the map in `npx netlify dev` with every state above visible.

## Extracted: node 16-284 "Branding drill-in, Mono"

Cleaned CSS: `export/graph.css`. Structure of the graph pane (Frame 3, 1036.8 × 1117, bg `#1F1E1D`):

```
Graph pane
├─ Drill-in header
│  ├─ Breadcrumb: [←] Project map / Design / Branding
│  ├─ Title "Branding" (Source Serif 4, 40px)
│  ├─ Summary "4 decisions inside · 2 Claude guesses to confirm · 2 need your answer"
│  └─ Legend: Status chips ("assumed", "need info")
├─ Lens: 960px circle = the topic you drilled into, overline "INSIDE BRANDING"
│  ├─ Decision "Logo"          needs info  → Option tiles ×3 (Claude's pick outlined) + "Blocked: no product name yet"
│  ├─ Decision "Tone of voice" assumed     → Sliders ×4 (5-point, two poles) + "Guessed from your prompt · drag to change"
│  ├─ Decision "Typeface"      assumed     → Option tiles ×2 (Serif / Sans) + "Claude's guess: Sans serif · tap to switch"
│  └─ Decision "Tagline"       needs info  → Radios ×3 + "+ Write my own"
└─ Actions: [Confirm 2 guesses] [Back to map]
```

Status vocabulary (Status chip component): **Clear** (solid, `#141413` on `#ECEAE3`),
**Assumed** (dashed, `#73726C` on `#F3F1EA`), **Needs info** (dotted, `#B4532F` on `#F8E3DA`).
Accent `#C6613F` = Claude's pick / primary action.
