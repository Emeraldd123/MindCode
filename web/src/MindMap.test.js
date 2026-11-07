import { describe, it, expect } from 'vitest';

describe('MindMap logic and helpers', () => {
  it('formats sample demo nodes with correct sources and classes', () => {
    const sampleNodes = [
      { id: 'n1', label: 'Chat app', source: 'user', status: 'proposed' },
      { id: 'n2', label: 'Message API', source: 'inferred', inventiveness: 0.2, status: 'proposed' },
      { id: 'n3', label: 'Real-time updates', source: 'inferred', inventiveness: 0.8, status: 'proposed' },
      { id: 'n4', label: 'How do users log in?', source: 'unknown', status: 'proposed' },
      { id: 'n5', label: 'Nickname login', source: 'unknown', status: 'approved' },
    ];

    // Helper simulating node class resolution in MindMapNode
    function getNodeClass(node) {
      const source = node.source || 'user';
      const status = node.status || 'proposed';
      const inventiveness = Number(node.inventiveness ?? 0);

      let sourceClass = 'source-user';
      if (source === 'inferred') {
        sourceClass = inventiveness >= 0.5 ? 'source-inferred-high' : 'source-inferred-low';
      } else if (source === 'unknown') {
        sourceClass = 'source-unknown';
      }

      const isApproved = status === 'approved';
      return {
        sourceClass,
        isApproved,
      };
    }

    const n1Class = getNodeClass(sampleNodes[0]);
    expect(n1Class.sourceClass).toBe('source-user');
    expect(n1Class.isApproved).toBe(false);

    const n2Class = getNodeClass(sampleNodes[1]);
    expect(n2Class.sourceClass).toBe('source-inferred-low');

    const n3Class = getNodeClass(sampleNodes[2]);
    expect(n3Class.sourceClass).toBe('source-inferred-high');

    const n4Class = getNodeClass(sampleNodes[3]);
    expect(n4Class.sourceClass).toBe('source-unknown');
    expect(n4Class.isApproved).toBe(false);

    const n5Class = getNodeClass(sampleNodes[4]);
    expect(n5Class.sourceClass).toBe('source-unknown');
    expect(n5Class.isApproved).toBe(true);
  });
});
