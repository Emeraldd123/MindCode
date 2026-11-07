import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';
import Attention, { filterAndSortAttentionNodes } from './Attention';

describe('Attention panel logic & component', () => {
  const mockNodes = [
    { id: 'n1', label: 'User request', source: 'user', status: 'proposed', importance: 5, inventiveness: 0 },
    { id: 'n2', label: 'Approved unknown', source: 'unknown', status: 'approved', importance: 5, inventiveness: 0 },
    { id: 'n3', label: 'Approved inferred', source: 'inferred', status: 'approved', importance: 4, inventiveness: 0.8 },
    { id: 'n4', label: 'Low importance inferred', source: 'inferred', status: 'proposed', importance: 2, inventiveness: 0.1 },
    { id: 'n5', label: 'High importance unknown', source: 'unknown', status: 'proposed', importance: 5, inventiveness: 0 },
    { id: 'n6', label: 'High inventiveness inferred', source: 'inferred', status: 'proposed', importance: 4, inventiveness: 0.9 },
    { id: 'n7', label: 'Low inventiveness inferred', source: 'inferred', status: 'proposed', importance: 4, inventiveness: 0.2 },
  ];

  it('filters out approved nodes and user-specified nodes', () => {
    const result = filterAndSortAttentionNodes(mockNodes);

    // Should only contain n4, n5, n6, n7
    const resultIds = result.map((n) => n.id);
    expect(resultIds).not.toContain('n1'); // source: 'user'
    expect(resultIds).not.toContain('n2'); // status: 'approved'
    expect(resultIds).not.toContain('n3'); // status: 'approved'

    expect(resultIds).toContain('n4');
    expect(resultIds).toContain('n5');
    expect(resultIds).toContain('n6');
    expect(resultIds).toContain('n7');
  });

  it('sorts by importance descending, then inventiveness descending', () => {
    const result = filterAndSortAttentionNodes(mockNodes);
    const resultIds = result.map((n) => n.id);

    // Expected order:
    // n5 (importance 5, inventiveness 0)
    // n6 (importance 4, inventiveness 0.9)
    // n7 (importance 4, inventiveness 0.2)
    // n4 (importance 2, inventiveness 0.1)
    expect(resultIds).toEqual(['n5', 'n6', 'n7', 'n4']);
  });

  it('handles default importance (3) and default inventiveness (0) when omitted', () => {
    const nodes = [
      { id: 'a', label: 'No imp or inv', source: 'inferred', status: 'proposed' },
      { id: 'b', label: 'Imp 3 inv 0.5', source: 'inferred', status: 'proposed', importance: 3, inventiveness: 0.5 },
      { id: 'c', label: 'Imp 4', source: 'unknown', status: 'proposed', importance: 4 },
      { id: 'd', label: 'Imp 2', source: 'unknown', status: 'proposed', importance: 2 },
    ];

    const result = filterAndSortAttentionNodes(nodes);
    const resultIds = result.map((n) => n.id);

    // 'c' has imp 4
    // 'b' has imp 3, inv 0.5
    // 'a' defaults to imp 3, inv 0
    // 'd' has imp 2
    expect(resultIds).toEqual(['c', 'b', 'a', 'd']);
  });

  it('renders correctly and renders all filtered and sorted items', () => {
    const html = ReactDOMServer.renderToString(
      React.createElement(Attention, { nodes: mockNodes, selectedId: 'n6' })
    );

    expect(html).toContain('High importance unknown');
    expect(html).toContain('High inventiveness inferred');
    expect(html).toContain('Low inventiveness inferred');
    expect(html).toContain('Low importance inferred');
    expect(html).not.toContain('User request');
    expect(html).not.toContain('Approved unknown');
    expect(html).not.toContain('Approved inferred');
  });

  it('calls onSelect callback when an attention item is clicked', () => {
    const onSelect = vi.fn();
    // Simulate component rendering to inspect element structure and handlers
    let capturedElement;
    function Wrapper() {
      capturedElement = Attention({ nodes: mockNodes, onSelect, selectedId: 'n6' });
      return capturedElement;
    }

    ReactDOMServer.renderToString(React.createElement(Wrapper));
    expect(capturedElement).toBeDefined();

    // The attention list is inside the body (second child of .attention-panel)
    const body = capturedElement.props.children[1];
    expect(body).toBeDefined();
    const list = body.props.children;
    const items = list.props.children;
    expect(items.length).toBe(4);

    // First item is n5 (importance 5)
    expect(items[0].key).toBe('n5');
    items[0].props.onClick();

    expect(onSelect).toHaveBeenCalledTimes(1);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'n5' }));
  });

  it('displays resolved message when no attention items exist', () => {
    const resolvedNodes = [
      { id: 'n1', label: 'User node', source: 'user', status: 'proposed' },
      { id: 'n2', label: 'Approved node', source: 'unknown', status: 'approved' },
    ];

    const html = ReactDOMServer.renderToString(
      React.createElement(Attention, { nodes: resolvedNodes })
    );
    expect(html).toContain('All key assumptions and unknowns resolved! ✓');
  });
});
