export type Source = "user" | "inferred" | "unknown";
export type Status = "proposed" | "approved" | "locked";
export type NodeKind =
  | "goal"
  | "feature"
  | "page"
  | "component"
  | "data"
  | "api"
  | "style"
  | "constraint";

export interface Node {
  id: string;            // "n1", "n2", ... stable within a session
  label: string;         // 1-5 words, shown in the bubble
  detail: string;        // one or two sentences
  kind: NodeKind;
  source: Source;        // who it came from (never changes after creation)
  inventiveness: number; // 0..1, only meaningful for "inferred" (0 = obvious, 1 = creative leap)
  importance: number;    // 1..5, how much the user should weigh in
  status: Status;
  parent: string | null; // tree parent node id; root goal has null
  evidence: string[];    // exact user quotes that support it (empty for inferred/unknown)
  turn: number;          // chat turn that created it
}

export type EdgeRelation = "has" | "needs" | "informs";

export interface Edge {
  from: string;
  to: string;
  relation: EdgeRelation;
}

export interface MindMap {
  nodes: Node[];
  edges: Edge[];
}

export interface Message {
  role: "user" | "assistant";
  text: string;
  node_id?: string;
}

export interface UpdateMapResult {
  reply: string;
  map: MindMap;
  changed: string[];
}
