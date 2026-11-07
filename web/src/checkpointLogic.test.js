// web/src/checkpointLogic.test.js
import { describe, it, expect } from 'vitest';
import { checkpointKind, diffMaps, formatDiff, neighbor } from './checkpointLogic';

describe('checkpointKind', () => {
  it('returns "build" when build_id is present', () => {
    expect(checkpointKind({ id: 'c1', build_id: 'b1' })).toBe('build');
    expect(checkpointKind({ id: 'c2', build_id: 'b2', turn: 1 })).toBe('build');
  });

  it('returns "turn" when build_id is absent or empty', () => {
    expect(checkpointKind({ id: 'c1' })).toBe('turn');
    expect(checkpointKind({ id: 'c2', build_id: undefined })).toBe('turn');
    expect(checkpointKind({ id: 'c3', build_id: '' })).toBe('turn');
    expect(checkpointKind(null)).toBe('turn');
    expect(checkpointKind({})).toBe('turn');
  });
});

describe('diffMaps', () => {
  it('handles edge case: first checkpoint with no prevMap (null or undefined)', () => {
    const map = {
      nodes: [
        { id: 'n1', label: 'Idea 1', status: 'proposed' },
        { id: 'n2', label: 'Idea 2', status: 'approved' },
      ],
      edges: [],
    };

    expect(diffMaps(null, map)).toEqual({
      added: 2,
      removed: 0,
      approved: 1,
      changed: 0,
    });

    expect(diffMaps(undefined, map)).toEqual({
      added: 2,
      removed: 0,
      approved: 1,
      changed: 0,
    });
  });

  it('handles edge case: empty maps', () => {
    expect(diffMaps(null, null)).toEqual({
      added: 0,
      removed: 0,
      approved: 0,
      changed: 0,
    });

    expect(diffMaps({ nodes: [] }, { nodes: [] })).toEqual({
      added: 0,
      removed: 0,
      approved: 0,
      changed: 0,
    });
  });

  it('detects added and removed nodes', () => {
    const prevMap = {
      nodes: [
        { id: 'n1', label: 'A', status: 'proposed' },
        { id: 'n2', label: 'B', status: 'proposed' },
      ],
    };
    const currMap = {
      nodes: [
        { id: 'n2', label: 'B', status: 'proposed' },
        { id: 'n3', label: 'C', status: 'proposed' },
        { id: 'n4', label: 'D', status: 'proposed' },
      ],
    };

    const diff = diffMaps(prevMap, currMap);
    expect(diff).toEqual({
      added: 2, // n3, n4
      removed: 1, // n1
      approved: 0,
      changed: 0,
    });
  });

  it('detects newly approved nodes', () => {
    const prevMap = {
      nodes: [
        { id: 'n1', label: 'A', status: 'proposed' },
        { id: 'n2', label: 'B', status: 'approved' },
      ],
    };
    const currMap = {
      nodes: [
        { id: 'n1', label: 'A', status: 'approved' }, // newly approved
        { id: 'n2', label: 'B', status: 'approved' }, // previously approved
        { id: 'n3', label: 'C', status: 'approved' }, // newly added and approved
      ],
    };

    const diff = diffMaps(prevMap, currMap);
    expect(diff).toEqual({
      added: 1,
      removed: 0,
      approved: 2, // n1 newly approved, n3 added as approved
      changed: 1, // n1 changed status
    });
  });

  it('detects content changes in nodes', () => {
    const prevMap = {
      nodes: [
        { id: 'n1', label: 'Old Title', detail: 'Desc 1', status: 'proposed' },
      ],
    };
    const currMap = {
      nodes: [
        { id: 'n1', label: 'New Title', detail: 'Desc 1', status: 'proposed' },
      ],
    };

    const diff = diffMaps(prevMap, currMap);
    expect(diff).toEqual({
      added: 0,
      removed: 0,
      approved: 0,
      changed: 1,
    });
  });
});

describe('formatDiff', () => {
  it('formats added and approved bubbles', () => {
    expect(formatDiff({ added: 3, removed: 0, approved: 2, changed: 0 })).toBe(
      '+3 bubbles, 2 approved'
    );
    expect(formatDiff({ added: 1, removed: 0, approved: 1, changed: 0 })).toBe(
      '+1 bubble, 1 approved'
    );
  });

  it('formats removals and modifications', () => {
    expect(formatDiff({ added: 0, removed: 2, approved: 0, changed: 0 })).toBe(
      '-2 removed'
    );
    expect(formatDiff({ added: 0, removed: 0, approved: 0, changed: 3 })).toBe(
      '3 modified'
    );
  });

  it('formats no changes', () => {
    expect(formatDiff({ added: 0, removed: 0, approved: 0, changed: 0 })).toBe(
      'no changes'
    );
    expect(formatDiff(null)).toBe('no changes');
  });
});

describe('neighbor', () => {
  const checkpoints = [
    { id: 'c1', label: 'Turn 1' },
    { id: 'c2', label: 'Build b1' },
    { id: 'c3', label: 'Turn 3' },
  ];

  it('handles empty checkpoints list', () => {
    expect(neighbor([], null, 1)).toBeNull();
    expect(neighbor([], null, -1)).toBeNull();
    expect(neighbor(null, null, 1)).toBeNull();
  });

  it('navigates backwards from live (activeId = null)', () => {
    // live index is 3 (after c3). -1 should give c3
    expect(neighbor(checkpoints, null, -1)).toEqual(checkpoints[2]);
  });

  it('clamps when moving forward from live (activeId = null)', () => {
    expect(neighbor(checkpoints, null, 1)).toBeNull();
  });

  it('navigates between checkpoints', () => {
    // at c1 (index 0), backwards clamps at c1
    expect(neighbor(checkpoints, 'c1', -1)).toEqual(checkpoints[0]);
    // at c1, forward gives c2
    expect(neighbor(checkpoints, 'c1', 1)).toEqual(checkpoints[1]);
    // at c2, backwards gives c1
    expect(neighbor(checkpoints, 'c2', -1)).toEqual(checkpoints[0]);
    // at c2, forward gives c3
    expect(neighbor(checkpoints, 'c2', 1)).toEqual(checkpoints[2]);
  });

  it('navigates forward to live from last checkpoint', () => {
    expect(neighbor(checkpoints, 'c3', 1)).toBeNull();
  });

  it('handles unknown activeId by defaulting to live behavior', () => {
    expect(neighbor(checkpoints, 'unknown_id', -1)).toEqual(checkpoints[2]);
    expect(neighbor(checkpoints, 'unknown_id', 1)).toBeNull();
  });
});
