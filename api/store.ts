// Pure session logic: no I/O. Persistence is in storage.ts.
import type { Checkpoint, Edge, MapNode, MindMap, ProposedMap, Session } from "./types";

/** A message that adds/changes at least this many nodes also gets a checkpoint. */
export const BIG_CHANGE = 3;
const PROTECTED = new Set(["approved", "locked"]);
const KINDS = new Set(["goal", "feature", "page", "component", "data", "api", "style", "constraint"]);
const SOURCES = new Set(["user", "inferred", "unknown"]);
const RELATIONS = new Set(["has", "needs", "informs"]);
const FACETS = new Set(["design", "audience", "functionality", "cost", "goal"]);

export function newSession(id: string): Session {
  return { id, messages: [], map: { nodes: [], edges: [] }, builds: [], checkpoints: [], node_chats: {}, next_node_seq: 1 };
}

export function publicSession(s: Session) {
  const { node_chats: _, ...rest } = s;
  return rest;
}

export const findNode = (s: Session, nid: string) => s.map.nodes.find((n) => n.id === nid);
export const userTurn = (s: Session) => s.messages.filter((m) => m.role === "user").length;

export function ensureNextNodeSeq(s: Session): number {
  if (typeof s.next_node_seq === "number" && Number.isFinite(s.next_node_seq)) {
    return s.next_node_seq;
  }
  let max = 0;
  const check = (id?: string) => {
    const m = id?.match(/^n(\d+)$/);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num > max) max = num;
    }
  };
  for (const n of s.map?.nodes ?? []) check(n.id);
  for (const cp of s.checkpoints ?? []) {
    for (const n of cp.map?.nodes ?? []) check(n.id);
  }
  for (const b of s.builds ?? []) {
    if (b.trace) {
      for (const nid of Object.keys(b.trace)) check(nid);
    }
  }
  s.next_node_seq = max + 1;
  return s.next_node_seq;
}

export function allocNodeId(s: Session, existingIds?: Set<string>): string {
  ensureNextNodeSeq(s);
  while (true) {
    const seq = s.next_node_seq!++;
    const id = `n${seq}`;
    if (!existingIds || !existingIds.has(id)) {
      return id;
    }
  }
}

const clamp = (x: unknown, lo: number, hi: number, dflt: number) => {
  const v = Number(x);
  return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : dflt;
};

/**
 * Apply an AI-proposed map; return ids of new or changed nodes.
 * Rules the AI can't break: approved/locked nodes keep their content, a node's source never
 * changes after creation, only the user approves/locks, and nodes the AI omits are kept.
 */
