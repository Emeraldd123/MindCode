import type { MindMap, Message, UpdateMapResult, Node, Edge } from "./types.ts";

export function fakeUpdateMap(messages: Message[], current: MindMap = { nodes: [], edges: [] }): UpdateMapResult {
  const turn = Math.floor(messages.length / 2) + 1;
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.text || "";

  // If map is empty or this is the first turn, provide the canonical demo map
  if (!current.nodes || current.nodes.length === 0) {
    const isDemo = /study group|chat/i.test(lastUserMsg) || true; // canonical default

    const nodes: Node[] = [
      {
        id: "n1",
        label: "Chat app",
        detail: "A real-time messaging application for group collaboration.",
        kind: "goal",
        source: "user",
        inventiveness: 0,
        importance: 5,
        status: "proposed",
        parent: null,
        evidence: ["chat app"],
        turn: 1
      },
      {
        id: "n2",
        label: "Study group",
        detail: "Tailored specifically for students collaborating on course materials and study sessions.",
        kind: "feature",
        source: "user",
        inventiveness: 0,
        importance: 4,
        status: "proposed",
        parent: "n1",
        evidence: ["study group"],
        turn: 1
      },
      {
        id: "n3",
        label: "Message API",
        detail: "Standard backend endpoints to post and retrieve messages.",
        kind: "api",
        source: "inferred",
        inventiveness: 0.2, // low inventiveness (obvious)
        importance: 3,
        status: "proposed",
        parent: "n1",
        evidence: [],
        turn: 1
      },
      {
        id: "n4",
        label: "Real-time updates",
        detail: "Live bidirectional push updates for instant message delivery without manual refresh.",
        kind: "feature",
        source: "inferred",
        inventiveness: 0.85, // high inventiveness (creative leap)
        importance: 4,
        status: "proposed",
        parent: "n1",
        evidence: [],
        turn: 1
      },
      {
        id: "n5",
        label: "How do users log in?",
        detail: "Authentication method is currently undefined. We need to decide how users identify themselves.",
        kind: "constraint",
        source: "unknown",
        inventiveness: 0,
        importance: 5,
        status: "proposed",
        parent: "n1",
        evidence: [],
        turn: 1
      }
    ];

    const edges: Edge[] = [
      { from: "n1", to: "n2", relation: "has" },
      { from: "n1", to: "n3", relation: "needs" },
      { from: "n1", to: "n4", relation: "has" },
      { from: "n1", to: "n5", relation: "needs" }
    ];

    return {
      reply: "I've structured your app idea into a mind map! I extracted 'Chat app' and 'Study group' directly from your prompt, assumed standard 'Message API' and 'Real-time updates' capabilities, and flagged 'How do users log in?' as a key unknown decision.",
      map: { nodes, edges },
      changed: nodes.map(n => n.id)
    };
  }

  // If map already exists, preserve existing nodes and respect locked/approved nodes
  const existingNodes = [...current.nodes];
  const existingEdges = [...(current.edges || [])];
  const existingIds = new Set(existingNodes.map(n => n.id));

  // Determine next node index
  let maxIndex = 0;
  for (const node of existingNodes) {
    const match = node.id.match(/^n(\d+)$/);
    if (match) {
      maxIndex = Math.max(maxIndex, parseInt(match[1], 10));
    }
  }

  const changedIds: string[] = [];

  // Check if user is answering the login unknown
  if (/nickname/i.test(lastUserMsg)) {
    const loginNodeIndex = existingNodes.findIndex(n => n.id === "n5" || /log in/i.test(n.label));
    if (loginNodeIndex !== -1 && existingNodes[loginNodeIndex].status !== "locked") {
      const target = existingNodes[loginNodeIndex];
      // If not locked, we can update or clarify
      existingNodes[loginNodeIndex] = {
        ...target,
        label: "Nickname login",
        detail: "Simple nickname entry without passwords for quick access.",
        source: "user",
        evidence: ["nickname"],
        turn
      };
      changedIds.push(target.id);
    }
  } else {
    // Add an incremental node based on user message
    maxIndex += 1;
    const newId = `n${maxIndex}`;
    const newNode: Node = {
      id: newId,
      label: lastUserMsg.slice(0, 20).trim() || `Idea ${maxIndex}`,
      detail: `User specified requirement: "${lastUserMsg}".`,
      kind: "feature",
      source: "user",
      inventiveness: 0,
      importance: 3,
      status: "proposed",
      parent: existingNodes[0]?.id || null,
      evidence: [lastUserMsg.slice(0, 40)],
      turn
    };
    existingNodes.push(newNode);
    changedIds.push(newId);

    if (existingNodes[0]) {
      existingEdges.push({ from: existingNodes[0].id, to: newId, relation: "has" });
    }
  }

  return {
    reply: `Updated the mind map based on your input: "${lastUserMsg}".`,
    map: { nodes: existingNodes, edges: existingEdges },
    changed: changedIds
  };
}
