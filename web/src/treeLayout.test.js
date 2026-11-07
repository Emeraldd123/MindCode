import { describe, expect, it } from 'vitest';
import { ancestorsOf, buildTree, COL_W, descendantsOf, layoutTree, ROW_H } from './treeLayout';

const N = (id, parent, facet) => ({ id, parent, facet, label: id });
const map = {
  nodes: [
    N('n1', null, 'goal'),
    N('n3', 'n1', 'functionality'),
    N('n2', 'n1', 'design'),
    N('n4', 'n2', 'design'),
    N('n5', 'n2', 'design'),
    N('n6', 'n4', 'design'),
    N('n7', 'n3', 'functionality'),
  ],
  edges: [],
};

describe('treeLayout', () => {
  it('orders children by facet (design before functionality) and by id', () => {
    const { kids, roots } = buildTree(map);
    expect(roots.map((n) => n.id)).toEqual(['n1']);
    expect(kids.get('n1').map((n) => n.id)).toEqual(['n2', 'n3']);
  });

  it('puts each node one column right of its parent and centers parents on their children', () => {
    const { pos } = layoutTree(map);
    expect(pos.get('n1').x).toBe(0);
    expect(pos.get('n2').x).toBe(COL_W);
    expect(pos.get('n6').x).toBe(3 * COL_W);
    // n4 has a single child n6 -> same row
    expect(pos.get('n4').y).toBe(pos.get('n6').y);
    // n2 is centered between its first and last children
    expect(pos.get('n2').y).toBe((pos.get('n4').y + pos.get('n5').y) / 2);
    // leaves never share a row
    const leafYs = ['n6', 'n5', 'n7'].map((id) => pos.get(id).y);
    expect(new Set(leafYs).size).toBe(3);
    expect(leafYs[1] - leafYs[0]).toBe(ROW_H);
  });

  it('collapsing hides descendants and reports how many', () => {
    const { pos, hiddenCount } = layoutTree(map, new Set(['n2']));
    expect(pos.has('n4')).toBe(false);
    expect(pos.has('n6')).toBe(false);
    expect(hiddenCount.get('n2')).toBe(3);
  });

  it('ancestors/descendants give the path to a bubble and its subtree', () => {
    expect(ancestorsOf(map, 'n6')).toEqual(['n1', 'n2', 'n4', 'n6']);
    expect(descendantsOf(map, 'n2').sort()).toEqual(['n4', 'n5', 'n6']);
  });

  it('survives cycles and missing parents', () => {
    const bad = { nodes: [N('a', 'b'), N('b', 'a'), N('c', 'zz')], edges: [] };
    const { pos } = layoutTree(bad);
    expect(pos.size).toBe(3);
    expect(ancestorsOf(bad, 'a').length).toBeLessThanOrEqual(2);
  });
});