export function mergeMap(s: Session, proposed: ProposedMap, turn: number): string[] {
  const old = new Map(s.map.nodes.map((n) => [n.id, n]));
  const out = new Map<string, MapNode>(s.map.nodes.map((n) => [n.id, structuredClone(n)]));
  const changed: string[] = [];
  const renamed = new Map<string, string>();

  ensureNextNodeSeq(s);
  for (const raw of proposed.nodes ?? []) {
    let nid = typeof raw.id === "string" ? raw.id : "";
    if (!nid || (!old.has(nid) && out.has(nid))) {
      const fresh = allocNodeId(s, new Set(out.keys()));
      if (nid) renamed.set(nid, fresh);
      nid = fresh;
    } else if (!old.has(nid)) {
      // New node proposed with an id. If id is of format n(\d+), advance next_node_seq so future allocations never reuse it.
      const m = nid.match(/^n(\d+)$/);
      if (m) {
        const num = parseInt(m[1], 10);
        if (num >= (s.next_node_seq ?? 1)) {
          s.next_node_seq = num + 1;
        }
      }
    }
    const prev = old.get(nid);
    if (prev && PROTECTED.has(prev.status)) continue;
    const n: MapNode = {
      id: nid,
      label: String(raw.label ?? prev?.label ?? "Idea"),
      detail: String(raw.detail ?? prev?.detail ?? ""),
      kind: (KINDS.has(raw.kind as string) ? raw.kind : prev?.kind ?? "feature") as MapNode["kind"],
      // Source is fixed at creation, with one exception: an open question the user has now answered
      // (unknown -> user, backed by a quote) becomes the user's own idea.
      source: prev
        ? prev.source === "unknown" && raw.source === "user" && Array.isArray(raw.evidence) && raw.evidence.length > 0
          ? "user"
          : prev.source
        : ((SOURCES.has(raw.source as string) ? raw.source : "inferred") as MapNode["source"]),
      inventiveness: clamp(raw.inventiveness, 0, 1, prev?.inventiveness ?? 0),
      importance: Math.round(clamp(raw.importance, 1, 5, prev?.importance ?? 3)),
      status: prev ? prev.status : "proposed",
      parent: raw.parent === undefined ? prev?.parent ?? null : raw.parent,
      evidence: Array.isArray(raw.evidence) ? raw.evidence.map(String) : prev?.evidence ?? [],
      turn: prev?.turn ?? turn,
    };
    const facet = FACETS.has(raw.facet as string) ? (raw.facet as MapNode["facet"]) : prev?.facet;
    if (facet) n.facet = facet;
    if (!prev) changed.push(nid);
    else if ((["label", "detail", "kind", "source", "parent", "importance", "inventiveness"] as const).some((k) => n[k] !== prev[k]))
      changed.push(nid);
    out.set(nid, n);
  }

  for (const n of out.values()) {
    if (n.parent && renamed.has(n.parent)) n.parent = renamed.get(n.parent)!;
    if (n.parent && (!out.has(n.parent) || n.parent === n.id)) n.parent = null;
  }

  const edges: Edge[] = [];
  const seen = new Set<string>();
  for (const e of [...(proposed.edges ?? []), ...s.map.edges]) {
    const from = renamed.get(e.from as string) ?? (e.from as string);
    const to = renamed.get(e.to as string) ?? (e.to as string);
    const relation = (RELATIONS.has(e.relation as string) ? e.relation : "has") as Edge["relation"];
    const key = `${from}|${to}|${relation}`;
    if (out.has(from) && out.has(to) && from !== to && !seen.has(key)) {
      seen.add(key);
      edges.push({ from, to, relation });
    }
  }

  s.map = { nodes: [...out.values()], edges };
  return changed;
}

export function addNode(
  s: Session,
  input: { label: string; detail?: string; kind?: MapNode["kind"]; parent?: string | null }
): MapNode {
  const nid = allocNodeId(s, new Set(s.map.nodes.map((n) => n.id)));
  const parent = input.parent && s.map.nodes.some((n) => n.id === input.parent) ? input.parent : null;
  const node: MapNode = {
    id: nid,
    label: input.label.trim(),
    detail: input.detail?.trim() || "",
    kind: (KINDS.has(input.kind as string) ? input.kind : "feature") as MapNode["kind"],
    source: "user",
    status: "approved",
    inventiveness: 0,
    importance: 3,
    evidence: [],
    turn: userTurn(s),
    parent,
  };
  s.map.nodes.push(node);
  if (parent) {
    if (!s.map.edges.some((e) => e.from === parent && e.to === node.id && e.relation === "has")) {
      s.map.edges.push({ from: parent, to: node.id, relation: "has" });
    }
  }
  return node;
}

export function removeNode(s: Session, nid: string): boolean {
  const node = s.map.nodes.find((n) => n.id === nid);
  if (!node) return false;
  const parent = node.parent;

  s.map.nodes = s.map.nodes.filter((n) => n.id !== nid);
  s.map.edges = s.map.edges.filter((e) => e.from !== nid && e.to !== nid);

  for (const child of s.map.nodes) {
    if (child.parent === nid) {
      child.parent = parent;
      if (parent) {
        if (!s.map.edges.some((e) => e.from === parent && e.to === child.id && e.relation === "has")) {
          s.map.edges.push({ from: parent, to: child.id, relation: "has" });
        }
      }
    }
  }

  return true;
}

