// Pure helpers for the hierarchical bubble explorer (MindMap.jsx): one level of the tree at a time.
import { packSiblings, packEnclose } from 'd3-hierarchy';

// Figma "Status chip" vocabulary (design/figma-graph): every bubble is one of
// clear (user said it, or approved/locked), assumed (Claude inferred it), needs (unknown, needs an answer).
export const STATUS_LABELS = { clear: 'Clear', assumed: 'Assumed', needs: 'Needs info' };
export function mapStatus(node) {
  const status = node?.status || 'proposed';
  if (status === 'approved' || status === 'locked') return 'clear';
  const source = node?.source || 'user';
  if (source === 'unknown') return 'needs';
  if (source === 'inferred') return 'assumed';
  return 'clear';
}

// Tree from the map: the `parent` field, plus edges pointing at parentless nodes.
// Nodes caught in a parent cycle become roots so nothing disappears.
export function buildTree(nodes = [], edges = []) {
  const ids = new Set(nodes.map((n) => n.id));
  const hasParentField = new Set(nodes.filter((n) => n.parent).map((n) => n.id));
  const parentOf = new Map();
  nodes.forEach((n) => {
    if (n.parent && n.parent !== n.id && ids.has(n.parent)) parentOf.set(n.id, n.parent);
  });
  (edges || []).forEach((e) => {
    if (!parentOf.has(e.to) && !hasParentField.has(e.to) && ids.has(e.from) && ids.has(e.to) && e.from !== e.to) {
      parentOf.set(e.to, e.from);
    }
  });

  // Break cycles: walk up from each node; if we come back to it, cut its parent link.
  nodes.forEach((n) => {
    const seen = new Set([n.id]);
    let cur = parentOf.get(n.id);
    while (cur) {
      if (seen.has(cur)) { parentOf.delete(n.id); break; }
      seen.add(cur);
      cur = parentOf.get(cur);
    }
  });

  const children = new Map(nodes.map((n) => [n.id, []]));
  const roots = [];
  nodes.forEach((n) => {
    const p = parentOf.get(n.id);
    if (p) children.get(p).push(n.id);
    else roots.push(n.id);
  });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  return { roots, children, parentOf, byId };
}

// When the whole map hangs off one node (usually the goal), that node is the top level:
// showing a screen with a single bubble on it would just cost a click.
export function soleRootId(tree) {
  return tree.roots.length === 1 ? tree.roots[0] : null;
}

// The level actually shown: activeId, or the sole root when activeId is null.
export function effectiveLevel(tree, activeId) {
  if (activeId && tree.byId.has(activeId)) return activeId;
  return soleRootId(tree);
}

// Ids of the bubbles visible at a level (null level = all roots).
export function levelChildren(tree, levelId) {
  if (levelId == null) return tree.roots;
  return tree.children.get(levelId) || [];
}

// Ancestor chain root → id (ids), cycle-safe because buildTree already cut cycles.
export function ancestorPath(tree, id) {
  const path = [];
  let cur = id;
  while (cur && tree.byId.has(cur)) {
    path.unshift(cur);
    cur = tree.parentOf.get(cur);
  }
  return path;
}

// Breadcrumb items for a level: [{ id, label }], id null = the top level.
export function breadcrumbs(tree, levelId, rootLabel = 'Project') {
  const sole = soleRootId(tree);
  const path = levelId ? ancestorPath(tree, levelId) : [];
  if (sole) {
    return [{ id: null, label: tree.byId.get(sole)?.label || rootLabel }, ...path.slice(1).map((id) => ({ id, label: tree.byId.get(id)?.label ?? id }))];
  }
  return [{ id: null, label: rootLabel }, ...path.map((id) => ({ id, label: tree.byId.get(id)?.label ?? id }))];
}

// Long paths keep the root and the last `keepTail` crumbs; the middle goes into a menu.
export function collapseCrumbs(crumbs, max = 4, keepTail = 2) {
  if (crumbs.length <= max) return { head: crumbs, hidden: [], tail: [] };
  return { head: crumbs.slice(0, 1), hidden: crumbs.slice(1, crumbs.length - keepTail), tail: crumbs.slice(-keepTail) };
}

