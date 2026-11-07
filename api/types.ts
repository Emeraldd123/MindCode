// Shared types. Must match docs/api-contract.md.

export type Source = "user" | "inferred" | "unknown";
export type Status = "proposed" | "approved" | "locked";
export type Kind = "goal" | "feature" | "page" | "component" | "data" | "api" | "style" | "constraint";

export interface MapNode {
  id: string;
  label: string;
  detail: string;
  kind: Kind;
  source: Source;
  inventiveness: number;
  importance: number;
  status: Status;
  parent: string | null;
  evidence: string[];
  turn: number;
  facet?: "design" | "audience" | "functionality" | "cost" | "goal"; // ai/taxonomy.ts
}

export interface Edge { from: string; to: string; relation: "has" | "needs" | "informs" }
export interface MindMap { nodes: MapNode[]; edges: Edge[] }
export interface Message { role: "user" | "assistant"; text: string; node_id?: string }

export interface BuildAudit {
  totalElements: number;
  tracedElements: number;
  coveragePct: number;
  nodeBreakdown: Record<string, number>;
  untracedNodes: string[];
}

export interface Build {
  id: string;
  status: "pending" | "done" | "error";
  error?: string;
  html: string;
  trace: Record<string, string[]>;
  checkpoint_id: string;
  audit?: BuildAudit;
}

export interface Checkpoint { id: string; label: string; turn: number; map: MindMap; build_id?: string }

export interface Session {
  id: string;
  messages: Message[];
  map: MindMap;
  builds: Build[];
  checkpoints: Checkpoint[];
  node_chats: Record<string, Message[]>; // not returned to the client
  /** The latest chat turn. Turns run in a background function (a full plan can exceed the 30 s sync limit). */
  turn?: Turn | null;
}

export interface Turn {
  status: "pending" | "done" | "error";
  error?: string;
  changed: string[];
  started_at: number;
}

/** What the AI layer may return for a map: partial nodes, the server fills defaults and enforces rules. */
export type ProposedNode = Partial<MapNode> & { label?: string };
export interface ProposedMap { nodes?: ProposedNode[]; edges?: Partial<Edge>[] }

/** The ai/ module interface (implemented in ai/, stubbed in api/stubs.ts). */
export interface AI {
  updateMap(messages: Message[], current: MindMap): Promise<{ reply: string; map: ProposedMap }>;
  nodeChat(node: MapNode, map: MindMap, history: Message[], text: string): Promise<{ reply: string; label?: string; detail?: string }>;
  buildApp(map: MindMap, previousHtml: string | null): Promise<string>;
}
