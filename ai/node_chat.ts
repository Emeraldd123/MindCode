import type { Node, MindMap, Message } from "./types.ts";
import { fakeNodeChat } from "./fake.ts";
import { callOpenRouter } from "./client.ts";

export interface NodeChatSuggestion {
  label: string;
  detail: string;
  kind?: string;
}

export interface NodeChatResult {
  reply: string;
  label?: string;
  detail?: string;
  suggest?: NodeChatSuggestion[];
}

const SYSTEM_PROMPT = `You are Claude, an AI architect helping the user brainstorm about a specific bubble (node) in their software architecture mind map.
You discuss the requirement with the user, offer design advice, explore alternatives, and suggest refinements.

If the discussion calls for updating the node's label or detail (e.g., user wants to rename it, specify details, or clarify how it works), you can return an updated "label" (1-5 words) and/or "detail" (1-2 sentences).
If no changes to the label or detail are needed, omit those fields or leave them undefined.

You may also suggest up to 4 new bubbles (sub-features, components, constraints, etc.) that arise from the brainstorm as an optional "suggest" array:
- Each suggestion has: "label" (at most 6 words), "detail" (at most 15 words), and optional "kind" (e.g., "feature", "component", "api", "constraint").
- ONLY suggest items that are genuinely new and not already in the mind map's node labels.
- If no new bubbles should be suggested, omit "suggest" or return an empty array.

CRITICAL: If the node's status is "locked", you MUST NOT update its label or detail, and you MUST NOT suggest any new bubbles.

Keep replies to at most 120 words. Plain text only, no headings.

Respond with a JSON object:
{
  "reply": "Conversational reply about this bubble: at most 120 words, plain text, no headings",
  "label": "Optional updated short label (1-5 words)",
  "detail": "Optional updated detail (1-2 sentences)",
  "suggest": [
    {
      "label": "Suggested bubble label (<= 6 words)",
      "detail": "Short explanation (<= 15 words)",
      "kind": "feature"
    }
  ]
}
`;

export async function node_chat(
  node: Node,
  map: MindMap,
  history: Message[],
  text: string
): Promise<NodeChatResult> {
  const isFake = process.env.MINDCODE_FAKE_LLM === "1";
  if (isFake) {
    return fakeNodeChat(node, map, history, text);
  }

  const isLocked = node.status === "locked";

  const contextPrompt = `CURRENT NODE:
- ID: ${node.id}
- Label: ${node.label}
- Detail: ${node.detail}
- Kind: ${node.kind}
- Source: ${node.source}
- Status: ${node.status}

MIND MAP NODES:
${(map.nodes || []).map(n => `- ${n.id}: ${n.label} (${n.kind}, ${n.status})`).join("\n")}

BRAINSTORM HISTORY ON THIS NODE:
${(history || []).map(m => `${m.role.toUpperCase()}: ${m.text}`).join("\n")}

USER'S LATEST MESSAGE:
${text}

${isLocked ? "NOTE: This node is LOCKED. You must NOT suggest or return any label or detail changes, and you must NOT suggest new bubbles." : ""}
Please respond with JSON: { "reply": "...", "label"?: "...", "detail"?: "...", "suggest"?: [...] }`;

  const { data } = await callOpenRouter<{
    reply: string;
    label?: string;
    detail?: string;
    suggest?: unknown[];
  }>(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: contextPrompt }
    ],
    {
      jsonMode: true,
      maxTokens: 2000, // replies were getting cut off mid-JSON at 1000
      timeoutMs: 24000
    }
  );

  const reply = typeof data?.reply === "string" ? data.reply : "I reviewed your message about this bubble.";
  let label: string | undefined = typeof data?.label === "string" && data.label.trim().length > 0 ? data.label.trim() : undefined;
  let detail: string | undefined = typeof data?.detail === "string" && data.detail.trim().length > 0 ? data.detail.trim() : undefined;

  let suggest: NodeChatSuggestion[] | undefined = undefined;

  // Never allow changing label/detail or suggesting new bubbles for a locked node
  if (isLocked) {
    label = undefined;
    detail = undefined;
  } else if (Array.isArray(data?.suggest)) {
    const existingLabels = new Set(
      (map.nodes || [])
        .map(n => (typeof n.label === "string" ? n.label.trim().toLowerCase() : ""))
        .filter(Boolean)
    );
    const seen = new Set<string>();
    const cleaned: NodeChatSuggestion[] = [];

    for (const item of data.suggest) {
      if (!item || typeof item !== "object") continue;
      const s = item as Record<string, unknown>;
      const sLabel = typeof s.label === "string" ? s.label.trim() : "";
      const sDetail = typeof s.detail === "string" ? s.detail.trim() : "";
      const sKind = typeof s.kind === "string" && s.kind.trim().length > 0 ? s.kind.trim() : undefined;

      if (!sLabel || !sDetail) continue;

      const lower = sLabel.toLowerCase();
      if (existingLabels.has(lower)) continue;
      if (seen.has(lower)) continue;
      seen.add(lower);

      cleaned.push({
        label: sLabel,
        detail: sDetail,
        ...(sKind ? { kind: sKind } : {})
      });

      if (cleaned.length >= 4) break;
    }

    if (cleaned.length > 0) {
      suggest = cleaned;
    }
  }

  return {
    reply,
    ...(label !== undefined ? { label } : {}),
    ...(detail !== undefined ? { detail } : {}),
    ...(suggest !== undefined ? { suggest } : {})
  };
}

export const nodeChat = node_chat;
