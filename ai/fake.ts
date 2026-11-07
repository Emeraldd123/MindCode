import type { MindMap, Message, UpdateMapResult, Node, Edge } from "./types.ts";
import { CROSS_LINKS } from "./taxonomy.ts";

/**
 * Builds the canonical full plan for the demo prompt ("I want a chat app for my study group").
 * Total bubbles: ~31, covering all 18 topics across 4 facets, expanded children,
 * 2-3 unknown bubbles, facets on every node, and cross-link edges.
 */
function buildDemoNodes(): { nodes: Node[]; topicNodeMap: Record<string, string>; loginNodeId: string } {
  const nodes: Node[] = [
    // 1. Root goal
    {
      id: "n1",
      label: "Chat app for study group",
      detail: "A real-time messaging application for student study groups and course collaboration.",
      kind: "goal",
      source: "user",
      inventiveness: 0,
      importance: 5,
      status: "proposed",
      parent: null,
      evidence: ["chat app", "study group"],
      facet: "goal",
      turn: 1,
    },

    // 2. Four Facets (children of root)
    {
      id: "n2",
      label: "Design",
      detail: "Visual style, screen layouts, typography, and UX guidelines.",
      kind: "constraint",
      source: "inferred",
      inventiveness: 0,
      importance: 3,
      status: "proposed",
      parent: "n1",
      evidence: [],
      facet: "design",
      turn: 1,
    },
    {
      id: "n3",
      label: "Audience",
      detail: "Target users, market scope, and learner collaboration needs.",
      kind: "constraint",
      source: "inferred",
      inventiveness: 0,
      importance: 3,
      status: "proposed",
      parent: "n1",
      evidence: [],
      facet: "audience",
      turn: 1,
    },
    {
      id: "n4",
      label: "Functionality",
      detail: "Core chat features, user actions, storage, and backend infrastructure.",
      kind: "constraint",
      source: "inferred",
      inventiveness: 0,
      importance: 3,
      status: "proposed",
      parent: "n1",
      evidence: [],
      facet: "functionality",
      turn: 1,
    },
    {
      id: "n5",
      label: "Cost",
      detail: "Third-party APIs, AI usage, and marketing budget considerations.",
      kind: "constraint",
      source: "inferred",
      inventiveness: 0,
      importance: 3,
      status: "proposed",
      parent: "n1",
      evidence: [],
      facet: "cost",
      turn: 1,
    },

    // 3. Topics under Design (parent: "n2")
    {
      id: "n6",
      label: "Brand: focused & academic",
      detail: "Clean, distraction-free atmosphere tailored for productive studying.",
      kind: "style",
      source: "inferred",
      inventiveness: 0.3,
      importance: 3,
      status: "proposed",
      parent: "n2",
      evidence: [],
      facet: "design",
      turn: 1,
    },
    {
      id: "n7",
      label: "Color: warm slate & indigo",
      detail: "Dark mode palette with indigo accents to reduce eye strain during late sessions.",
      kind: "style",
      source: "inferred",
      inventiveness: 0.4,
      importance: 3,
      status: "proposed",
      parent: "n2",
      evidence: [],
      facet: "design",
      turn: 1,
    },
    {
      id: "n8",
      label: "Font: Inter & JetBrains Mono",
      detail: "Legible sans-serif for chat dialogue and monospace font for code snippets.",
      kind: "style",
      source: "inferred",
      inventiveness: 0.2,
      importance: 2,
      status: "proposed",
      parent: "n2",
      evidence: [],
      facet: "design",
      turn: 1,
    },
    {
      id: "n9",
      label: "Size: responsive compact desktop",
      detail: "Multi-column layout optimized for laptop split-screen study.",
      kind: "style",
      source: "inferred",
      inventiveness: 0.2,
      importance: 3,
      status: "proposed",
      parent: "n2",
      evidence: [],
      facet: "design",
      turn: 1,
    },
    {
      id: "n10",
      label: "Pages: core application screens",
      detail: "All primary views required for group study interactions.",
      kind: "page",
      source: "inferred",
      inventiveness: 0.1,
      importance: 4,
      status: "proposed",
      parent: "n2",
      evidence: [],
      facet: "design",
      turn: 1,
    },
    // Concrete children of Pages (parent: "n10")
    {
      id: "n11",
      label: "Sign-in/join",
      detail: "Fast access landing page to join a study room.",
      kind: "page",
      source: "inferred",
      inventiveness: 0.2,
      importance: 4,
      status: "proposed",
      parent: "n10",
      evidence: [],
      facet: "design",
      turn: 1,
    },
    {
      id: "n12",
      label: "Group chat room",
      detail: "Main room with real-time stream, pinned topics, and participant list.",
      kind: "page",
      source: "inferred",
      inventiveness: 0.2,
      importance: 5,
      status: "proposed",
      parent: "n10",
      evidence: [],
      facet: "design",
      turn: 1,
    },
    {
      id: "n13",
      label: "Direct messages",
      detail: "Private 1-on-1 threads between study partners.",
      kind: "page",
      source: "inferred",
      inventiveness: 0.5,
      importance: 3,
      status: "proposed",
      parent: "n10",
      evidence: [],
      facet: "design",
      turn: 1,
    },
    {
      id: "n14",
      label: "Members & settings",
      detail: "Roster of study group members, room invite codes, and notification prefs.",
      kind: "page",
      source: "inferred",
      inventiveness: 0.3,
      importance: 3,
      status: "proposed",
      parent: "n10",
      evidence: [],
      facet: "design",
      turn: 1,
    },
    {
      id: "n15",
      label: "Usability: keyboard shortcuts & search",
      detail: "Quick message navigation, fast message jumping, and markdown formatting.",
      kind: "feature",
      source: "inferred",
      inventiveness: 0.3,
      importance: 3,
      status: "proposed",
      parent: "n2",
      evidence: [],
      facet: "design",
      turn: 1,
    },

    // 4. Topics under Audience (parent: "n3")
    {
      id: "n16",
      label: "Users: university study groups",
      detail: "Students, TAs, and peer study circles collaborating on coursework.",
      kind: "constraint",
      source: "user",
      inventiveness: 0,
      importance: 5,
      status: "proposed",
      parent: "n3",
      evidence: ["study group"],
      facet: "audience",
      turn: 1,
    },
    {
      id: "n17",
      label: "Market: higher education collaboration",
      detail: "Collegiate study sessions and remote peer tutoring groups.",
      kind: "constraint",
      source: "inferred",
      inventiveness: 0.4,
      importance: 2,
      status: "proposed",
      parent: "n3",
      evidence: [],
      facet: "audience",
      turn: 1,
    },
    {
      id: "n18",
      label: "Research: shared homework & exam prep",
      detail: "Students need fast problem discussion and screenshot sharing before deadlines.",
      kind: "constraint",
      source: "inferred",
      inventiveness: 0.5,
      importance: 3,
      status: "proposed",
      parent: "n3",
      evidence: [],
      facet: "audience",
      turn: 1,
    },

    // 5. Topics under Functionality (parent: "n4")
    {
      id: "n19",
      label: "Features: group messaging suite",
      detail: "Key functional capabilities for real-time collaboration.",
      kind: "feature",
      source: "user",
      inventiveness: 0,
      importance: 5,
      status: "proposed",
      parent: "n4",
      evidence: ["chat app"],
      facet: "functionality",
      turn: 1,
    },
    // Concrete children of Features (parent: "n19")
    {
      id: "n20",
      label: "Message sending & replies",
      detail: "Post messages, reply in threads, and tag study members.",
      kind: "feature",
      source: "inferred",
      inventiveness: 0.1,
      importance: 5,
      status: "proposed",
      parent: "n19",
      evidence: [],
      facet: "functionality",
      turn: 1,
    },
    {
      id: "n21",
      label: "Real-time sync",
      detail: "Instant message delivery via live websocket connection.",
      kind: "feature",
      source: "inferred",
      inventiveness: 0.75, // high inventiveness
      importance: 4,
      status: "proposed",
      parent: "n19",
      evidence: [],
      facet: "functionality",
      turn: 1,
    },
    {
      id: "n22",
      label: "Login: how do members sign in?",
      detail: "Authentication method is currently undecided. Nicknames, email links, or student SSO?",
      kind: "constraint",
      source: "unknown",
      inventiveness: 0,
      importance: 5,
      status: "proposed",
      parent: "n19",
      evidence: [],
      facet: "functionality",
      turn: 1,
    },
    {
      id: "n23",
      label: "Buttons: reactions & copy code",
      detail: "Emoji reactions for quick consensus and one-click code copy.",
      kind: "component",
      source: "inferred",
      inventiveness: 0.3,
      importance: 3,
      status: "proposed",
      parent: "n4",
      evidence: [],
      facet: "functionality",
      turn: 1,
    },
    {
      id: "n24",
      label: "AI integration: optional study assistant",
      detail: "Summarize chat highlights or explain tricky concepts on demand.",
      kind: "feature",
      source: "inferred",
      inventiveness: 0.7, // creative leap
      importance: 2,
      status: "proposed",
      parent: "n4",
      evidence: [],
      facet: "functionality",
      turn: 1,
    },
    {
      id: "n25",
      label: "Storage: where are files & notes stored?",
      detail: "Decide whether to use cloud object store (S3) or lightweight local file storage.",
      kind: "data",
      source: "unknown",
      inventiveness: 0,
      importance: 4,
      status: "proposed",
      parent: "n4",
      evidence: [],
      facet: "functionality",
      turn: 1,
    },
    {
      id: "n26",
      label: "Hosting: serverless + Netlify Blobs",
      detail: "Static frontend on CDN with serverless edge functions for APIs.",
      kind: "constraint",
      source: "inferred",
      inventiveness: 0.2,
      importance: 3,
      status: "proposed",
      parent: "n4",
      evidence: [],
      facet: "functionality",
      turn: 1,
    },
    {
      id: "n27",
      label: "Scale: expected group size?",
      detail: "Determine whether rooms hold 5-10 close peers or 200+ course sections.",
      kind: "constraint",
      source: "unknown",
      inventiveness: 0,
      importance: 4,
      status: "proposed",
      parent: "n4",
      evidence: [],
      facet: "functionality",
      turn: 1,
    },

    // 6. Topics under Cost (parent: "n5")
    {
      id: "n28",
      label: "APIs: external services",
      detail: "Third-party APIs and services utilized by the app.",
      kind: "api",
      source: "inferred",
      inventiveness: 0.2,
      importance: 3,
      status: "proposed",
      parent: "n5",
      evidence: [],
      facet: "cost",
      turn: 1,
    },
    // Concrete children of APIs (parent: "n28")
    {
      id: "n29",
      label: "WebSocket gateway API",
      detail: "Real-time pub/sub broker for instant chat broadcast.",
      kind: "api",
      source: "inferred",
      inventiveness: 0.2,
      importance: 4,
      status: "proposed",
      parent: "n28",
      evidence: [],
      facet: "cost",
      turn: 1,
    },
    {
      id: "n30",
      label: "AI usage: model token spend",
      detail: "Budget cap for AI tutor questions and chat summaries.",
      kind: "constraint",
      source: "inferred",
      inventiveness: 0.3,
      importance: 2,
      status: "proposed",
      parent: "n5",
      evidence: [],
      facet: "cost",
      turn: 1,
    },
    {
      id: "n31",
      label: "Advertising: campus grassroots",
      detail: "Zero-cost word of mouth, campus Discord servers, and student societies.",
      kind: "constraint",
      source: "inferred",
      inventiveness: 0.1,
      importance: 1,
      status: "proposed",
      parent: "n5",
      evidence: [],
      facet: "cost",
      turn: 1,
    },
  ];

  const topicNodeMap: Record<string, string> = {
    Brand: "n6",
    Color: "n7",
    Font: "n8",
    Size: "n9",
    Pages: "n10",
    Usability: "n15",
    Users: "n16",
    Market: "n17",
    Research: "n18",
    Features: "n19",
    Buttons: "n23",
    "AI integration": "n24",
    Storage: "n25",
    Hosting: "n26",
    Scale: "n27",
    APIs: "n28",
    "AI usage": "n30",
    Advertising: "n31",
  };

  return { nodes, topicNodeMap, loginNodeId: "n22" };
}

