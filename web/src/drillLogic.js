// Pure helpers for the drill-in view (DrillIn.jsx), from the Figma "Branding drill-in" frame.
import { mapStatus } from './MindMap';

export const LENS = 960;      // Figma lens diameter
export const DECISION = 340;  // Figma decision bubble diameter
const GAP = 28;               // Figma gap between decision bubbles
const GRID = 2 * DECISION + GAP; // 708: the 2x2 grid's width in the Figma frame

// Direct children of a node: `parent` links, plus "has" edges to nodes that have no parent.
export function childrenOf(map, id) {
  const nodes = map?.nodes || [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = nodes.filter((n) => n.parent === id && n.id !== id);
  (map?.edges || []).forEach((e) => {
    const child = byId.get(e.to);
    if (e.from === id && child && !child.parent && child.id !== id && !out.includes(child)) out.push(child);
  });
  return out;
}

export function hasChildren(map, id) {
  return childrenOf(map, id).length > 0;
}

// Ancestors from the root down to the node itself (cycle-safe).
export function pathTo(map, id) {
  const byId = new Map((map?.nodes || []).map((n) => [n.id, n]));
  const path = [];
  const seen = new Set();
  let cur = byId.get(id);
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    path.unshift(cur);
    cur = cur.parent ? byId.get(cur.parent) : null;
  }
  return path;
}

export function drillCounts(children = []) {
  const counts = { total: children.length, clear: 0, assumed: 0, needs: 0 };
  children.forEach((n) => { counts[mapStatus(n)] += 1; });
  return counts;
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

// "4 decisions inside · 2 Claude guesses to confirm · 2 need your answer"
export function summaryText(counts) {
  const parts = [`${plural(counts.total, 'decision', 'decisions')} inside`];
  if (counts.assumed) parts.push(`${plural(counts.assumed, 'Claude guess', 'Claude guesses')} to confirm`);
  if (counts.needs) parts.push(`${counts.needs} need${counts.needs === 1 ? 's' : ''} your answer`);
  return parts.join(' · ');
}

// Decision bubble centers inside the lens (lens coords, 0..LENS). 1-4 children use the Figma 2x2
// grid of 340px bubbles; more children get a denser grid with smaller bubbles.
export function decisionLayout(count) {
  if (count <= 0) return [];
  const cols = count === 1 ? 1 : Math.max(2, Math.ceil(Math.sqrt(count)));
  const rows = Math.ceil(count / cols);
  const d = Math.min(DECISION, Math.floor((GRID + GAP) / cols - GAP));
  const step = d + GAP;
  const c = LENS / 2;
  const out = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const inRow = row === rows - 1 ? count - row * cols : cols; // last row may be short: center it
    const col = i - row * cols;
    out.push({
      x: Math.round(c + (col - (inRow - 1) / 2) * step),
      y: Math.round(c + (row - (rows - 1) / 2) * step),
      d,
    });
  }
  return out;
}

// Optional `decision` payload on a node (docs/api-contract.md). Returns null when it's missing or malformed.
export function normalizeDecision(decision) {
  if (!decision || typeof decision !== 'object') return null;
  const idx = (v, len) => (Number.isInteger(v) && v >= 0 && v < len ? v : null);
  if (decision.type === 'choice' && Array.isArray(decision.options) && decision.options.length > 0) {
    const options = decision.options.filter((o) => o && typeof o.label === 'string').slice(0, 4);
    if (options.length === 0) return null;
    return { ...decision, options, pick: idx(decision.pick, options.length) };
  }
  if (decision.type === 'scale' && Array.isArray(decision.scales) && decision.scales.length > 0) {
    const scales = decision.scales
      .filter((s) => s && typeof s.left === 'string' && typeof s.right === 'string')
      .slice(0, 5)
      .map((s) => ({ ...s, value: idx(s.value, 5) ?? 2 }));
    return scales.length ? { ...decision, scales } : null;
  }
  if (decision.type === 'drafts' && Array.isArray(decision.drafts)) {
    const drafts = decision.drafts.filter((t) => typeof t === 'string' && t.trim()).slice(0, 4);
    return { ...decision, drafts, pick: idx(decision.pick, drafts.length) };
  }
  return null;
}
