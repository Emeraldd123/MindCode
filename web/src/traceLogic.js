// Pure parsing and metric calculation helpers for Traceability Audit

export const SEMANTIC_TAGS = new Set([
  'div',
  'p',
  'h1',
  'h2',
  'h3',
  'button',
  'input',
  'form',
  'section',
  'article',
  'nav',
  'ul',
  'li',
]);

/**
 * Extracts attribute value from a raw tag string (case-insensitive).
 */
function getAttr(tag, name) {
  const match = tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i'));
  return match?.slice(1).find((v) => v !== undefined);
}

/**
 * Parses an HTML string and calculates traceability metrics against mind map nodes.
 * Works both in browser (DOMParser) and in Node.js / test environments.
 *
 * @param {string} html Raw HTML of the build preview
 * @param {object} map MindMap object containing nodes
 * @returns {{
 *   tracedCount: number,
 *   totalCount: number,
 *   coveragePct: number,
 *   nodeBreakdown: Record<string, number>
 * }}
 */
export function analyzeTraceability(html, map) {
  if (!html || typeof html !== 'string') {
    return {
      tracedCount: 0,
      totalCount: 0,
      coveragePct: 0,
      nodeBreakdown: {},
    };
  }

  // Build a valid set of node ids if map is provided
  const validNodeIds = new Set(
    (map?.nodes ?? []).map((n) => n.id).filter(Boolean)
  );

  let totalCount = 0;
  let tracedCount = 0;
  const nodeBreakdown = {};

  // If running in browser environment with DOMParser
  if (typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const allElements = doc.querySelectorAll('*');

      for (const el of allElements) {
        const tagName = el.tagName.toLowerCase();
        const hasMc = el.hasAttribute('data-mc');
        const hasMcEl = el.hasAttribute('data-mc-el');

        // Counts total semantic/structural elements or elements with data-mc / data-mc-el
        const isSemantic = SEMANTIC_TAGS.has(tagName);
        if (isSemantic || hasMc || hasMcEl) {
          totalCount++;
        }

        if (hasMc) {
          tracedCount++;
          const mcAttr = el.getAttribute('data-mc') || '';
          const ids = mcAttr.trim().split(/\s+/).filter(Boolean);
          for (const nid of ids) {
            // If map has nodes, we can still count valid ones, or track all traced node ids
            if (validNodeIds.size === 0 || validNodeIds.has(nid)) {
              nodeBreakdown[nid] = (nodeBreakdown[nid] || 0) + 1;
            }
          }
        }
      }

      const coveragePct = Math.round((tracedCount / Math.max(1, totalCount)) * 100);
      return {
        tracedCount,
        totalCount,
        coveragePct,
        nodeBreakdown,
      };
    } catch {
      // Fallback to regex parser if DOMParser fails
    }
  }

  // Node.js / regex fallback
  // Match start opening tags: <tag ...>
  // Exclude self-closing slashes or closing tags </tag>
  const tagRegex = /<([a-zA-Z0-9-]+)([^>]*)>/g;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const fullTag = match[0];
    const tagName = match[1].toLowerCase();
    const attrs = match[2];

    // Skip closing tags if regex matched (though regex starts with <tag)
    if (fullTag.startsWith('</')) continue;
    // Skip doctype or comments
    if (tagName.startsWith('!') || tagName === 'doctype') continue;

    const mc = getAttr(attrs, 'data-mc');
    const mcEl = getAttr(attrs, 'data-mc-el');
    const hasMc = mc !== undefined;
    const hasMcEl = mcEl !== undefined;
    const isSemantic = SEMANTIC_TAGS.has(tagName);

    if (isSemantic || hasMc || hasMcEl) {
      totalCount++;
    }

    if (hasMc) {
      tracedCount++;
      const ids = mc.trim().split(/\s+/).filter(Boolean);
      for (const nid of ids) {
        if (validNodeIds.size === 0 || validNodeIds.has(nid)) {
          nodeBreakdown[nid] = (nodeBreakdown[nid] || 0) + 1;
        }
      }
    }
  }

  const coveragePct = Math.round((tracedCount / Math.max(1, totalCount)) * 100);
  return {
    tracedCount,
    totalCount,
    coveragePct,
    nodeBreakdown,
  };
}
