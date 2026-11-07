import type { MindMap } from "./types.ts";
import { fakeBuildApp } from "./fake.ts";
import { callOpenRouter } from "./client.ts";
import {
  findFullElement,
  extractLockedElements,
  cleanHtmlOutput,
  sanitizeTracedElements,
  ensureTracedElementIds,
  preserveLockedElements,
} from "./html_utils.ts";

export {
  findFullElement,
  extractLockedElements,
  cleanHtmlOutput,
  sanitizeTracedElements,
  ensureTracedElementIds,
  preserveLockedElements,
};

const SYSTEM_PROMPT = `You are Claude, a senior product engineer. From a mind map of requirements, you build a REAL, WORKING single-file web app, not a mockup or a list of features.

### BUILD ONLY WHAT IS ON THE MAP (MindCode's core promise)
- The map is the complete, user-reviewed plan. Build every page, feature, data entity and integration it shows, and NOTHING it doesn't show. No extra pages, features or integrations "because apps usually have them".
- Follow each topic bubble's decision exactly ("Color: warm pastels", "Font: rounded sans", "Hosting: serverless", ...). Pages bubbles are the app's views/screens; Features bubbles are its working flows.
- Every visible element you add must carry data-mc for the bubble(s) that caused it. If you need small glue (a nav bar, an empty state), tag it with the closest bubble. Untagged UI is a hidden assumption, so avoid it.

### THE APP MUST ACTUALLY WORK
- One self-contained HTML file: <!doctype html>, <head> with <meta charset> + <meta name="viewport">, one <style>, one <script> at the end of <body>. Vanilla JS only. No external scripts, fonts or images (use CSS, emoji or inline SVG).
- Every visible control does something real: forms submit and validate, lists add/edit/delete, filters filter, navigation switches views. No dead buttons, no "coming soon", no TODO, no lorem ipsum, no alert() placeholders.
- Implement the features named in the map as working UI flows. Ship 3 to 6 realistic seed items so it looks alive on first load.
- There is no server. Implement "api", "data" and "backend" bubbles as a small in-page data layer: a \`store\` object with functions such as \`store.list()\`, \`store.add()\` and \`store.update()\`, persisted with a SAFE storage helper:
    const mem = {}; const storage = { get(k){ try { return JSON.parse(localStorage.getItem(k)); } catch { return mem[k] ?? null; } }, set(k,v){ try { localStorage.setItem(k, JSON.stringify(v)); } catch { mem[k] = v; } } };
  (The preview runs in a sandboxed iframe where localStorage throws, so ALWAYS go through this helper.)
- "Real-time" bubbles: use BroadcastChannel wrapped in try/catch (fall back to no-op) so other tabs update live.
- "Login/auth" bubbles: implement the simplest flow the map describes (e.g. a nickname prompt stored via the helper). Never ask for passwords.
- Unknown or unapproved bubbles: pick the most sensible default, build it, and show the assumption as a small, subtle "Assumed: ..." note in the UI near that feature.
- Quality bar: clean modern design (CSS variables, good spacing, readable type, responsive down to 360px wide, visible focus states). The code must run without console errors: define every function you call, and guard every DOM lookup.
- Keep it compact so it fits: roughly 250 to 600 lines total. Prefer clear, small functions over long comments.

### TRACEABILITY
   - Every significant visual, layout, or interactive HTML element informed by bubbles in the mind map MUST have:
     - \`data-mc-el="e<unique_number>"\` (e.g. data-mc-el="e1", data-mc-el="e2", etc., globally unique per element)
     - \`data-mc="<space-separated node IDs>"\` (e.g. data-mc="n1 n2")
   - ONLY reference node IDs that exist in the provided MindMap. Never invent or hallucinate node IDs.
   - Tag the real, working elements (header, each feature section, forms, key buttons, list containers). Do not add hidden or fake elements just to carry tags.
### LOCKED NODES
   - If any node is marked "locked" and previous HTML is provided, the elements tagged with that locked node's ID in the previous HTML MUST be kept exactly.
### OUTPUT FORMAT
   - Output ONLY the raw HTML document.
   - Do NOT wrap the output in markdown fences (e.g. \`\`\`html ... \`\`\`).
`;

export async function build_app(
  map: MindMap,
  previousHtml: string | null = null
): Promise<string> {
  const isFake = process.env.MINDCODE_FAKE_LLM === "1";
  if (isFake) {
    return fakeBuildApp(map, previousHtml);
  }

  const validNodeIds = new Set((map.nodes || []).map((n) => n.id));
  const lockedNodes = (map.nodes || []).filter((n) => n.status === "locked");
  const lockedNodeIds = new Set(lockedNodes.map((n) => n.id));

  let lockedInstructions = "";
  if (lockedNodes.length > 0 && previousHtml) {
    const preserved = extractLockedElements(previousHtml, lockedNodeIds);
    if (preserved.size > 0) {
      lockedInstructions = `\nPREVIOUS HTML LOCKED ELEMENTS (You MUST preserve these snippets for their respective nodes):\n` +
        Array.from(preserved.entries()).map(([id, snippet]) => `Node ${id}:\n${snippet}`).join("\n\n");
    }
  }

  // Compact node list: what the user decided matters more than raw JSON noise.
  const statusTag = (s: string) => (s === "approved" ? "APPROVED" : s === "locked" ? "LOCKED" : "proposed");
  const nodeLines = (map.nodes || [])
    .map((n) => `- ${n.id} [${n.kind}; from ${n.source}; ${statusTag(n.status)}; importance ${n.importance}/5; parent ${n.parent ?? "none"}] ${n.label}: ${n.detail}`)
    .join("\n");
  const goal = (map.nodes || []).find((n) => n.parent === null);

  const userPrompt = `Build the working app for: ${goal ? `"${goal.label}": ${goal.detail}` : "the app described below"}.

MIND MAP (id [kind; source; status; importance; parent] label: detail):
${nodeLines}

Treat APPROVED and user-sourced bubbles as firm requirements. Proposed "inferred" bubbles are good defaults. For "unknown" bubbles, pick a default and show an "Assumed: ..." note.
${lockedInstructions}

Return only the complete HTML document, starting with <!doctype html> and ending with </html>.`;

  const { rawText } = await callOpenRouter(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt }
    ],
    {
      jsonMode: false,
      // Runs in the build background function (15 min limit), so allow a full app.
      maxTokens: 16000,
      timeoutMs: 8 * 60 * 1000,
      temperature: 0.4,
    }
  );

  let html = cleanHtmlOutput(rawText);
  // A response cut off at the token limit is broken code; fail loudly instead of previewing it.
  if (!/<\/html>\s*$/i.test(html)) {
    throw new Error("The generated app was cut off before </html>. Try Rebuild.");
  }
  html = sanitizeTracedElements(html, validNodeIds);
  html = ensureTracedElementIds(html);
  html = preserveLockedElements(html, previousHtml, lockedNodeIds);

  // If LLM returned text that somehow didn't include <!doctype html>, prepend it
  if (!html.toLowerCase().includes("<!doctype html")) {
    html = `<!doctype html>\n${html}`;
  }

  return html;
}

export const buildApp = build_app;
