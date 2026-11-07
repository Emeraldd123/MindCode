import { describe, expect, it } from 'vitest';
import { graphRecommendations } from './graphRecommendations';

const ids = (map) => graphRecommendations(map).map((item) => item.id);

describe('graph design recommendations', () => {
  it('does not show recommendations before a graph exists', () => {
    expect(graphRecommendations(null)).toEqual([]);
    expect(graphRecommendations({ nodes: [], edges: [] })).toEqual([]);
  });

  it('adapts advice when the displayed graph changes', () => {
    const nodes = Array.from({ length: 16 }, (_, i) => ({ id: String(i), label: 'Idea', source: 'user' }));
    expect(ids({ nodes })).toContain('density');
    expect(ids({ nodes })).not.toContain('spacing');
    expect(ids({ nodes: nodes.slice(0, 2) })).toEqual(['spacing']);
  });

  it('identifies long labels, mixed sources, and unapproved open decisions', () => {
    const map = { nodes: [
      { id: 'a', label: 'A'.repeat(33), source: 'user' },
      { id: 'b', label: 'Decision', source: 'unknown', status: 'proposed' },
    ] };
    expect(ids(map)).toEqual(['spacing', 'labels', 'color', 'attention']);
    map.nodes[1].status = 'approved';
    expect(ids(map)).not.toContain('attention');
  });

  it('counts only valid cross-links, excluding parent links', () => {
    const nodes = Array.from({ length: 5 }, (_, i) => ({ id: String(i), parent: i ? '0' : null }));
    const edges = nodes.slice(1).map((node) => ({ from: '0', to: node.id }));
    expect(ids({ nodes, edges })).not.toContain('connections');
    const cross = nodes.slice(1).map((node) => ({ from: node.id, to: '0', relation: 'informs' }));
    expect(ids({ nodes, edges: [...edges, ...cross] })).toContain('connections');
    expect(ids({ nodes, edges: cross.map((edge) => ({ ...edge, to: 'missing' })) })).not.toContain('connections');
  });
});
