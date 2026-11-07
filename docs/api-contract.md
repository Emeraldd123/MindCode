# API contract (web/ ↔ api/)

The only routes the frontend may call. Any PR that adds or changes a route updates this file in the same PR and posts on the board when it lands.

Base URL: same origin, paths start with `/api` (served by `netlify/functions/api.mts`; locally `npx netlify dev` on http://localhost:8888). All bodies are JSON. Sessions are stored in Netlify Blobs (store `sessions`, key = session id).

## Types

```ts
type Source = "user" | "inferred" | "unknown";
type Status = "proposed" | "approved" | "locked";

interface Node {
  id: string;            // "n1", "n2", ... stable within a session
  label: string;         // 1-5 words, shown in the bubble
  detail: string;        // one or two sentences
  kind: "goal" | "feature" | "page" | "component" | "data" | "api" | "style" | "constraint";
  source: Source;        // who it came from (never changes after creation)
  inventiveness: number; // 0..1, only meaningful for "inferred" (0 = obvious, 1 = creative leap)
  importance: number;    // 1..5, how much the user should weigh in
  status: Status;
  parent: string | null; // tree parent node id; root goal has null
  evidence: string[];    // exact user quotes that support it (empty for inferred/unknown)
  turn: number;          // chat turn that created it
  facet?: "design" | "audience" | "functionality" | "cost" | "goal"; // Ben's prompt-engineering facet (ai/taxonomy.ts). Optional; UI may group/color by it.
}

interface Edge { from: string; to: string; relation: "has" | "needs" | "informs"; }

interface MindMap { nodes: Node[]; edges: Edge[]; }

interface Message { role: "user" | "assistant"; text: string; node_id?: string; } // node_id set for bubble brainstorms

interface BuildAudit {
  totalElements: number;
  tracedElements: number;
  coveragePct: number;
  nodeBreakdown: Record<string, number>;
  untracedNodes: string[];
}

interface Build {
  id: string;            // "b1", "b2", ...
  status: "pending" | "done" | "error"; // builds run in a background function; poll until not pending
  error?: string;
  html: string;          // full standalone HTML; every traced element has data-mc="n3 n7"
  trace: Record<string, string[]>; // node id -> list of data-mc-el ids it informed
  checkpoint_id: string;
  audit?: BuildAudit;    // server-side traceability audit metrics
}

interface Checkpoint { id: string; label: string; turn: number; map: MindMap; build_id?: string; }

interface Turn { status: "pending" | "done" | "error"; error?: string; changed: string[]; started_at: number }

interface Session {
  id: string;
  messages: Message[];   // main chat only
  map: MindMap;
  builds: Build[];
  checkpoints: Checkpoint[];
  turn?: Turn | null;  // latest chat turn (async on Netlify)
  next_node_seq?: number;
}
```

**Traceability rule:** every element in the generated HTML that a node informed has `data-mc-el="<unique id>"` and `data-mc="<space separated node ids>"`. The preview iframe includes a small script (added by `api/`, not the LLM) that `postMessage`s `{type:"mc-hover", nodes:[...]}` to the parent on hover and listens for `{type:"mc-highlight", nodes:[...]}` to outline matching elements.

## Routes

| Method | Path | Request | Response | Status |
|---|---|---|---|---|
| GET | `/api/health` | - | `{ "ok": true }` | built |
| POST | `/api/sessions` | - | `Session` (empty map) | built |
| POST | `/api/sessions/demo` | - | `Session`: a fresh, independent copy of the recorded real-Opus demo session (`api/demo/study-group.json`: 8 bubbles, 3 approved, finished traced build b1, 2 checkpoints). The web app calls it for `/?demo=1`. | built |
| GET | `/api/sessions/{sid}` | - | `Session` | built |
| POST | `/api/sessions/{sid}/messages` | `{ "text": string }` | **202** `{ "pending": true, "turn": Turn }` on Netlify: the turn runs in the `turn-background` function (a full plan from Opus takes ~40 s, past the 30 s sync limit). Poll `GET /api/sessions/{sid}` until `turn.status` is `done` (then read `messages`, `map`, `turn.changed`) or `error` (`turn.error`; the user message is removed). Fake mode/tests: 200 `{ "reply", "map", "changed" }`. 409 while a turn is pending. | built |
| POST | `/api/sessions/{sid}/nodes` | `{ "label": string, "detail"?: string, "kind"?: Node["kind"], "parent"?: string \| null }` | `Node` (201 Created) | built |
| DELETE | `/api/sessions/{sid}/nodes/{nid}` | - | `{ "ok": true, "id": string }` (200 OK; re-parents children and cleans up connected edges) | built |
| POST | `/api/sessions/{sid}/edges` | `{ "from": string, "to": string, "relation"?: Edge["relation"] }` | `Edge` (201 Created) | built |
| DELETE | `/api/sessions/{sid}/edges` | `{ "from": string, "to": string }` or `?from={from}&to={to}` | `{ "ok": true, "from": string, "to": string }` (200 OK) | built |
| POST | `/api/sessions/{sid}/nodes/{nid}/chat` | `{ "text": string }` | `{ "reply": string, "node": Node, "history": Message[] }`; Claude may rewrite `label`/`detail` (not if locked) | built |
| POST | `/api/sessions/{sid}/nodes/{nid}/approve` | - | `Node` (status `approved`; a locked node stays locked) | built |
| PATCH | `/api/sessions/{sid}/nodes/{nid}` | `{ "label"?, "detail"?, "status"?: "locked" \| "approved" \| "proposed" }` | `Node` | built |
| GET | `/api/sessions/{sid}/map/export` | Query: `format=mermaid` or `json` (default: `json`) | `text/vnd.mermaid; charset=utf-8` (Mermaid flowchart) or `application/json; charset=utf-8` (`{ id, exportedAt, nodes, edges }` with `Content-Disposition: attachment; filename="mindcode-map-{sid}.json"`) | built |
| POST | `/api/sessions/{sid}/build` | - | `Build`: **202 + status `pending`** (poll), or 200 when already finished (fake mode). Also appends a `Checkpoint`. 409 if a build is already pending. | built |
| GET | `/api/sessions/{sid}/builds/{bid}` | - | `Build` (poll every ~2 s until status is `done` or `error`) | built |
| GET | `/api/sessions/{sid}/builds/{bid}/preview` | - | `text/html`: build HTML with the trace script injected (iframe `src`); 409 until done | built |
| GET | `/api/sessions/{sid}/builds/{bid}/download` | - | `text/html`: standalone HTML with `Content-Disposition: attachment; filename="mindcode-${bid}.html"`; 409 until done | built |
| GET | `/api/sessions/{sid}/checkpoints` | - | `Checkpoint[]` | built |
| POST | `/api/sessions/{sid}/checkpoints/{cid}/restore` | - | Session: restores session map to checkpoint map state and records a restore checkpoint | built |

Errors: `404 {"detail": "..."}` for unknown session/node, `502` when the LLM call fails or returns invalid JSON after one retry.

## AI module interface (`ai/`, wired in `api/ai.ts`)

```ts
// see api/types.ts: interface AI
updateMap(messages: Message[], current: MindMap): Promise<{ reply: string; map: ProposedMap }>;
nodeChat(node: Node, map: MindMap, history: Message[], text: string): Promise<{ reply: string; label?: string; detail?: string }>;
buildApp(map: MindMap, previousHtml: string | null): Promise<string>; // HTML with data-mc / data-mc-el
```

`updateMap` may return partial nodes; the API fills defaults and enforces the rules: approved/locked nodes are never changed, `source` is fixed at creation (one exception: an `unknown` the user answers, with a quote, becomes `user`), only the user approves, and omitted nodes are kept. `updateMap` and `nodeChat` must finish well inside the 30 s function limit (cap `max_tokens`). `buildApp` runs in the background function (15 min).

With `MINDCODE_FAKE_LLM=1`, `api/ai.ts` uses deterministic canned output (no network, no key), and builds run inline.
