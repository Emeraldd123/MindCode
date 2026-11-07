import type { Node, MindMap, Message } from "./types.ts";
import { fakeNodeChat } from "./fake.ts";
import { callOpenRouter } from "./client.ts";

const SYSTEM_PROMPT = `You are Claude, an AI architect helping the user brainstorm about a specific bubble (node) in their software architecture mind map.
You discuss the requirement with the user, offer design advice, explore alternatives, and suggest refinements.

If the discussion calls for updating the node's label or detail (e.g., user wants to rename it, specify details, or clarify how it works), you can return an updated "label" (1-5 words) and/or "detail" (1-2 sentences).
If no changes to the label or detail are needed, omit those fields or leave them undefined.

CRITICAL: If the node's status is "locked", you MUST NOT update its label or detail.

Respond with a JSON object:
{
  "reply": "Conversational reply about this bubble: at most 120 words, plain text, no headings",
  "label": "Optional updated short label (1-5 words)",
  "detail": "Optional updated detail (1-2 sentences)"
}
`;

export async function node_chat(
  node: Node,
  map: MindMap,
  history: Message[],
  text: string
): Promise<{ reply: string; label?: string; detail?: string }> {
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

${isLocked ? "NOTE: This node is LOCKED. You must NOT suggest or return any label or detail changes." : ""}
Please respond with JSON: { "reply": "...", "label"?: "...", "detail"?: "..." }`;

  const { data } = await callOpenRouter<{ reply: string; label?: string; detail?: string }>(
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

  // Never allow changing label/detail of a locked node
  if (isLocked) {
    label = undefined;
    detail = undefined;
  }

  return {
    reply,
    ...(label !== undefined ? { label } : {}),
    ...(detail !== undefined ? { detail } : {})
  };
}

export const nodeChat = node_chat;