export function fakeUpdateMap(messages: Message[], current: MindMap = { nodes: [], edges: [] }): UpdateMapResult {
  const turn = Math.floor(messages.length / 2) + 1;
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user")?.text || "";

  // If map is empty or this is the first turn, provide the canonical demo map
  if (!current.nodes || current.nodes.length === 0) {
    const { nodes, topicNodeMap } = buildDemoNodes();

    // 1. Hierarchical edges
    const edges: Edge[] = [];
    for (const node of nodes) {
      if (node.parent) {
        edges.push({ from: node.parent, to: node.id, relation: "has" });
      }
    }

    // 2. Cross-links from Ben's taxonomy
    for (const [fromTopic, relation, toTopic] of CROSS_LINKS) {
      const fromId = topicNodeMap[fromTopic];
      const toId = topicNodeMap[toTopic];
      if (fromId && toId) {
        edges.push({ from: fromId, to: toId, relation });
      }
    }

    return {
      reply: "I've structured your study group chat app into a comprehensive mind map covering Design, Audience, Functionality, and Cost. I highlighted key pages and features, noted open questions like sign-in and scale, and connected cross-cutting dependencies.",
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
    const loginNodeIndex = existingNodes.findIndex(
      n => n.id === "n22" || n.id === "n5" || /log in|sign in/i.test(n.label)
    );
    if (loginNodeIndex !== -1 && existingNodes[loginNodeIndex].status !== "locked") {
      const target = existingNodes[loginNodeIndex];
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
      facet: "functionality",
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
  const isNickname = lower.includes("nickname") || lower.includes("password") || node.id === "n22" || node.id === "n5" || /log in|sign in/i.test(node.label);

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

  // Login node id can be n22 (in the new full map) or n5 (in the old 5-bubble map or custom tests)
  const loginNode = map.nodes?.find(n => /log in|sign in|nickname/i.test(n.label)) || map.nodes?.find(n => n.id === "n22" || n.id === "n5");
  const loginNodeId = loginNode ? loginNode.id : (validNodeIds?.has("n22") ? "n22" : "n5");

  // Real-time node id can be n21 or n4
  const realtimeNode = map.nodes?.find(n => /real-time/i.test(n.label)) || map.nodes?.find(n => n.id === "n21" || n.id === "n4");
  const realtimeNodeId = realtimeNode ? realtimeNode.id : (validNodeIds?.has("n21") ? "n21" : "n4");

  const headerHtml = getElementOrPreserved(
    "n1",
    `<div class="header">
    <h1 data-mc-el="e-title" data-mc="${sanitizeDataMc(`n1 ${validNodeIds?.has("n16") ? "n16" : "n2"}`)}">${appTitle}</h1>
    <span data-mc-el="e-realtime" data-mc="${sanitizeDataMc(realtimeNodeId)}" class="live-badge">● Real-time sync active</span>
  </div>`
  );

  const loginCardHtml = getElementOrPreserved(
    loginNodeId,
    `<div data-mc-el="e-login" data-mc="${sanitizeDataMc(loginNodeId)}" class="card login-card">
      <h3>Join Study Group</h3>
      <p style="font-size: 0.8rem; color: #94a3b8; margin: 4px 0 12px;">Quick access with nickname only</p>
      <div class="input-group">
        <input type="text" placeholder="Your nickname" value="Alex" />
        <button>Join</button>
      </div>
    </div>`
  );

  const messagesNodeId = validNodeIds?.has("n20") ? "n20" : (validNodeIds?.has("n3") ? "n3" : "n1");
  const chatWindowHtml = getElementOrPreserved(
    realtimeNodeId,
    `<div data-mc-el="e-messages" data-mc="${sanitizeDataMc(`n1 ${messagesNodeId} ${realtimeNodeId}`)}" class="card chat-window">
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
  const coreIds = new Set(["n1", loginNodeId, realtimeNodeId, messagesNodeId, "n16", "n2"]);
  const otherNodes = (map.nodes || []).filter(n => !coreIds.has(n.id));
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
