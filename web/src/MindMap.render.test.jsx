import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect, vi } from 'vitest';

const { captured } = vi.hoisted(() => ({ captured: { nodes: [] } }));
vi.mock('@xyflow/react', () => ({
  ReactFlow: ({ nodes }) => { captured.nodes = nodes; return null; },
  Background: () => null,
  Controls: () => null,
  MiniMap: () => null,
  NodeToolbar: () => null,
  Position: { Top: 'top' },
  useReactFlow: vi.fn(),
  useStore: vi.fn(),
}));
import MindMap from './MindMap';

describe('preview hover rendering', () => {
  it('keeps explicit node dimensions when highlights change before remeasurement', () => {
    const map = { nodes: [{ id: 'a', label: 'App', kind: 'goal' }, { id: 'b', label: 'Button', kind: 'feature' }], edges: [] };
    for (const highlighted of [[], ['a'], [], ['a']]) {
      renderToStaticMarkup(<MindMap map={map} highlighted={highlighted} />);
      expect(captured.nodes.length).toBeGreaterThan(0);
      for (const node of captured.nodes) {
        expect(node.width).toBeGreaterThan(0);
        expect(node.height).toBe(node.width);
        expect(node.width).toBe(node.data.size);
      }
    }
  });
});
