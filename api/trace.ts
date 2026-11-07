import type { BuildAudit, MindMap } from "./types";

/**
 * Script injected into every build preview so the map and the page can highlight each other.
 * Page -> parent: {type: "mc-hover", nodes: [...], el} on hover (nodes: [] on leave).
 * Parent -> page: {type: "mc-highlight", nodes: [...]} outlines every element tagged with any of them.
 */
export const TRACE_SCRIPT = `
<style>
  [data-mc].mc-hl { outline: 3px solid #17c894 !important; outline-offset: 2px; }
  [data-mc].mc-hover { outline: 2px dashed #d67408 !important; outline-offset: 2px; }
</style>
<script>
(function () {
  var current = null;
  function tagged(el) { return el && el.closest ? el.closest('[data-mc]') : null; }
  function send(el) {
    parent.postMessage({ type: 'mc-hover', nodes: el ? el.getAttribute('data-mc').split(/\\s+/) : [],
                         el: el ? el.getAttribute('data-mc-el') : null }, '*');
  }
  document.addEventListener('mouseover', function (e) {
    var el = tagged(e.target);
    if (el === current) return;
    if (current) current.classList.remove('mc-hover');
    current = el;
    if (el) el.classList.add('mc-hover');
    send(el);
  });
  document.documentElement.addEventListener('mouseleave', function () {
    if (current) current.classList.remove('mc-hover');
    current = null;
    send(null);
  });
  window.addEventListener('message', function (e) {
    if (!e.data || e.data.type !== 'mc-highlight') return;
    var want = e.data.nodes || [], first = null;
    document.querySelectorAll('[data-mc]').forEach(function (el) {
      var hit = el.getAttribute('data-mc').split(/\\s+/).some(function (n) { return want.indexOf(n) >= 0; });
      el.classList.toggle('mc-hl', hit);
      if (hit && !first) first = el;
    });
    if (first) first.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
})();
</script>
`;

export function inject(html: string): string {
  const i = html.toLowerCase().lastIndexOf("</body>");
  return i === -1 ? html + TRACE_SCRIPT : html.slice(0, i) + TRACE_SCRIPT + html.slice(i);
}

const STRUCTURAL_TAGS = new Set([
  "div", "p", "h1", "h2", "h3", "h4", "h5", "h6",
  "button", "input", "textarea", "select", "form",
  "section", "article", "nav", "header", "footer", "main",
  "ul", "ol", "li", "table", "tr", "td",
]);

const attr = (tag: string, name: string) =>
  tag.match(new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"))?.slice(1).find((v) => v !== undefined);

/**
 * Calculates quantitative traceability audit metrics for hackathon judges:
 * - totalElements: number of structural/semantic HTML elements found
 * - tracedElements: number of structural elements with data-mc attribute
 * - coveragePct: Math.round((tracedElements / Math.max(1, totalElements)) * 100)
 * - nodeBreakdown: Record<string, number> mapping each node ID to the count of elements tagging it
 * - untracedNodes: string[] list of node IDs from map.nodes with 0 elements tagging them
 */
export function auditTrace(html: string, map: MindMap): BuildAudit {
  let totalElements = 0;
  let tracedElements = 0;
  const nodeBreakdown: Record<string, number> = {};

  for (const [tag] of html.matchAll(/<[a-zA-Z][^>]*>/g)) {
    const nameMatch = tag.match(/^<([a-zA-Z][a-zA-Z0-9]*)/);
    if (!nameMatch) continue;
    const tagName = nameMatch[1].toLowerCase();
    if (!STRUCTURAL_TAGS.has(tagName)) continue;

    totalElements++;
    const mc = attr(tag, "data-mc");
    if (mc !== undefined) {
      tracedElements++;
      const ids = mc.split(/\s+/).filter(Boolean);
      for (const id of ids) {
        nodeBreakdown[id] = (nodeBreakdown[id] || 0) + 1;
      }
    }
  }

  const untracedNodes = (map?.nodes ?? [])
    .map((n) => n.id)
    .filter((id) => !nodeBreakdown[id]);

  const coveragePct = Math.round((tracedElements / Math.max(1, totalElements)) * 100);

  return {
    totalElements,
    tracedElements,
    coveragePct,
    nodeBreakdown,
    untracedNodes,
  };
}
