/**
 * Script injected into every build preview so the map and the page can highlight each other.
 * Page -> parent: {type: "mc-hover", nodes: [...], el} on hover (nodes: [] on leave).
 * Parent -> page: {type: "mc-highlight", nodes: [...]} outlines every element tagged with any of them.
 */
export const TRACE_SCRIPT = `
<style>
  [data-mc].mc-hl { outline: 3px solid #22c55e !important; outline-offset: 2px; }
  [data-mc].mc-hover { outline: 2px dashed #6366f1 !important; outline-offset: 2px; }
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
