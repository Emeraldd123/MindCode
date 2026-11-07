import { describe, it, expect } from 'vitest';
import {
  buildTree, soleRootId, effectiveLevel, levelChildren, ancestorPath, breadcrumbs, collapseCrumbs,
  parentLevel, levelOf, descendantCounts, countsText, visibleMarks, bubbleRadius, levelLayout,
  MIN_RADIUS, MAX_RADIUS, LENS_MARGIN, BRANCH_SCALE,
} from './hierarchyLogic';

// Project → Design → Pages → Home → (Hero, Nav, Footer), from the feature spec.
const nodes = [
  { id: 'design', label: 'Design', source: 'user' },
  { id: 'func', label: 'Functionality', source: 'user' },
  { id: 'aud', label: 'Audience', source: 'inferred' },
  { id: 'cost', label: 'Cost', source: 'unknown' },
  { id: 'brand', label: 'Branding', parent: 'design', source: 'inferred' },
  { id: 'logo', label: 'Logo', parent: 'brand', source: 'unknown' },
  { id: 'type', label: 'Typography', parent: 'brand', source: 'inferred', status: 'approved' },
  { id: 'pages', label: 'Pages', parent: 'design', source: 'user' },
  { id: 'home', label: 'Home', parent: 'pages', source: 'user' },
  { id: 'about', label: 'About', parent: 'pages', source: 'inferred' },
  { id: 'hero', label: 'Hero Section', parent: 'home', source: 'inferred' },
  { id: 'nav', label: 'Navigation', parent: 'home', source: 'unknown' },
  { id: 'footer', label: 'Footer', parent: 'home', source: 'user' },
];
const tree = buildTree(nodes, []);
const ids = (list) => list.map((c) => c.id);

describe('hierarchy navigation', () => {
  it('shows only top-level bubbles at the root and direct children below', () => {
    expect(effectiveLevel(tree, null)).toBe(null);
    expect(levelChildren(tree, null)).toEqual(['design', 'func', 'aud', 'cost']);
    expect(levelChildren(tree, 'design')).toEqual(['brand', 'pages']);
    expect(levelChildren(tree, 'home')).toEqual(['hero', 'nav', 'footer']);
    expect(levelChildren(tree, 'footer')).toEqual([]);
  });

  it('falls back to the top level when the active bubble no longer exists', () => {
    expect(effectiveLevel(tree, 'deleted')).toBe(null);
  });

  it('builds breadcrumbs from the ancestor chain, with a virtual Project root', () => {
    expect(ancestorPath(tree, 'home')).toEqual(['design', 'pages', 'home']);
    expect(breadcrumbs(tree, 'home').map((c) => c.label)).toEqual(['Project', 'Design', 'Pages', 'Home']);
    expect(ids(breadcrumbs(tree, null))).toEqual([null]);
  });

  it('back goes to the parent; levelOf finds where a bubble is shown', () => {
    expect(parentLevel(tree, 'home')).toBe('pages');
    expect(parentLevel(tree, 'design')).toBe(null);
    expect(levelOf(tree, 'hero')).toBe('home');
    expect(levelOf(tree, 'cost')).toBe(null);
  });

  it('treats a single root (the goal) as the top level, not a one-bubble screen', () => {
    const t = buildTree([{ id: 'g', label: 'Shop' }, { id: 'a', parent: 'g', label: 'A' }, { id: 'b', parent: 'a', label: 'B' }], []);
    expect(soleRootId(t)).toBe('g');
    expect(effectiveLevel(t, null)).toBe('g');
    expect(levelChildren(t, effectiveLevel(t, null))).toEqual(['a']);
    expect(breadcrumbs(t, 'a').map((c) => [c.id, c.label])).toEqual([[null, 'Shop'], ['a', 'A']]);
    expect(parentLevel(t, 'a')).toBe(null);
    expect(levelOf(t, 'a')).toBe(null);
  });

  it('uses edges to parentless nodes as children and survives parent cycles', () => {
    const t = buildTree(
      [{ id: 'a' }, { id: 'b', parent: 'a' }, { id: 'c' }, { id: 'x', parent: 'y' }, { id: 'y', parent: 'x' }],
      [{ from: 'b', to: 'c', relation: 'has' }],
    );
    expect(t.children.get('b')).toEqual(['c']);
    expect(t.roots.some((id) => id === 'x' || id === 'y')).toBe(true);
  });

  it('collapses long paths, keeping the root and the current location', () => {
    const crumbs = breadcrumbs(tree, 'home');
    expect(collapseCrumbs(crumbs).hidden).toEqual([]);
    const deep = [...crumbs, { id: 'hero', label: 'Hero Section' }];
    const c = collapseCrumbs(deep);
    expect(ids(c.head)).toEqual([null]);
    expect(ids(c.hidden)).toEqual(['design', 'pages']);
    expect(ids(c.tail)).toEqual(['home', 'hero']);
  });
});

describe('aggregated status', () => {
  it('counts every descendant by status without the bubble itself', () => {
    expect(descendantCounts(tree, 'design')).toEqual({ total: 9, clear: 4, assumed: 3, needs: 2 });
    expect(descendantCounts(tree, 'footer').total).toBe(0);
    expect(countsText({ clear: 2, assumed: 4, needs: 3 })).toBe('2 clear · 4 assumed · 3 need info');
    expect(countsText({ clear: 0, assumed: 0, needs: 1 })).toBe('1 needs info');
  });

  it('marks the visible ancestor of a hidden highlighted/changed bubble', () => {
    const marks = visibleMarks(tree, ['design', 'func'], ['hero', 'func', 'cost']);
    expect([...marks].sort()).toEqual(['design', 'func']);
  });
});

describe('level layout', () => {
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);

  it('makes a branch 1.5x a leaf, never shrinks with depth, keeps a readable minimum', () => {
    expect(bubbleRadius({}, true)).toBe(bubbleRadius({}) * BRANCH_SCALE);
    expect(bubbleRadius({ importance: 1 })).toBeGreaterThanOrEqual(MIN_RADIUS);
    expect(bubbleRadius({ importance: 5 }, true)).toBeLessThanOrEqual(MAX_RADIUS);
    expect(bubbleRadius({ importance: 5 })).toBeGreaterThan(bubbleRadius({ importance: 1 }));
    // Size gaps stay modest: the biggest leaf is still smaller than the smallest branch.
    expect(bubbleRadius({ importance: 5 })).toBeLessThan(bubbleRadius({ importance: 1 }, true));
  });

  it('packs siblings without overlap, all inside the lens with room for the overline', () => {
    const items = Array.from({ length: 9 }, (_, i) => ({ id: `n${i}`, r: 100 + (i % 3) * 30 }));
    const { bubbles, lens } = levelLayout(items);
    expect(bubbles.size).toBe(9);
    const list = items.map((it) => ({ ...bubbles.get(it.id), want: it.r }));
    list.forEach((b) => {
      expect(b.r).toBe(b.want);
      expect(dist(b, lens) + b.r).toBeLessThanOrEqual(lens.r - LENS_MARGIN + 1);
    });
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        expect(dist(list[i], list[j])).toBeGreaterThanOrEqual(list[i].r + list[j].r - 1);
      }
    }
  });

  it('gives an empty level just a lens', () => {
    const { bubbles, lens } = levelLayout([]);
    expect(bubbles.size).toBe(0);
    expect(lens.r).toBeGreaterThan(0);
  });
});
