import type { MindMap } from "./types.ts";
import { fakeBuildApp } from "./fake.ts";
import { callOpenRouter } from "./client.ts";

const SYSTEM_PROMPT = `You are Claude, an expert full-stack developer generating a complete standalone, interactive HTML application from a MindMap of requirements.

### REQUIREMENTS:
1. Valid Standalone HTML:
   - Output MUST start with <!doctype html> and contain <html>, <head>, <style>, <body>, and <script>.
   - Must be fully functional, beautifully styled, self-contained (all styles in <style>, all interactions in <script>). No external script/css dependencies unless necessary.
2. Traceability:
   - Every significant visual, layout, or interactive HTML element informed by bubbles in the mind map MUST have:
     - \`data-mc-el="e<unique_number>"\` (e.g. data-mc-el="e1", data-mc-el="e2", etc., globally unique per element)
     - \`data-mc="<space-separated node IDs>"\` (e.g. data-mc="n1 n2")
   - ONLY reference node IDs that exist in the provided MindMap. Never invent or hallucinate node IDs.
3. Locked Nodes:
   - If any node in the map is marked as "locked" and previous HTML was provided, the elements tagged with that locked node's ID in the previous HTML MUST be preserved.
4. Output format:
   - Output ONLY the raw HTML document.
   - Do NOT wrap the output in markdown fences (e.g. \`\`\`html ... \`\`\`).
`;

/**
 * Extracts elements containing locked node IDs in their data-mc attribute from previousHtml.
 */
function extractLockedElements(previousHtml: string, lockedNodeIds: Set<string>): Map<string, string> {
  const result = new Map<string, string>();
  if (!previousHtml) return result;

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

/**
 * Strips markdown code block wrappers if present (e.g. ```html ... ```).
 */
export function cleanHtmlOutput(html: string): string {
  let cleaned = html.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:html)?\s*/i, "").replace(/\s*```$/, "").trim();
  }
  return cleaned;
}

/**
 * Validates and strips hallucinated / nonexistent node IDs from all data-mc attributes.
 */
export function sanitizeTracedElements(html: string, validNodeIds: Set<string>): string {
  // Replace data-mc="..." with only valid node IDs
  return html.replace(/data-mc=(["'])(.*?)\1/gi, (_match, quote, val) => {
    const ids = val.split(/\s+/).filter((id: string) => validNodeIds.has(id));
    return `data-mc=${quote}${ids.join(" ")}${quote}`;
  });
}

/**
 * Ensures preserved locked elements from previousHtml replace corresponding elements if needed.
 */
export function preserveLockedElements(
  html: string,
  previousHtml: string | null,
  lockedNodeIds: Set<string>
): string {
  if (!previousHtml || lockedNodeIds.size === 0) return html;

  const preserved = extractLockedElements(previousHtml, lockedNodeIds);
  if (preserved.size === 0) return html;

  let result = html;
  for (const [nodeId, preservedSnippet] of preserved.entries()) {
    // Look for an existing element tagged with this locked nodeId in current html
    // Regex matching an element whose data-mc includes nodeId
    const regex = new RegExp(`<([a-zA-Z0-9]+)[^>]*data-mc=["'][^"']*\\b${nodeId}\\b[^"']*["'][^>]*>[\\s\\S]*?<\\/\\1>`, "i");
    if (regex.test(result)) {
      result = result.replace(regex, preservedSnippet);
    }
  }
  return result;
}

export async function build_app(
  map: MindMap,
  previousHtml: string | null = null
): Promise<string> {
  const isFake = process.env.MINDCODE_FAKE_LLM === "1";
  if (isFake) {
    return fakeBuildApp(map, previousHtml);
  }

  const validNodeIds = new Set((map.nodes || []).map(n => n.id));
  const lockedNodes = (map.nodes || []).filter(n => n.status === "locked");
  const lockedNodeIds = new Set(lockedNodes.map(n => n.id));

  let lockedInstructions = "";
  if (lockedNodes.length > 0 && previousHtml) {
    const preserved = extractLockedElements(previousHtml, lockedNodeIds);
    if (preserved.size > 0) {
      lockedInstructions = `\nPREVIOUS HTML LOCKED ELEMENTS (You MUST preserve these snippets for their respective nodes):\n` +
        Array.from(preserved.entries()).map(([id, snippet]) => `Node ${id}:\n${snippet}`).join("\n\n");
    }
  }

  const nodesJson = JSON.stringify(map.nodes || [], null, 2);
  const edgesJson = JSON.stringify(map.edges || [], null, 2);

  const userPrompt = `Generate a complete standalone HTML web app based on this mind map:

NODES:
${nodesJson}

EDGES:
${edgesJson}
${lockedInstructions}

Remember:
- Valid standalone HTML (<!doctype html>...).
- Every functional or styled section must trace to bubbles with data-mc="<node_ids>" and data-mc-el="e<n>".
- Only reference valid node IDs from the nodes list.
- Return raw HTML only without markdown fences.`;

  const { rawText } = await callOpenRouter(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    {
      jsonMode: false,
      maxTokens: 3500,
      timeoutMs: 24000
    }
  );

  let html = cleanHtmlOutput(rawText);
  html = sanitizeTracedElements(html, validNodeIds);
  html = preserveLockedElements(html, previousHtml, lockedNodeIds);

  // If LLM returned text that somehow didn't include <!doctype html>, prepend it
  if (!html.toLowerCase().includes("<!doctype html")) {
    html = `<!doctype html>\n${html}`;
  }

  return html;
}

export const buildApp = build_app;
