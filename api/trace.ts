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
  .mc-inspecting, .mc-inspecting * { cursor: crosshair !important; }
  [data-mc].mc-pinned { outline: 3px solid #ffffff !important; outline-offset: 3px; box-shadow: 0 0 0 7px rgba(23,200,148,.35) !important; }
  .mc-edit { outline: 3px solid #d67408 !important; outline-offset: 3px; box-shadow: 0 0 0 6px rgba(214,116,8,.18) !important; }
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
  // In-page links: inside a srcdoc iframe, href="#work" resolves against the PARENT page's URL and
  // navigates the frame away, so generated sites' nav links and "View my work" buttons looked dead.
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.charAt(0) === '#') {
      e.preventDefault();
      var id = href.slice(1);
      var t = id ? (document.getElementById(id) || document.querySelector('[name="' + id + '"]')) : null;
      try { if (location.hash !== href) history.replaceState(null, '', href); window.dispatchEvent(new HashChangeEvent('hashchange')); } catch (err) {}
      if (t) t.scrollIntoView({ behavior: 'smooth', block: 'start' });
      else if (!id) window.scrollTo({ top: 0, behavior: 'smooth' });
    } else if (/^(https?:|mailto:|tel:)/i.test(href)) {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener');
    }
  }, true);

  // Inspect mode (toggled from MindCode): clicking an element PINS its bubbles, so the highlight
  // stays while you scroll the map. Click it again (or Esc) to release. Normal clicks are paused.
  var inspect = false, pinned = null;
  function unpin() {
    if (pinned) pinned.classList.remove('mc-pinned');
    pinned = null;
    parent.postMessage({ type: 'mc-pin', nodes: [], el: null }, '*');
  }
  document.addEventListener('click', function (e) {
    if (!inspect) return;
    e.preventDefault();
    e.stopPropagation();
    var el = tagged(e.target);
    if (!el || el === pinned) { unpin(); return; }
    if (pinned) pinned.classList.remove('mc-pinned');
    pinned = el;
    el.classList.add('mc-pinned');
    parent.postMessage({ type: 'mc-pin', nodes: el.getAttribute('data-mc').split(/\\s+/), el: el.getAttribute('data-mc-el'),
                         text: (el.innerText || '').trim().slice(0, 80) }, '*');
  }, true);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pinned) unpin(); });

  // Right-click any element -> ask MindCode for a targeted change to it.
  var editEl = null;
  document.addEventListener('contextmenu', function (e) {
    var el = tagged(e.target) || e.target;
    if (!el || el === document.documentElement || el === document.body) return;
    e.preventDefault();
    if (editEl) editEl.classList.remove('mc-edit');
    editEl = el;
    el.classList.add('mc-edit');
    parent.postMessage({
      type: 'mc-edit',
      el: el.getAttribute('data-mc-el'),
      nodes: el.getAttribute('data-mc') ? el.getAttribute('data-mc').split(/\\s+/) : [],
      tag: el.tagName.toLowerCase(),
      text: (el.innerText || el.value || '').trim().slice(0, 160),
      snippet: el.outerHTML.slice(0, 1500),
      x: e.clientX,
      y: e.clientY
    }, '*');
  });

  // Design widgets (side panel): describe a bubble's elements, and apply font/text changes live.
  function byEl(id) {
    var found = null;
    document.querySelectorAll('[data-mc-el]').forEach(function (x) { if (!found && x.getAttribute('data-mc-el') === id) found = x; });
    return found;
  }
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.type === 'mc-inspect') {
      var want = d.nodes || [], items = [];
      document.querySelectorAll('[data-mc][data-mc-el]').forEach(function (el) {
        var ids = el.getAttribute('data-mc').split(/\\s+/);
        if (!ids.some(function (n) { return want.indexOf(n) >= 0; })) return;
        var cs = getComputedStyle(el);
        items.push({
          el: el.getAttribute('data-mc-el'),
          tag: el.tagName.toLowerCase(),
          text: (el.innerText || el.value || el.getAttribute('placeholder') || '').trim().slice(0, 300),
          textEditable: el.children.length === 0 && !/^(input|textarea|select|img)$/i.test(el.tagName),
          fontSize: parseFloat(cs.fontSize) || 16,
          fontFamily: cs.fontFamily
        });
      });
      parent.postMessage({ type: 'mc-inspect-result', id: d.id, items: items }, '*');
    } else if (d.type === 'mc-style') {
      var t = byEl(d.el);
      if (!t) return;
      if (d.fontSize !== undefined) t.style.fontSize = d.fontSize ? d.fontSize + 'px' : '';
      if (d.fontFamily !== undefined) t.style.fontFamily = d.fontFamily || '';
      if (typeof d.text === 'string' && t.children.length === 0) t.textContent = d.text;
    } else if (d.type === 'mc-flash') {
      var f = byEl(d.el);
      if (!f) return;
      f.scrollIntoView({ block: 'center', behavior: 'smooth' });
      f.classList.add('mc-edit');
      setTimeout(function () { f.classList.remove('mc-edit'); }, 900);
    }
  });

  window.addEventListener('message', function (e) {
    if (e.data && e.data.type === 'mc-edit-clear' && editEl) { editEl.classList.remove('mc-edit'); editEl = null; }
    if (e.data && e.data.type === 'mc-inspect') {
      inspect = !!e.data.on;
      document.documentElement.classList.toggle('mc-inspecting', inspect);
      if (!inspect) unpin();
    }
    if (e.data && e.data.type === 'mc-unpin') unpin();
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
