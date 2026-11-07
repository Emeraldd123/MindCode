import { describe, it, expect } from 'vitest';
import {
  childrenOf, hasChildren, pathTo, drillCounts, summaryText, decisionLayout, normalizeDecision, LENS,
} from './drillLogic';

const map = {
  nodes: [
    { id: 'g', label: 'App', parent: null, source: 'user' },
    { id: 'd', label: 'Design', parent: 'g', source: 'user' },
    { id: 'b', label: 'Branding', parent: 'd', source: 'inferred' },
    { id: 'l', label: 'Logo', parent: 'b', source: 'unknown' },
    { id: 't', label: 'Tone', parent: 'b', source: 'inferred' },
    { id: 'f', label: 'Typeface', parent: 'b', source: 'inferred', status: 'approved' },
    { id: 'x', label: 'Loose', parent: null, source: 'unknown' },
  ],
  edges: [{ from: 'b', to: 'x', relation: 'has' }],
};

describe('drillLogic', () => {
  it('finds children by parent and by edges to parentless nodes', () => {
    expect(childrenOf(map, 'b').map((n) => n.id)).toEqual(['l', 't', 'f', 'x']);
    expect(hasChildren(map, 'l')).toBe(false);
  });

  it('builds the breadcrumb path root → node, cycle-safe', () => {
    expect(pathTo(map, 'b').map((n) => n.id)).toEqual(['g', 'd', 'b']);
    const loop = { nodes: [{ id: 'a', parent: 'b' }, { id: 'b', parent: 'a' }] };
    expect(pathTo(loop, 'a').map((n) => n.id)).toEqual(['b', 'a']);
  });

  it('counts statuses and writes the Figma summary line', () => {
    const counts = drillCounts(childrenOf(map, 'b'));
    expect(counts).toEqual({ total: 4, clear: 1, assumed: 1, needs: 2 });
    expect(summaryText({ total: 4, clear: 0, assumed: 2, needs: 2 }))
      .toBe('4 decisions inside · 2 Claude guesses to confirm · 2 need your answer');
    expect(summaryText({ total: 1, clear: 0, assumed: 1, needs: 1 }))
      .toBe('1 decision inside · 1 Claude guess to confirm · 1 needs your answer');
  });

  it('lays out 4 decisions as the Figma 2x2 grid of 340px bubbles', () => {
    const pos = decisionLayout(4);
    expect(pos.map((p) => p.d)).toEqual([340, 340, 340, 340]);
    expect(pos[0]).toEqual({ x: 296, y: 296, d: 340 });
    expect(pos[3]).toEqual({ x: 664, y: 664, d: 340 });
  });

  it('keeps every decision bubble inside the lens circle', () => {
    for (let n = 1; n <= 12; n++) {
      decisionLayout(n).forEach(({ x, y, d }) => {
        expect(Math.hypot(x - LENS / 2, y - LENS / 2) + d / 2).toBeLessThanOrEqual(LENS / 2);
      });
    }
    expect(decisionLayout(0)).toEqual([]);
  });

  it('normalizes the optional decision payload', () => {
    expect(normalizeDecision(undefined)).toBeNull();
    expect(normalizeDecision({ type: 'choice', options: [] })).toBeNull();
    expect(normalizeDecision({ type: 'choice', options: [{ label: 'A' }], pick: 5 }).pick).toBeNull();
    expect(normalizeDecision({ type: 'scale', scales: [{ left: 'a', right: 'b', value: 9 }] }).scales[0].value).toBe(2);
    expect(normalizeDecision({ type: 'drafts', drafts: ['x', '', 3] }).drafts).toEqual(['x']);
  });
});
