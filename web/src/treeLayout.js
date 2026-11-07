// Pure layout + lineage helpers for the Tree map view (unit-tested in treeLayout.test.js).
//
// Layout: a left-to-right "tidy tree". Every node sits in its own row band directly beside its
// parent, children stacked under each other and their parent vertically centered on them. So you can
// always follow a branch (e.g. Design → Brand → "Rounded cards") without lines crossing over.

export const COL_W = 300; // horizontal distance between depths
export const ROW_H = 64; // vertical distance between leaf rows

const FACET_ORDER = { goal: 0, design: 1, audience: 2, functionality: 3, cost: 4 };

/** children map (parent id → child nodes), roots, stable ordering. Invalid/cyclic parents become roots. */
export function buildTree(map) {
  const nodes = map?.nodes ?? [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const kids = new Map();
  const roots = [];
  const order = (a, b) =>
    (FACET_ORDER[a.facet] ?? 9) - (FACET_ORDER[b.facet] ?? 9) || String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  for (const n of nodes) {
    const p = n.parent && byId.has(n.parent) && n.parent !== n.id && !createsCycle(byId, n) ? n.parent : null;
    if (p) {
      if (!kids.has(p)) kids.set(p, []);
      kids.get(p).push(n);
    } else roots.push(n);
  }
  for (const list of kids.values()) list.sort(order);
  roots.sort(order);
  return { byId, kids, roots };
}

function createsCycle(byId, n) {
  const seen = new Set([n.id]);
  let cur = byId.get(n.parent);
  while (cur) {
    if (seen.has(cur.id)) return true;
    seen.add(cur.id);
    cur = cur.parent ? byId.get(cur.parent) : null;
  }
  return false;
}

/**
 * Positions for every visible node. `collapsed` is a Set of node ids whose subtree is hidden.
 * Returns { pos: Map(id → {x, y, depth}), hiddenCount: Map(id → number of hidden descendants) }.
 */
export function layoutTree(map, collapsed = new Set()) {
  const { kids, roots } = buildTree(map);
  const pos = new Map();
  const hiddenCount = new Map();
  let row = 0;
  const countDesc = (id) => (kids.get(id) || []).reduce((s, c) => s + 1 + countDesc(c.id), 0);
  const place = (n, depth) => {
    const children = kids.get(n.id) || [];
    if (collapsed.has(n.id) && children.length) hiddenCount.set(n.id, countDesc(n.id));
    const visible = collapsed.has(n.id) ? [] : children;
    let y;
    if (!visible.length) {
      y = row * ROW_H;
      row += 1;
    } else {
      const ys = visible.map((c) => place(c, depth + 1));
      y = (ys[0] + ys[ys.length - 1]) / 2;
    }
    pos.set(n.id, { x: depth * COL_W, y, depth });
    return y;
  };
  for (const r of roots) {
    place(r, 0);
    row += 0.5; // a little air between separate trees
  }
  return { pos, hiddenCount };
}

/** Ids from the root down to `id` (inclusive), in order. */
export function ancestorsOf(map, id) {
  const byId = new Map((map?.nodes ?? []).map((n) => [n.id, n]));
  const path = [];
  const seen = new Set();
  let cur = byId.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur.id);
    cur = cur.parent ? byId.get(cur.parent) : null;
  }
  return path;
}

/** All descendant ids of `id` (not including it). */
export function descendantsOf(map, id) {
  const { kids } = buildTree(map);
  const out = [];
  const walk = (x) => (kids.get(x) || []).forEach((c) => (out.push(c.id), walk(c.id)));
  walk(id);
  return out;
}
