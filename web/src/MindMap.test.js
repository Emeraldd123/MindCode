import { describe, it, expect } from 'vitest';
import {
  bubbleClass,
  bubbleWidth,
  inferredFill,
  edgeStyle,
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

  describe('bubbleWidth', () => {
    it('scales linearly from 160px (importance 1) to 240px (importance 5)', () => {
      expect(bubbleWidth(1)).toBe(160);
      expect(bubbleWidth(2)).toBe(180);
      expect(bubbleWidth(3)).toBe(200);
      expect(bubbleWidth(4)).toBe(220);
      expect(bubbleWidth(5)).toBe(240);
    });

    it('defaults out-of-range or missing values to 200px (importance 3)', () => {
      expect(bubbleWidth()).toBe(200);
      expect(bubbleWidth(null)).toBe(200);
      expect(bubbleWidth(0)).toBe(200);
      expect(bubbleWidth(6)).toBe(200);
      expect(bubbleWidth('large')).toBe(200);
    });
  });

  describe('inferredFill', () => {
    it('scales fill opacity with inventiveness', () => {
      const pale = inferredFill(0);
      const deep = inferredFill(1);
      const mid = inferredFill(0.5);

      expect(pale).toBe('rgba(245, 158, 11, 0.08)');
      expect(deep).toBe('rgba(245, 158, 11, 0.42)');
      expect(mid).toBe('rgba(245, 158, 11, 0.25)');
    });

    it('clamps values below 0 or above 1', () => {
      expect(inferredFill(-0.5)).toBe('rgba(245, 158, 11, 0.08)');
      expect(inferredFill(1.5)).toBe('rgba(245, 158, 11, 0.42)');
      expect(inferredFill(undefined)).toBe('rgba(245, 158, 11, 0.08)');
    });
  });

  describe('edgeStyle', () => {
    it('returns slate solid for has relation', () => {
      const style = edgeStyle('has');
      expect(style.stroke).toBe('#64748b');
      expect(style.strokeDasharray).toBeUndefined();
      expect(style.animated).toBe(false);
    });

    it('returns amber animated for needs relation', () => {
      const style = edgeStyle('needs');
      expect(style.stroke).toBe('#f59e0b');
      expect(style.strokeDasharray).toBeUndefined();
      expect(style.animated).toBe(true);
    });

    it('returns blue dashed for informs relation', () => {
      const style = edgeStyle('informs');
      expect(style.stroke).toBe('#3b82f6');
      expect(style.strokeDasharray).toBe('5,5');
      expect(style.animated).toBe(false);
    });

    it('defaults to slate for unknown relations', () => {
      const style = edgeStyle('other');
      expect(style.stroke).toBe('#64748b');
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
