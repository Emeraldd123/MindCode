import type { MindMap, Message, UpdateMapResult, Node, Edge } from "./types.ts";

export function fakeUpdateMap(messages: Message[], current: MindMap = { nodes: [], edges: [] }): UpdateMapResult {
  const turn = Math.floor(messages.length / 2) + 1;
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.text || "";

  // If map is empty or this is the first turn, provide the canonical demo map
  if (!current.nodes || current.nodes.length === 0) {
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

export function fakeNodeChat(
  node: Node,
  _map: MindMap,
  _history: Message[],
  text: string
): { reply: string; label?: string; detail?: string; suggest?: Array<{ label: string; detail: string; kind?: string }> } {
  // If the node is locked, do not allow changing label or detail or suggesting new bubbles
  if (node.status === "locked") {
    return {
      reply: `This bubble is locked, so its label and details are preserved: ${text ? `"${text}" noted.` : ""}`.trim()
    };
  }

  const lower = text.toLowerCase();
  const isNickname = lower.includes("nickname") || lower.includes("password") || node.id === "n5" || /log in/i.test(node.label);

  if (isNickname) {
    return {
      reply: "Great idea! I've simplified it to a nickname-only login with no password needed.",
      label: "Nickname login",
      detail: "Just a nickname, no passwords required.",
      suggest: [
        {
          label: "Session storage",
          detail: "Keep nickname stored locally in browser session.",
          kind: "data"
        }
      ]
    };
  }

  if (lower.startsWith("rename to ") || lower.startsWith("call it ")) {
    const newLabel = text.replace(/^(rename to|call it)\s+/i, "").trim();
    return {
      reply: `I've updated the bubble label to "${newLabel}".`,
      label: newLabel,
      detail: `Updated requirement based on brainstorm: ${newLabel}.`
    };
  }

  return {
    reply: `Let's brainstorm on "${node.label}". You mentioned: "${text}". We can refine the scope or change its requirements as you see fit.`,
    label: undefined,
    detail: undefined,
    suggest: [
      {
        label: "Typing indicator",
        detail: "Shows when another participant is typing a message.",
        kind: "feature"
      },
      {
        label: "Read receipts",
        detail: "Indicates when messages have been viewed by group members.",
        kind: "feature"
      }
    ]
  };
}

/**
 * Extracts and preserves elements matching data-mc containing locked node IDs from previousHtml.
 */
function extractLockedElements(previousHtml: string, lockedNodeIds: Set<string>): Map<string, string> {
  const result = new Map<string, string>();
  if (!previousHtml || lockedNodeIds.size === 0) return result;

  const regex = /<([a-zA-Z0-9]+)[^>]*data-mc=["']([^"']*)["'][^>]*>([\s\S]*?)<\/\1>/gi;
  let match;
  while ((match = regex.exec(previousHtml)) !== null) {
    const fullTag = match[0];
    const mcAttr = match[2];
    const ids = mcAttr.split(/\s+/).filter(Boolean);
    for (const id of ids) {
      if (lockedNodeIds.has(id)) {
        result.set(id, fullTag);
      }
    }
  }
  return result;
}

export function fakeBuildApp(
  map: MindMap = { nodes: [], edges: [] },
  previousHtml: string | null = null
): string {
  const hasNodes = map.nodes && map.nodes.length > 0;
  const validNodeIds = hasNodes ? new Set(map.nodes.map(n => n.id)) : null;
  const lockedNodeIds = new Set((map.nodes || []).filter(n => n.status === "locked").map(n => n.id));

  // Determine locked elements to preserve from previousHtml if present
  const preservedLockedElements = previousHtml ? extractLockedElements(previousHtml, lockedNodeIds) : new Map<string, string>();

  // Filter helper to ensure data-mc only contains IDs that exist in map.nodes (if map has nodes)
  const sanitizeDataMc = (rawIds: string): string => {
    if (!validNodeIds) return rawIds;
    return rawIds
      .split(/\s+/)
      .filter(id => validNodeIds.has(id))
      .join(" ");
  };

  const getElementOrPreserved = (
    nodeId: string,
    defaultHtml: string
  ): string => {
    if (lockedNodeIds.has(nodeId) && preservedLockedElements.has(nodeId)) {
      return preservedLockedElements.get(nodeId)!;
    }
    return defaultHtml;
  };

  const rootNode = map.nodes?.find(n => n.parent === null) || map.nodes?.[0];
  const appTitle = rootNode ? rootNode.label : "Study Group Chat";

  const headerHtml = getElementOrPreserved(
    "n1",
    `<div class="header">
    <h1 data-mc-el="e-title" data-mc="${sanitizeDataMc("n1 n2")}">${appTitle}</h1>
    <span data-mc-el="e-realtime" data-mc="${sanitizeDataMc("n4")}" class="live-badge">● Real-time sync active</span>
  </div>`
  );

  const loginCardHtml = getElementOrPreserved(
    "n5",
    `<div data-mc-el="e-login" data-mc="${sanitizeDataMc("n5")}" class="card login-card">
      <h3>Join Study Group</h3>
      <p style="font-size: 0.8rem; color: #94a3b8; margin: 4px 0 12px;">Quick access with nickname only</p>
      <div class="input-group">
        <input type="text" placeholder="Your nickname" value="Alex" />
        <button>Join</button>
      </div>
    </div>`
  );

  const chatWindowHtml = getElementOrPreserved(
    "n4",
    `<div data-mc-el="e-messages" data-mc="${sanitizeDataMc("n1 n3 n4")}" class="card chat-window">
      <h3>Group Messages</h3>
      <div class="messages">
        <div class="msg">
          <div class="author">Emma (Calculus II)</div>
          <div>Has anyone solved problem 4 on chapter 7 yet?</div>
        </div>
        <div class="msg">
          <div class="author">David</div>
          <div>Yes! Use integration by parts with u = ln(x).</div>
        </div>
      </div>
      <div class="input-group" style="flex-direction: row;">
        <input type="text" placeholder="Type a message..." style="flex: 1;" />
        <button>Send</button>
      </div>
    </div>`
  );

  // Extra features list for any other nodes present in the map
  const otherNodes = (map.nodes || []).filter(n => !["n1", "n2", "n3", "n4", "n5"].includes(n.id));
  const extraNodesHtml = otherNodes.length > 0
    ? `<div class="card" style="margin-top: 20px;">
        <h3>Additional Planned Features</h3>
        <ul style="margin: 0; padding-left: 20px;">
          ${otherNodes.map((n, idx) => `<li data-mc-el="e-extra-${idx + 1}" data-mc="${sanitizeDataMc(n.id)}"><strong>${n.label}</strong>: ${n.detail}</li>`).join("\n          ")}
        </ul>
      </div>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${appTitle}</title>
  <script>// MindCode interactive trace script stub</script>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 24px; }
    .header { border-bottom: 1px solid #334155; padding-bottom: 16px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    h1 { margin: 0; font-size: 1.5rem; color: #38bdf8; }
    .live-badge { background: #065f46; color: #34d399; font-size: 0.75rem; padding: 4px 8px; border-radius: 9999px; font-weight: 600; }
    .main-layout { display: grid; grid-template-columns: 280px 1fr; gap: 20px; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 16px; }
    .card h3 { margin-top: 0; font-size: 1rem; color: #cbd5e1; }
    .input-group { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
    input { background: #0f172a; border: 1px solid #475569; color: #fff; padding: 8px 12px; border-radius: 6px; }
    button { background: #2563eb; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-weight: 500; cursor: pointer; }
    .chat-window { display: flex; flex-direction: column; height: 350px; }
    .messages { flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 10px; margin-bottom: 12px; }
    .msg { background: #334155; padding: 10px; border-radius: 8px; font-size: 0.875rem; }
    .author { font-size: 0.75rem; color: #94a3b8; margin-bottom: 4px; }
  </style>
</head>
<body>
  ${headerHtml}
  <div class="main-layout">
    ${loginCardHtml}
    ${chatWindowHtml}
  </div>
  ${extraNodesHtml}
</body>
</html>`;
}
