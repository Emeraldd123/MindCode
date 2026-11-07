// Targeted edits to an existing generated app: right-click changes, and rebuilds after small map changes.
//
// Fast path: Claude returns small FIND/REPLACE patches, which we apply to the current HTML. That's
// seconds instead of re-emitting a 30-50 KB document. If any patch doesn't match exactly, we fall
// back to the full rewrite (the original behaviour), so the result is never a half-applied app.
import type { MindMap } from "./types.ts";
import { callOpenRouter } from "./client.ts";
import { ensureTracedElementIds, sanitizeTracedElements } from "./html_utils.ts";
import { generateHtml } from "./longform.ts";

export interface ChangeRequest {
  base: string;
  instruction: string;
  el?: string | null;
  nodes?: string[];
  snippet?: string;
}

const RULES = `- Change only what the request needs. Everything else stays byte-for-byte the same: structure, styles, scripts, content, and every data-mc / data-mc-el attribute.
- Keep the app fully working and ship-ready: no placeholders, no "Assumed" notes, no TODOs, no console errors. If a new control needs JS, add the handler too.
- New elements get data-mc with the relevant bubble ids, plus a new unique data-mc-el.`;

const PATCH_PROMPT = `You are Claude, editing an existing single-file web app that MindCode generated.
${RULES}
Reply ONLY with one or more patches in exactly this format, and nothing else:
<<<<<<< FIND
(an exact, unique snippet copied character-for-character from the current HTML, a few lines long)
=======
(the replacement)
>>>>>>> REPLACE
Each FIND must appear exactly once in the current HTML. Keep FIND snippets short but unique. Use several patches for several places.`;

const FULL_PROMPT = `You are Claude, editing an existing single-file web app that MindCode generated.
${RULES}
- Output ONLY the complete updated HTML document, from <!doctype html> to </html>. No markdown fences, no explanation.`;

export interface Patch {
  find: string;
  replace: string;
}

/** Parse FIND/REPLACE blocks. Returns [] if none are found. */
export function parsePatches(text: string): Patch[] {
  const out: Patch[] = [];
  const re = /<<<<<<< FIND\r?\n([\s\S]*?)\r?\n=======\r?\n([\s\S]*?)\r?\n?>>>>>>> REPLACE/g;
  for (const m of text.matchAll(re)) out.push({ find: m[1], replace: m[2] });
  return out;
}

/** Apply patches; returns null if any FIND is missing or ambiguous (caller falls back to a full rewrite). */
export function applyPatches(html: string, patches: Patch[]): string | null {
  if (!patches.length) return null;
  let out = html;
  for (const p of patches) {
    if (!p.find) return null;
    const first = out.indexOf(p.find);
    if (first === -1 || out.indexOf(p.find, first + 1) !== -1) return null;
    out = out.slice(0, first) + p.replace + out.slice(first + p.find.length);
  }
  return out;
}

function finish(out: string, map: MindMap): string {
  out = sanitizeTracedElements(out, new Set((map.nodes || []).map((n) => n.id)));
  out = ensureTracedElementIds(out);
  if (!out.toLowerCase().includes("<!doctype html")) out = `<!doctype html>\n${out}`;
  return out;
}

export async function edit_app(html: string, map: MindMap, request: ChangeRequest): Promise<string> {
  if (process.env.MINDCODE_FAKE_LLM === "1") {
    return html.replace(/<\/body>/i, `<!-- edit: ${request.instruction.replace(/--/g, "")} --></body>`);
  }
  const bubbles = (map.nodes || [])
    .filter((n) => (request.nodes || []).includes(n.id))
    .map((n) => `- ${n.id}: ${n.label}: ${n.detail}`)
    .join("\n");
  const userPrompt = `CHANGE REQUEST: ${request.instruction}

${request.snippet ? `TARGET ELEMENT${request.el ? ` (data-mc-el="${request.el}")` : ""}:\n${request.snippet}\n` : ""}
${bubbles ? `BUBBLES IT TRACES TO:\n${bubbles}\n` : ""}
CURRENT APP HTML:
${html}`;

  // 1) Fast path: patches.
  try {
    const { rawText } = await callOpenRouter(
      [
        { role: "system", content: PATCH_PROMPT },
        { role: "user", content: userPrompt },
      ],
      { jsonMode: false, maxTokens: 8000, timeoutMs: 3 * 60 * 1000, temperature: 0.1 },
    );
    const patched = applyPatches(html, parsePatches(rawText));
    if (patched && /<\/html>\s*$/i.test(patched.trim())) return finish(patched, map);
    console.warn("edit: patches did not apply cleanly, falling back to a full rewrite");
  } catch (e) {
    console.warn("edit: patch attempt failed, falling back to a full rewrite", e);
  }

  // 2) Fallback: full rewrite (continues past the output cap if needed).
  const full = await generateHtml(
    [
      { role: "system", content: FULL_PROMPT },
      { role: "user", content: userPrompt },
    ],
    { maxTokens: 24000, timeoutMs: 6 * 60 * 1000, temperature: 0.2 },
  );
  return finish(full, map);
}

export const editApp = edit_app;
