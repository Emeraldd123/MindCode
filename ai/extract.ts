import type { Message, MindMap, Node, Edge, UpdateMapResult, Source, Status, NodeKind, EdgeRelation } from "./types.ts";
import { fakeUpdateMap } from "./fake.ts";
import { callOpenRouter } from "./client.ts";

const SYSTEM_PROMPT = `You are Claude, an expert software architect and prompt engineering assistant in MindCode.
Your job is to listen to the user describing an application and translate their vision into an interactive Mind Map of bubbles and connections, while chatting with them naturally.

The mind map must break down the user's ideas into structured bubbles with explicit origins and dependencies.

### BUBBLE / NODE RULES:
1. Classification of 'source':
   - 'user': The user explicitly said or requested this. You MUST provide 'evidence' as an array of exact short quotes from the user's messages. 'inventiveness' must be 0.
   - 'inferred': Claude assumed this necessity; the user never mentioned it. 'evidence' MUST be empty []. 'inventiveness' must be a float between 0.0 and 1.0 (0.0 = obvious technical necessity like an API or schema; 1.0 = creative product leap or novel feature).
   - 'unknown': A critical decision or requirement that is currently missing and needs the user to weigh in (e.g. "How do users log in?", "What data storage?"). Label should be phrasing the question or decision. 'evidence' MUST be empty [].
   - When the user ANSWERS an existing 'unknown' node, return that same id with source 'user', the answer as the new label/detail, and the user's quote in 'evidence'. (This is the only allowed source change.)
2. 'id': Must be stable!
   - Every existing node in 'current_map' MUST keep its exact id ('n1', 'n2', etc.).
   - New nodes must be assigned the next available ids ('n' + next integer).
3. 'status':
   - 'proposed': Default for all new nodes.
   - 'approved': Node was approved by the user.
   - 'locked': Node was locked by the user.
   - CRITICAL IMMUTABILITY RULE: NEVER alter the label, detail, source, or status of any node in 'current_map' that is already 'approved' or 'locked'! Keep them intact.
4. 'kind': One of 'goal', 'feature', 'page', 'component', 'data', 'api', 'style', 'constraint'.
5. 'importance': Integer 1 to 5 (5 = critical core requirement, 1 = minor polish).
6. 'parent': Parent node id or null if root goal.
7. 'turn': Integer of the current chat turn.

### EDGES:
- Define directed relationships between nodes: { "from": "<parent_id>", "to": "<child_id>", "relation": "has" | "needs" | "informs" }.

### RESPONSE FORMAT:
Respond with a JSON object containing:
{
  "reply": "At most 3 short plain-text sentences: what you added, which assumptions to check, and the single most important open question.",
  "nodes": [ ... ONLY nodes that are new or changed this turn ... ],
  "edges": [ ... ONLY new edges ... ]
}

### SIZE LIMITS (strict, the response must stay small):
- Return ONLY new or changed nodes. Never repeat unchanged nodes; the app keeps them automatically.
- First turn: 6 to 10 nodes total. Later turns: usually 0 to 5 nodes.
- label: at most 4 words. detail: one sentence, at most 20 words. evidence: at most 2 short quotes.
- Node fields to output: id, label, detail, kind, source, inventiveness, importance, parent, evidence. Omit status and turn.
- No markdown, no code fences. Raw JSON only.
`;

export async function update_map(
  messages: Message[],
  current: MindMap = { nodes: [], edges: [] }
): Promise<UpdateMapResult> {
  // Only use fake mode when explicitly enabled via MINDCODE_FAKE_LLM=1
  const isFake = process.env.MINDCODE_FAKE_LLM === "1";
  if (isFake) {
    return fakeUpdateMap(messages, current);
  }

  const turn = Math.floor(messages.length / 2) + 1;

  const currentMapSummary = JSON.stringify({
    nodes: current.nodes || [],
    edges: current.edges || []
  });

  const chatTranscript = messages
    .map(m => `${m.role.toUpperCase()}: ${m.text}`)
    .join("\n\n");

  const userPrompt = `Current turn: ${turn}

CURRENT MIND MAP:
${currentMapSummary}

CHAT TRANSCRIPT SO FAR:
${chatTranscript}

Please update the mind map based on the conversation so far. Remember:
- Keep all existing approved or locked nodes completely unchanged.
- Preserve existing node ids.
- Every new node gets 'proposed' status and an id like n<next_index>.
- Classify source accurately ('user' with quote in evidence, 'inferred' with inventiveness 0..1, 'unknown' for open decisions).
- Return ONLY new or changed nodes and new edges, within the size limits.
- Return valid JSON matching the specified schema.`;

  const { data } = await callOpenRouter<{ reply: string; nodes: any[]; edges: any[] }>([
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: userPrompt }
  ], { maxTokens: 4000 });

  return normalizeAndValidateMapResult(data, current, turn, messages);
}

