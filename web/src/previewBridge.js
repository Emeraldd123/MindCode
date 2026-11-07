// Link between the build preview iframe (Preview.jsx) and the bubble side panel (NodeDrawer).
// Preview registers its iframe after every load; the side panel asks it which elements a bubble
// shaped and pushes live font/text changes into the page. Kept as a tiny module-level store so
// neither component needs new props threaded through App.jsx.

let target = null; // { win: Window, sessionId: string, buildId: string }
const listeners = new Set();
let seq = 0;

/** Preview calls this on every iframe load (buildId null while the frame is still empty). */
export function registerPreview(next) {
  target = next && next.win && next.buildId ? next : null;
  listeners.forEach((fn) => fn(target));
}

export function currentPreview() {
  return target;
}

/** Subscribe to preview (re)loads. Returns an unsubscribe function. */
export function onPreviewChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Ask the page for the elements tagged with any of `nodes`. Resolves [] if there's no preview. */
export function inspectNodes(nodes, { timeoutMs = 1500 } = {}) {
  const t = target;
  if (!t || typeof window === 'undefined') return Promise.resolve([]);
  const id = `i${++seq}`;
  return new Promise((resolve) => {
    const done = (items) => {
      window.removeEventListener('message', onMessage);
      clearTimeout(timer);
      resolve(items);
    };
    const onMessage = (e) => {
      if (e.source !== t.win || !e.data || e.data.type !== 'mc-inspect-result' || e.data.id !== id) return;
      done(Array.isArray(e.data.items) ? e.data.items : []);
    };
    const timer = setTimeout(() => done([]), timeoutMs);
    window.addEventListener('message', onMessage);
    t.win.postMessage({ type: 'mc-inspect', id, nodes }, '*');
  });
}

/** Apply a change to one element in the live page (not saved; see api.styleBuild). */
export function applyLive(el, patch) {
  target?.win.postMessage({ type: 'mc-style', el, ...patch }, '*');
}

/** Scroll the page to an element and flash it. */
export function flashElement(el) {
  target?.win.postMessage({ type: 'mc-flash', el }, '*');
}