export function addEdge(
  s: Session,
  edge: { from: string; to: string; relation?: Edge["relation"] }
): Edge {
  const { from, to } = edge;
  const relation = (RELATIONS.has(edge.relation as string) ? edge.relation : "has") as Edge["relation"];
  if (!s.map.nodes.some((n) => n.id === from) || !s.map.nodes.some((n) => n.id === to) || from === to) {
    throw new Error("invalid nodes for edge");
  }
  const existing = s.map.edges.find((e) => e.from === from && e.to === to && e.relation === relation);
  if (existing) return existing;
  const newEdge: Edge = { from, to, relation };
  s.map.edges.push(newEdge);
  return newEdge;
}

export function removeEdge(s: Session, from: string, to: string): boolean {
  const initLen = s.map.edges.length;
  s.map.edges = s.map.edges.filter((e) => !(e.from === from && e.to === to));
  return s.map.edges.length < initLen;
}

export function addCheckpoint(s: Session, label: string, buildId?: string): Checkpoint {
  const cp: Checkpoint = { id: `c${s.checkpoints.length + 1}`, label, turn: userTurn(s), map: structuredClone(s.map) };
  if (buildId) cp.build_id = buildId;
  s.checkpoints.push(cp);
  return cp;
}

const attr = (tag: string, name: string) =>
  tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(1).find((v) => v !== undefined);

/** node id -> data-mc-el ids it informed. Unknown node ids are ignored. */
export function traceOf(html: string, nodeIds: Set<string>): Record<string, string[]> {
  const trace: Record<string, string[]> = {};
  for (const [tag] of html.matchAll(/<[a-zA-Z][^>]*>/g)) {
    const el = attr(tag, "data-mc-el");
    const ids = attr(tag, "data-mc");
    if (!el || !ids) continue;
    for (const nid of ids.split(/\s+/)) {
      if (!nodeIds.has(nid)) continue;
      (trace[nid] ??= []).includes(el) || trace[nid].push(el);
    }
  }
  return trace;
}


/** What changed in the plan between two maps (used for fast incremental rebuilds). */
export interface MapDiff {
  added: MapNode[];
  removed: MapNode[];
  changed: Array<{ before: MapNode; after: MapNode }>;
}

export function mapDiff(before: MindMap, after: MindMap): MapDiff {
  const old = new Map(before.nodes.map((n) => [n.id, n]));
  const now = new Map(after.nodes.map((n) => [n.id, n]));
  const added = after.nodes.filter((n) => !old.has(n.id));
  const removed = before.nodes.filter((n) => !now.has(n.id));
  const changed = after.nodes
    .filter((n) => old.has(n.id))
    .map((n) => ({ before: old.get(n.id)!, after: n }))
    .filter(({ before: b, after: a }) => b.label !== a.label || b.detail !== a.detail || b.status !== a.status || b.source !== a.source);
  return { added, removed, changed };
}

export const diffSize = (d: MapDiff) => d.added.length + d.removed.length + d.changed.length;

/** Plain-language change list for Claude, e.g. for an incremental rebuild. */
export function describeDiff(d: MapDiff): string {
  const line = (n: MapNode) => `"${n.label}" (${n.id}, ${n.kind})${n.detail ? `: ${n.detail}` : ""}`;
  const parts: string[] = [];
  if (d.added.length) parts.push("ADD to the app (new bubbles):\n" + d.added.map((n) => "- " + line(n)).join("\n"));
  if (d.changed.length)
    parts.push(
      "UPDATE the app (changed bubbles):\n" +
        d.changed
          .map(({ before: b, after: a }) =>
            `- ${a.id}: "${b.label}" -> "${a.label}"${b.detail !== a.detail ? `; detail now: ${a.detail}` : ""}${b.status !== a.status ? `; status ${b.status} -> ${a.status}` : ""}`,
          )
          .join("\n"),
    );
  if (d.removed.length) parts.push("REMOVE from the app (deleted bubbles, delete their UI and logic):\n" + d.removed.map((n) => "- " + line(n)).join("\n"));
  return parts.join("\n\n");
}
