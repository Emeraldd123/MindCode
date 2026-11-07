import { describe, expect, it } from 'vitest';
import { analyzeTraceability, SEMANTIC_TAGS } from './traceLogic';

describe('traceLogic - analyzeTraceability', () => {
  const sampleMap = {
    nodes: [
      { id: 'n1', label: 'Nickname login', status: 'approved' },
      { id: 'n2', label: 'Real-time messaging', status: 'approved' },
      { id: 'n3', label: 'File attachments', status: 'proposed' },
    ],
  };

  it('handles empty, null, or non-string html safely', () => {
    expect(analyzeTraceability('', sampleMap)).toEqual({
      tracedCount: 0,
      totalCount: 0,
      coveragePct: 0,
      nodeBreakdown: {},
    });

    expect(analyzeTraceability(null, sampleMap)).toEqual({
      tracedCount: 0,
      totalCount: 0,
      coveragePct: 0,
      nodeBreakdown: {},
    });

    expect(analyzeTraceability(undefined, sampleMap)).toEqual({
      tracedCount: 0,
      totalCount: 0,
      coveragePct: 0,
      nodeBreakdown: {},
    });
  });

  it('counts semantic elements and elements without data-mc', () => {
    const html = `
      <div class="container">
        <h1>Title</h1>
        <p>A description</p>
        <button>Click</button>
      </div>
    `;
    const res = analyzeTraceability(html, sampleMap);
    // div, h1, p, button = 4 elements
    expect(res.totalCount).toBe(4);
    expect(res.tracedCount).toBe(0);
    expect(res.coveragePct).toBe(0);
    expect(res.nodeBreakdown).toEqual({});
  });

  it('calculates traced count, coverage percentage, and node breakdown accurately', () => {
    const html = `
      <section class="chat-app">
        <h1 data-mc="n1" data-mc-el="e1">Study Group Chat</h1>
        <div data-mc="n1" data-mc-el="e2" class="login-box">
          <input data-mc="n1" data-mc-el="e3" placeholder="Nickname" />
          <button data-mc="n2" data-mc-el="e4">Join</button>
        </div>
        <p>Untraced footnote</p>
      </section>
    `;
    const res = analyzeTraceability(html, sampleMap);
    // Elements: section, h1, div, input, button, p = 6 total
    // Traced: h1 (n1), div (n1), input (n1), button (n2) = 4 traced
    expect(res.totalCount).toBe(6);
    expect(res.tracedCount).toBe(4);
    expect(res.coveragePct).toBe(Math.round((4 / 6) * 100)); // 67%
    expect(res.nodeBreakdown).toEqual({
      n1: 3,
      n2: 1,
    });
  });

  it('supports elements with multiple node ids in data-mc', () => {
    const html = `
      <form data-mc="n1 n2" data-mc-el="e1">
        <button data-mc="n2" data-mc-el="e2">Submit</button>
      </form>
    `;
    const res = analyzeTraceability(html, sampleMap);
    expect(res.totalCount).toBe(2);
    expect(res.tracedCount).toBe(2);
    expect(res.coveragePct).toBe(100);
    expect(res.nodeBreakdown).toEqual({
      n1: 1,
      n2: 2,
    });
  });

  it('counts elements with data-mc-el even if not in standard semantic tag list', () => {
    const html = `
      <custom-widget data-mc="n1" data-mc-el="cw1">Custom</custom-widget>
      <span data-mc-el="s1">Badge</span>
      <span>Regular span</span>
    `;
    const res = analyzeTraceability(html, sampleMap);
    // custom-widget has data-mc & data-mc-el -> counts in total, and traced
    // span data-mc-el="s1" -> counts in total
    // regular span -> not in semantic list, no data-mc -> not counted
    expect(res.totalCount).toBe(2);
    expect(res.tracedCount).toBe(1);
    expect(res.coveragePct).toBe(50);
  });

  it('handles malformed HTML gracefully', () => {
    const html = `
      <div data-mc="n1">Unclosed div
      <p data-mc="n2" >Text without end tag
      <button>OK</button>
      <div><span>Unclosed inner</span>
    `;
    const res = analyzeTraceability(html, sampleMap);
    expect(res.totalCount).toBeGreaterThanOrEqual(3);
    expect(res.tracedCount).toBe(2);
    expect(res.nodeBreakdown.n1).toBe(1);
    expect(res.nodeBreakdown.n2).toBe(1);
  });

  it('handles empty map or map without nodes', () => {
    const html = `<div data-mc="n1">Content</div>`;
    const res = analyzeTraceability(html, null);
    expect(res.totalCount).toBe(1);
    expect(res.tracedCount).toBe(1);
    expect(res.coveragePct).toBe(100);
    expect(res.nodeBreakdown).toEqual({ n1: 1 });
  });

  it('includes all specified semantic tags in SEMANTIC_TAGS', () => {
    const expected = ['div', 'p', 'h1', 'h2', 'h3', 'button', 'input', 'form', 'section', 'article', 'nav', 'ul', 'li'];
    for (const tag of expected) {
      expect(SEMANTIC_TAGS.has(tag)).toBe(true);
    }
  });
});