// Where "Back" goes from a level: its parent, null for the top (normalized for the sole-root case).
export function parentLevel(tree, levelId) {
  if (!levelId) return null;
  const p = tree.parentOf.get(levelId) ?? null;
  return p === soleRootId(tree) ? null : p;
}

// The level a node is shown on (its parent), normalized like parentLevel.
export function levelOf(tree, id) {
  const p = tree.parentOf.get(id) ?? null;
  return p === soleRootId(tree) ? null : p;
}

export function descendantIds(tree, id) {
  const out = [];
  const stack = [...(tree.children.get(id) || [])];
  while (stack.length) {
    const cur = stack.pop();
    out.push(cur);
    stack.push(...(tree.children.get(cur) || []));
  }
  return out;
}

// Status counts over everything below a bubble (not the bubble itself).
export function descendantCounts(tree, id) {
  const counts = { total: 0, clear: 0, assumed: 0, needs: 0 };
  descendantIds(tree, id).forEach((d) => {
    counts.total += 1;
    counts[mapStatus(tree.byId.get(d))] += 1;
  });
  return counts;
}

// "2 clear · 4 assumed · 3 need info" (only non-zero parts).
export function countsText(counts) {
  const parts = [];
  if (counts.clear) parts.push(`${counts.clear} clear`);
  if (counts.assumed) parts.push(`${counts.assumed} assumed`);
  if (counts.needs) parts.push(`${counts.needs} need${counts.needs === 1 ? 's' : ''} info`);
  return parts.join(' · ');
}

// For each id in `marked` (highlighted / changed), the visible bubble that contains it:
// itself if it's on this level, otherwise its ancestor on this level.
export function visibleMarks(tree, visibleIds, marked = []) {
  const visible = new Set(visibleIds);
  const out = new Set();
  marked.forEach((id) => {
    let cur = id;
    while (cur && !visible.has(cur)) cur = tree.parentOf.get(cur);
    if (cur) out.add(cur);
  });
  return out;
}

// Bubble radius in flow units. Bubbles never shrink with depth. A leaf's size comes from its importance;
// a branch (has bubbles inside) is BRANCH_SCALE times its leaf size, so structure reads as bigger than
// single decisions without becoming huge.
export const LEAF_RADIUS = 100;
export const BRANCH_SCALE = 1.5;
export const MIN_RADIUS = 88;
export const MAX_RADIUS = Math.round(112 * BRANCH_SCALE);
export function bubbleRadius(node, isBranch = false) {
  const imp = Number(node?.importance);
  const i = Number.isInteger(imp) && imp >= 1 && imp <= 5 ? imp : 3;
  const leaf = LEAF_RADIUS + (i - 3) * 6; // 88..112
  return Math.round(isBranch ? leaf * BRANCH_SCALE : leaf);
}

// Siblings packed without overlap, centered on (0,0), inside a lens circle with a top margin
// for its overline. items: [{ id, r }] → { bubbles: Map id → { x, y, r }, lens: { x, y, r } }.
export const SIBLING_GAP = 28;
export const LENS_MARGIN = 80;
export const EMPTY_LENS = 260;
export function levelLayout(items = [], { gap = SIBLING_GAP, margin = LENS_MARGIN } = {}) {
  const bubbles = new Map();
  if (items.length === 0) return { bubbles, lens: { x: 0, y: 0, r: EMPTY_LENS } };
  // Biggest first packs tighter; ties keep input order so the layout is stable.
  const circles = items
    .map((it, idx) => ({ id: it.id, r: it.r + gap / 2, idx }))
    .sort((a, b) => b.r - a.r || a.idx - b.idx);
  packSiblings(circles);
  const enc = packEnclose(circles);
  circles.forEach((c) => {
    bubbles.set(c.id, { x: Math.round(c.x - enc.x), y: Math.round(c.y - enc.y), r: c.r - gap / 2 });
  });
  return { bubbles, lens: { x: 0, y: 0, r: Math.round(enc.r + margin) } };
}
