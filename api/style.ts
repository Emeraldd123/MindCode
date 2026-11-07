// Design widgets: change one traced element's font size, font family or text directly in a build's HTML,
// without asking the LLM. Pure functions so they're easy to test.
import { findFullElement } from "../ai/html_utils";

export interface StylePatch {
  fontSize?: number | null; // px; null removes the override
  fontFamily?: string | null; // CSS font stack; null removes the override
  text?: string; // new text; only for elements whose content is plain text
}

export class StyleError extends Error {}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Validate a request body into a StylePatch; throws StyleError on bad input. */
export function parsePatch(body: unknown): { el: string; patch: StylePatch } {
  const b = (body ?? {}) as Record<string, unknown>;
  const el = typeof b.el === "string" ? b.el.trim() : "";
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(el)) throw new StyleError("el must be a data-mc-el id");
  const patch: StylePatch = {};
  if (b.fontSize !== undefined) {
    if (b.fontSize === null) patch.fontSize = null;
    else {
      const n = Number(b.fontSize);
      if (!Number.isFinite(n) || n < 6 || n > 160) throw new StyleError("fontSize must be 6..160 (px)");
      patch.fontSize = Math.round(n * 10) / 10;
    }
  }
  if (b.fontFamily !== undefined) {
    if (b.fontFamily === null || b.fontFamily === "") patch.fontFamily = null;
    else {
      const f = String(b.fontFamily).replace(/"/g, "'");
      if (f.length > 200 || !/^[\p{L}\p{N} ,'_-]+$/u.test(f)) throw new StyleError("fontFamily has unsupported characters");
      patch.fontFamily = f;
    }
  }
  if (b.text !== undefined) {
    if (typeof b.text !== "string" || b.text.length > 2000) throw new StyleError("text must be a string up to 2000 chars");
    patch.text = b.text;
  }
  if (Object.keys(patch).length === 0) throw new StyleError("nothing to change: send fontSize, fontFamily or text");
  return { el, patch };
}

/** Set or remove CSS declarations in a style attribute value. */
export function setDeclarations(style: string, set: Record<string, string | null>): string {
  const names = new Set(Object.keys(set));
  const kept = style
    .split(";")
    .map((d) => d.trim())
    .filter((d) => d && !names.has(d.split(":")[0].trim().toLowerCase()));
  for (const [k, v] of Object.entries(set)) if (v !== null) kept.push(`${k}: ${v}`);
  return kept.join("; ");
}

/** Apply a patch to the element tagged data-mc-el="<el>". Throws StyleError if it can't. */
export function applyElementStyle(html: string, el: string, patch: StylePatch): string {
  const open = new RegExp(`<([a-zA-Z][a-zA-Z0-9-]*)\\b[^>]*\\bdata-mc-el\\s*=\\s*["']${escapeRe(el)}["'][^>]*>`);
  const m = open.exec(html);
  if (!m) throw new StyleError(`element ${el} is not in the saved HTML (it may be created by the app's script)`);
  const start = m.index;
  let tag = m[0];

  const css: Record<string, string | null> = {};
  if (patch.fontSize !== undefined) css["font-size"] = patch.fontSize === null ? null : `${patch.fontSize}px`;
  if (patch.fontFamily !== undefined) css["font-family"] = patch.fontFamily;
  if (Object.keys(css).length > 0) {
    const styleRe = /\sstyle\s*=\s*("([^"]*)"|'([^']*)')/i;
    const sm = styleRe.exec(tag);
    const current = sm ? (sm[2] ?? sm[3] ?? "") : "";
    const next = setDeclarations(current, css);
    const attr = next ? ` style="${next.replace(/"/g, "'")}"` : "";
    tag = sm ? tag.replace(styleRe, attr) : tag.replace(/\s*(\/?)>$/, `${attr}$1>`);
  }
  html = html.slice(0, start) + tag + html.slice(start + m[0].length);

  if (patch.text !== undefined) {
    const full = findFullElement(html, start);
    if (!full || full.fullElement === tag) throw new StyleError(`element ${el} has no text content to change`);
    const inner = full.fullElement.slice(tag.length, full.fullElement.lastIndexOf("</"));
    if (/<[a-zA-Z]/.test(inner)) throw new StyleError(`element ${el} contains other elements; edit its text with right-click instead`);
    const replaced = tag + escapeHtml(patch.text) + full.fullElement.slice(full.fullElement.lastIndexOf("</"));
    html = html.slice(0, start) + replaced + html.slice(full.endIndex);
  }
  return html;
}
