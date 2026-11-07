/**
 * HTML utility functions for traceability attributes, balanced tag parsing,
 * and locked node element preservation across builds.
 */

const VOID_TAGS = new Set([
  "area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "param", "source", "track", "wbr"
]);

/**
 * Given HTML and a startIndex pointing to an opening tag `<tagName ...>`,
 * finds the complete element including its matching closing tag, correctly
 * handling nested tags of the same name and void/self-closing tags.
 */
export function findFullElement(html: string, startIndex: number): { fullElement: string; endIndex: number } | null {
  const openTagMatch = html.slice(startIndex).match(/^<([a-zA-Z0-9]+)(\s[^>]*)?(\/?)>/);
  if (!openTagMatch) return null;

  const tagName = openTagMatch[1].toLowerCase();
  const isSelfClosing = openTagMatch[3] === "/" || VOID_TAGS.has(tagName);
  const openTagEnd = startIndex + openTagMatch[0].length;

  if (isSelfClosing) {
    return {
      fullElement: html.slice(startIndex, openTagEnd),
      endIndex: openTagEnd
    };
  }

  // Scan forward for balanced closing tag </tagName>
  let depth = 1;
  const tagPattern = new RegExp(`<(?:/(${tagName})|(${tagName})(\\s[^>]*)?(/)?)>`, "gi");
  tagPattern.lastIndex = openTagEnd;

  let m: RegExpExecArray | null;
  while ((m = tagPattern.exec(html)) !== null) {
    if (m[1]) {
      // Closing tag </tagName>
      depth--;
      if (depth === 0) {
        const endPos = tagPattern.lastIndex;
        return {
          fullElement: html.slice(startIndex, endPos),
          endIndex: endPos
        };
      }
    } else if (m[2]) {
      // Opening tag <tagName ...>
      if (m[4] !== "/") {
        depth++;
      }
    }
  }

  // Fallback if closing tag is missing
  return {
    fullElement: html.slice(startIndex, openTagEnd),
    endIndex: openTagEnd
  };
}

/**
 * Extracts elements containing locked node IDs in their data-mc attribute from previousHtml.
 * Preserves the full outer element even if it contains nested child tags of the same type.
 */
export function extractLockedElements(previousHtml: string, lockedNodeIds: Set<string>): Map<string, string> {
  const result = new Map<string, string>();
  if (!previousHtml || lockedNodeIds.size === 0) return result;

  const openTagRegex = /<([a-zA-Z0-9]+)\s+[^>]*data-mc=(["'])(.*?)\2[^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = openTagRegex.exec(previousHtml)) !== null) {
    const startIndex = match.index;
    const mcAttr = match[3];
    const ids = mcAttr.split(/\s+/).filter(Boolean);
    const relevantIds = ids.filter((id) => lockedNodeIds.has(id));
    if (relevantIds.length === 0) continue;

    const parsed = findFullElement(previousHtml, startIndex);
    if (parsed) {
      for (const id of relevantIds) {
        if (!result.has(id)) {
          result.set(id, parsed.fullElement);
        }
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
 * Removes empty data-mc attributes if all node IDs were invalid.
 */
export function sanitizeTracedElements(html: string, validNodeIds: Set<string>): string {
  return html.replace(/\s*data-mc=(["'])(.*?)\1/gi, (_match, quote, val) => {
    const ids = val.split(/\s+/).filter((id: string) => validNodeIds.has(id));
    if (ids.length === 0) return "";
    return ` data-mc=${quote}${ids.join(" ")}${quote}`;
  });
}

/**
 * Ensures that every element with data-mc has a valid, unique data-mc-el attribute.
 * Injects data-mc-el="e<N>" if missing or deduplicates colliding IDs.
 */
export function ensureTracedElementIds(html: string): string {
  let maxElNum = 0;
  for (const m of html.matchAll(/data-mc-el=(["'])(.*?)\1/gi)) {
    const num = m[2].trim().match(/^e(\d+)$/i);
    if (num) {
      maxElNum = Math.max(maxElNum, parseInt(num[1], 10));
    }
  }

  const seenElIds = new Set<string>();

  return html.replace(/<([a-zA-Z0-9]+)(\s+[^>]*)?>/gi, (tag, tagName, attrs) => {
    if (!attrs || !/data-mc=/i.test(attrs)) return tag;

    const elAttrMatch = attrs.match(/\s+data-mc-el=(["'])(.*?)\1/i);
    if (!elAttrMatch) {
      maxElNum++;
      const newId = `e${maxElNum}`;
      seenElIds.add(newId);
      return `<${tagName} data-mc-el="${newId}"${attrs}>`;
    }

    const currentId = elAttrMatch[2].trim();
    if (!currentId || seenElIds.has(currentId)) {
      maxElNum++;
      const newId = `e${maxElNum}`;
      seenElIds.add(newId);
      const quote = elAttrMatch[1];
      const fixedAttrs = attrs.replace(/\s+data-mc-el=(["'])(.*?)\1/i, ` data-mc-el=${quote}${newId}${quote}`);
      return `<${tagName}${fixedAttrs}>`;
    }

    seenElIds.add(currentId);
    return tag;
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
    const regex = new RegExp(`<([a-zA-Z0-9]+)\\s+[^>]*data-mc=(["'])[^"']*\\b${nodeId}\\b[^"']*\\2[^>]*>`, "i");
    const m = regex.exec(result);
    if (m) {
      const parsed = findFullElement(result, m.index);
      if (parsed) {
        result = result.slice(0, m.index) + preservedSnippet + result.slice(parsed.endIndex);
      }
    }
  }
  return result;
}
