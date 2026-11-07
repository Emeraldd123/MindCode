import { describe, it, expect } from 'vitest';
import {
  bubbleClass,
  buildTree,
  inferredFill,
  mapStatus,
  getKindIcon,
  KIND_ICONS,
} from './MindMap';

describe('MindMap logic and pure helpers', () => {
  describe('bubbleClass', () => {
    it('applies correct classes for user, inferred (low/high/leap), and unknown sources', () => {
      const userNode = { id: 'n1', source: 'user', status: 'proposed' };
      const inferredLow = { id: 'n2', source: 'inferred', inventiveness: 0.2, status: 'proposed' };
      const inferredHigh = { id: 'n3', source: 'inferred', inventiveness: 0.55, status: 'proposed' };
      const inferredLeap = { id: 'n4', source: 'inferred', inventiveness: 0.85, status: 'proposed' };
      const unknownNode = { id: 'n5', source: 'unknown', status: 'proposed' };

      expect(bubbleClass(userNode)).toContain('source-user');
      expect(bubbleClass(userNode)).not.toContain('has-creative-leap');

      expect(bubbleClass(inferredLow)).toContain('source-inferred');
      expect(bubbleClass(inferredLow)).toContain('source-inferred-low');
      expect(bubbleClass(inferredLow)).not.toContain('has-creative-leap');

      expect(bubbleClass(inferredHigh)).toContain('source-inferred');
      expect(bubbleClass(inferredHigh)).toContain('source-inferred-high');
      expect(bubbleClass(inferredHigh)).not.toContain('has-creative-leap');

      expect(bubbleClass(inferredLeap)).toContain('source-inferred');
      expect(bubbleClass(inferredLeap)).toContain('source-inferred-high');
      expect(bubbleClass(inferredLeap)).toContain('has-creative-leap');

      expect(bubbleClass(unknownNode)).toContain('source-unknown');
    });

    it('handles status classes: approved and locked', () => {
      const approvedNode = { id: 'n1', source: 'user', status: 'approved' };
      const lockedNode = { id: 'n2', source: 'user', status: 'locked' };

      expect(bubbleClass(approvedNode)).toContain('status-approved');
      expect(bubbleClass(lockedNode)).toContain('status-locked');
    });

    it('handles interactive state options: isSelected, isHighlighted, isChanged', () => {
      const node = { id: 'n1', source: 'user' };

      expect(bubbleClass(node, { isSelected: true })).toContain('node-selected');
      expect(bubbleClass(node, { isHighlighted: true })).toContain('node-highlighted');
      expect(bubbleClass(node, { isChanged: true })).toContain('node-changed');
    });

    it('defaults importance to 3 when missing or invalid', () => {
      expect(bubbleClass({ source: 'user' })).toContain('importance-3');
      expect(bubbleClass({ source: 'user', importance: 5 })).toContain('importance-5');
      expect(bubbleClass({ source: 'user', importance: 1 })).toContain('importance-1');
      expect(bubbleClass({ source: 'user', importance: 99 })).toContain('importance-3');
    });
  });

  describe('buildTree', () => {
    it('uses parent links, edges to parentless nodes, and cuts cycles', () => {
      const t = buildTree(
        [{ id: 'a' }, { id: 'b', parent: 'a' }, { id: 'c' }, { id: 'x', parent: 'y' }, { id: 'y', parent: 'x' }],
        [{ from: 'b', to: 'c', relation: 'has' }],
      );
      expect(t.children.get('a')).toEqual(['b']);
      expect(t.children.get('b')).toEqual(['c']);
      expect(t.roots).toContain('a');
      expect(t.roots.some((id) => id === 'x' || id === 'y')).toBe(true); // the cycle still shows up
    });
  });

  describe('mapStatus', () => {
    it('maps source/status onto the Figma Clear / Assumed / Needs info vocabulary', () => {
      expect(mapStatus({ source: 'user' })).toBe('clear');
      expect(mapStatus({})).toBe('clear');
      expect(mapStatus({ source: 'inferred' })).toBe('assumed');
      expect(mapStatus({ source: 'unknown' })).toBe('needs');
      expect(mapStatus({ source: 'inferred', status: 'approved' })).toBe('clear');
      expect(mapStatus({ source: 'unknown', status: 'locked' })).toBe('clear');
    });

    it('is exposed as a bubble class', () => {
      expect(bubbleClass({ source: 'inferred' })).toContain('map-status-assumed');
      expect(bubbleClass({ source: 'unknown' })).toContain('map-status-needs');
    });
  });

  describe('inferredFill', () => {
    it('scales fill opacity with inventiveness', () => {
      const pale = inferredFill(0);
      const deep = inferredFill(1);
      const mid = inferredFill(0.5);

      expect(pale).toBe('rgba(198, 97, 63, 0)');
      expect(deep).toBe('rgba(198, 97, 63, 0.16)');
      expect(mid).toBe('rgba(198, 97, 63, 0.08)');
    });

    it('clamps values below 0 or above 1', () => {
      expect(inferredFill(-0.5)).toBe('rgba(198, 97, 63, 0)');
      expect(inferredFill(1.5)).toBe('rgba(198, 97, 63, 0.16)');
      expect(inferredFill(undefined)).toBe('rgba(198, 97, 63, 0)');
    });
  });

  describe('kind icons', () => {
    it('provides correct kind icon for all spec kinds', () => {
      expect(getKindIcon('goal')).toBe('🎯');
      expect(getKindIcon('feature')).toBe('✨');
      expect(getKindIcon('page')).toBe('📄');
      expect(getKindIcon('component')).toBe('🧩');
      expect(getKindIcon('data')).toBe('🗄️');
      expect(getKindIcon('api')).toBe('🔌');
      expect(getKindIcon('style')).toBe('🎨');
      expect(getKindIcon('constraint')).toBe('⚖️');
      expect(getKindIcon('unknown_kind')).toBe('✨');
    });
  });
});

import { needsRefit } from './MindMap';

describe('needsRefit (camera recovery)', () => {
  it('refits when the pane first gets a real size', () => {
    expect(needsRefit({ w: 0, h: 0 }, { w: 800, h: 600 })).toBe(true);
    expect(needsRefit({ w: undefined, h: 600 }, { w: 800, h: 600 })).toBe(true);
  });
  it('ignores a 0 size and small changes, refits on big ones', () => {
    expect(needsRefit({ w: 800, h: 600 }, { w: 0, h: 0 })).toBe(false);
    expect(needsRefit({ w: 800, h: 600 }, { w: 820, h: 590 })).toBe(false);
    expect(needsRefit({ w: 800, h: 600 }, { w: 400, h: 600 })).toBe(true);
    expect(needsRefit({ w: 800, h: 600 }, { w: 1200, h: 600 })).toBe(true);
  });
});
