// Right-click edit: apply ONE targeted change to an existing generated app.
// The user right-clicks an element in the preview and says what to change; we send Claude the
// current HTML, the element and the instruction, and get the full updated document back.
import type { MindMap } from "./types.ts";
import { ensureTracedElementIds, sanitizeTracedElements } from "./html_utils.ts";
import { generateHtml } from "./longform.ts";

export interface ChangeRequest {
  base: string;
  instruction: string;
  el?: string | null;
  nodes?: string[];
  snippet?: string;
}

const SYSTEM_PROMPT = `You are Claude, editing an existing single-file web app that MindCode generated.
Apply exactly the change the user asks for. Everything else stays byte-for-byte the same: structure, styles, scripts, content, and every data-mc / data-mc-el attribute.
- The change targets the element the user right-clicked (given below). Change other parts only if the request truly requires it (e.g. a new button needs its handler in the script).
- Keep the app fully working and ship-ready: no placeholders, no "Assumed" notes, no TODOs, no console errors.
- New elements you add get data-mc with the same bubble ids as the element you edited, plus a new unique data-mc-el.
- Output ONLY the complete updated HTML document, from <!doctype html> to </html>. No markdown fences, no explanation.`;

export async function edit_app(html: string, map: MindMap, request: ChangeRequest): Promise<string> {
  if (process.env.MINDCODE_FAKE_LLM === "1") {
    return html.replace(/<\/body>/i, `<!-- edit: ${request.instruction.replace(/--/g, "")} --></body>`);
  }
  const bubbles = (map.nodes || [])
    .filter((n) => (request.nodes || []).includes(n.id))
    .map((n) => `- ${n.id}: ${n.label}: ${n.detail}`)
    .join("\n");
  const userPrompt = `CHANGE REQUEST: ${request.instruction}

RIGHT-CLICKED ELEMENT${request.el ? ` (data-mc-el="${request.el}")` : ""}:
${request.snippet || "(not captured; find the best match from the request)"}

BUBBLES THIS ELEMENT TRACES TO:
${bubbles || "(none)"}

CURRENT APP HTML:
${html}`;

  // Runs in the build background function (15 min); continues past the token cap if needed.
  let out = await generateHtml(
    [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: userPrompt },
    ],
    { maxTokens: 24000, timeoutMs: 6 * 60 * 1000, temperature: 0.2 },
  );
  out = sanitizeTracedElements(out, new Set((map.nodes || []).map((n) => n.id)));
  out = ensureTracedElementIds(out);
  if (!out.toLowerCase().includes("<!doctype html")) out = `<!doctype html>\n${out}`;
  return out;
}

export const editApp = edit_app;
