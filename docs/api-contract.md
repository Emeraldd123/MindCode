# API contract (web/ ↔ api/)

The only routes the frontend may call. Any PR that adds or changes a route updates this file in the same PR and posts on the board when it lands.

Base URL: `VITE_API_URL` (default `http://localhost:8000`). All bodies are JSON. State lives in server memory (lost on restart).

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
}

interface Edge { from: string; to: string; relation: "has" | "needs" | "informs"; }

interface MindMap { nodes: Node[]; edges: Edge[]; }

interface Message { role: "user" | "assistant"; text: string; node_id?: string; } // node_id set for bubble brainstorms

interface Build {
  id: string;            // "b1", "b2", ...
  html: string;          // full standalone HTML; every traced element has data-mc="n3 n7"
  trace: Record<string, string[]>; // node id -> list of data-mc-el ids it informed
  checkpoint_id: string;
}

interface Checkpoint { id: string; label: string; turn: number; map: MindMap; build_id?: string; }

interface Session {
  id: string;
  messages: Message[];   // main chat only
  map: MindMap;
  builds: Build[];
  checkpoints: Checkpoint[];
}
```

**Traceability rule:** every element in the generated HTML that a node informed has `data-mc-el="<unique id>"` and `data-mc="<space separated node ids>"`. The preview iframe includes a small script (added by `api/`, not the LLM) that `postMessage`s `{type:"mc-hover", nodes:[...]}` to the parent on hover and listens for `{type:"mc-highlight", nodes:[...]}` to outline matching elements.

## Routes

| Method | Path | Request | Response | Status |
|---|---|---|---|---|
| GET | `/health` | — | `{ "ok": true }` | planned |
| POST | `/sessions` | — | `Session` (empty map) | planned |
| GET | `/sessions/{sid}` | — | `Session` | planned |
| POST | `/sessions/{sid}/messages` | `{ "text": string }` | `{ "reply": string, "map": MindMap, "changed": string[] }`: `changed` = new or updated node ids | planned |
| POST | `/sessions/{sid}/nodes/{nid}/chat` | `{ "text": string }` | `{ "reply": string, "node": Node, "history": Message[] }`: Claude may rewrite `label`/`detail` | planned |
| POST | `/sessions/{sid}/nodes/{nid}/approve` | — | `Node` (status `approved`) | planned |
| PATCH | `/sessions/{sid}/nodes/{nid}` | `{ "label"?, "detail"?, "status"?: "locked" \| "approved" \| "proposed" }` | `Node` | planned |
| POST | `/sessions/{sid}/build` | — | `Build` (also appends a `Checkpoint`) | planned |
| GET | `/sessions/{sid}/builds/{bid}/preview` | — | `text/html`: build HTML with the trace script injected (iframe `src`) | planned |
| GET | `/sessions/{sid}/checkpoints` | — | `Checkpoint[]` | planned |

Errors: `404 {"detail": "..."}` for unknown session/node, `502` when the LLM call fails or returns invalid JSON after one retry.

## AI module interface (`ai/` → imported by `api/`)

```python
# ai/extract.py
def update_map(messages: list[dict], current: dict) -> dict:  # returns {"reply": str, "map": MindMap}
# ai/node_chat.py
def node_chat(node: dict, map: dict, history: list[dict], text: str) -> dict:  # {"reply": str, "label": str, "detail": str}
# ai/build.py
def build_app(map: dict, previous_html: str | None) -> str:  # HTML with data-mc / data-mc-el attributes
```

All three honour `MINDCODE_FAKE_LLM=1` (deterministic canned output, no network) so tests and the UI work without a key.