export function normalizeAndValidateMapResult(
  raw: any,
  current: MindMap,
  turn: number,
  messages: Message[] = []
): UpdateMapResult {
  const reply: string = typeof raw?.reply === "string" ? raw.reply : "Updated mind map.";
  const rawNodes: any[] = Array.isArray(raw?.nodes) ? raw.nodes : [];
  const rawEdges: any[] = Array.isArray(raw?.edges) ? raw.edges : [];

  const existingMap = new Map<string, Node>();
  let maxIdNum = 0;

  for (const n of current.nodes || []) {
    existingMap.set(n.id, n);
    const m = n.id.match(/^n(\d+)$/);
    if (m) {
      maxIdNum = Math.max(maxIdNum, parseInt(m[1], 10));
    }
  }

  const validSources: Source[] = ["user", "inferred", "unknown"];
  const validStatuses: Status[] = ["proposed", "approved", "locked"];
  const validKinds: NodeKind[] = ["goal", "feature", "page", "component", "data", "api", "style", "constraint"];
  const validRelations: EdgeRelation[] = ["has", "needs", "informs"];

  const finalNodes: Node[] = [];
  const seenIds = new Set<string>();
  const changedIds: string[] = [];

  // First, verify and retain all existing approved/locked nodes
  for (const existingNode of current.nodes || []) {
    if (existingNode.status === "approved" || existingNode.status === "locked") {
      finalNodes.push(existingNode);
      seenIds.add(existingNode.id);
    }
  }

  // Next, process nodes returned by LLM
  for (const rn of rawNodes) {
    if (!rn || typeof rn !== "object") continue;

    let id = typeof rn.id === "string" ? rn.id.trim() : "";
    const existing = id ? existingMap.get(id) : undefined;

    // If this was an approved/locked node, it was already retained
    if (existing && (existing.status === "approved" || existing.status === "locked")) {
      continue;
    }

    if (!id || seenIds.has(id)) {
      maxIdNum++;
      id = `n${maxIdNum}`;
    } else {
      const m = id.match(/^n(\d+)$/);
      if (m) {
        maxIdNum = Math.max(maxIdNum, parseInt(m[1], 10));
      }
    }

    seenIds.add(id);

    let source: Source = validSources.includes(rn.source) ? rn.source : "inferred";
    const status: Status = validStatuses.includes(rn.status) ? rn.status : "proposed";
    const kind: NodeKind = validKinds.includes(rn.kind) ? rn.kind : "feature";

    const userCorpus = messages
      .filter((m) => m.role === "user")
      .map((m) => m.text.toLowerCase());

    let finalEvidence: string[] = [];
    let inventiveness = typeof rn.inventiveness === "number" ? Math.max(0, Math.min(1, rn.inventiveness)) : 0;

    if (source === "user") {
      const rawEvidence: string[] = Array.isArray(rn.evidence)
        ? rn.evidence
            .filter((e: any) => typeof e === "string")
            .map((e: string) => e.trim())
            .filter((e: string) => e.length > 0)
        : [];

      // Every quote string, after trimming and case-insensitive check, must appear as a substring in userCorpus
      finalEvidence = rawEvidence.filter((quote) =>
        userCorpus.some((u) => u.includes(quote.toLowerCase()))
      );

      // If all evidence quotes are discarded and the node is marked user, but user never spoke words supporting it,
      // demote the node to inferred (with evidence: [] and default inventiveness: 0.3)
      if (finalEvidence.length === 0) {
        source = "inferred";
        inventiveness = 0.3;
      } else {
        inventiveness = 0;
      }
    } else {
      // For inferred and unknown nodes, enforce evidence: []
      finalEvidence = [];
      if (source === "unknown") {
        inventiveness = 0;
      }
    }

    let importance = typeof rn.importance === "number" ? Math.round(Math.max(1, Math.min(5, rn.importance))) : 3;

    const label = (typeof rn.label === "string" ? rn.label : "").trim().slice(0, 50) || `Idea ${id}`;
    const detail = (typeof rn.detail === "string" ? rn.detail : "").trim() || label;
    const parent = typeof rn.parent === "string" && rn.parent !== id ? rn.parent : (id === "n1" ? null : "n1");

    const nodeTurn = existing ? existing.turn : turn;

    const newNode: Node = {
      id,
      label,
      detail,
      kind,
      source,
      inventiveness,
      importance,
      status,
      parent,
      evidence: finalEvidence,
      turn: nodeTurn
    };

    finalNodes.push(newNode);

    // Track if it's new or modified
    if (!existing || existing.label !== label || existing.detail !== detail || existing.status !== status) {
      changedIds.push(id);
    }
  }

  // The model returns only new/changed nodes; an empty list is valid (nothing changed this turn).
  // The API merge (api/store.ts mergeMap) keeps every node it omits.
  if (finalNodes.length === 0 && (current.nodes || []).length === 0) {
    throw new Error("Model returned no nodes for an empty map");
  }

  // Process and sanitize edges. Edges may point at existing nodes the model did not repeat.
  const knownIds = new Set([...seenIds, ...(current.nodes || []).map((n) => n.id)]);
  const finalEdges: Edge[] = [];
  const edgeSet = new Set<string>();

  for (const re of rawEdges) {
    if (!re || typeof re !== "object") continue;
    const from = typeof re.from === "string" ? re.from : "";
    const to = typeof re.to === "string" ? re.to : "";
    const relation: EdgeRelation = validRelations.includes(re.relation) ? re.relation : "has";

    if (from && to && from !== to && knownIds.has(from) && knownIds.has(to)) {
      const key = `${from}->${to}:${relation}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        finalEdges.push({ from, to, relation });
      }
    }
  }

  // If no edges, construct tree edges from parent pointers
  if (finalEdges.length === 0) {
    for (const node of finalNodes) {
      if (node.parent && knownIds.has(node.parent)) {
        finalEdges.push({ from: node.parent, to: node.id, relation: "has" });
      }
    }
  }

  return {
    reply,
    map: {
      nodes: finalNodes,
      edges: finalEdges
    },
    changed: changedIds
  };
}
