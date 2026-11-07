import { describe, it, expect } from 'vitest';
import { clampFontSize, elementLabel, FONT_OPTIONS, isLeaf, matchFont } from './designLogic';

describe('designLogic', () => {
  const map = {
    nodes: [
      { id: 'n1', parent: null },
      { id: 'n2', parent: 'n1' },
      { id: 'n3', parent: 'n1' },
      { id: 'n4', parent: null },
    ],
    edges: [
      { from: 'n1', to: 'n2', relation: 'has' },
      { from: 'n3', to: 'n4', relation: 'has' },
      { from: 'n2', to: 'n3', relation: 'informs' },
    ],
  };

  it('isLeaf: no children by parent or "has" edge; other relations do not count', () => {
    expect(isLeaf(map.nodes[0], map)).toBe(false);
    expect(isLeaf(map.nodes[1], map)).toBe(true);
    expect(isLeaf(map.nodes[2], map)).toBe(false);
    expect(isLeaf(map.nodes[3], map)).toBe(true);
    expect(isLeaf(null, map)).toBe(false);
  });

  it('elementLabel names the element and quotes short text', () => {
    expect(elementLabel({ tag: 'button', text: 'Send' })).toBe('Button · "Send"');
    expect(elementLabel({ tag: 'section', text: '' })).toBe('Section');
    expect(elementLabel({ tag: 'blink', text: '' })).toBe('BLINK');
    expect(elementLabel({ tag: 'h1', text: 'x'.repeat(40) })).toBe(`Heading · "${'x'.repeat(27)}…"`);
  });

  it('matchFont finds the option by its first family, ignoring quotes and case', () => {
    expect(matchFont('Georgia, serif')).toBe(FONT_OPTIONS[2].value);
    expect(matchFont('"hiragino sans", sans-serif')).toBe(FONT_OPTIONS[5].value);
    expect(matchFont('Comic Sans MS')).toBe('');
    expect(matchFont('')).toBe('');
  });

  it('clampFontSize rounds and clamps', () => {
    expect(clampFontSize('17.6')).toBe(18);
    expect(clampFontSize(2)).toBe(8);
    expect(clampFontSize(500)).toBe(96);
    expect(clampFontSize('abc')).toBe(null);
  });
});
