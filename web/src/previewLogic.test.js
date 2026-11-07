import { describe, expect, it } from 'vitest';
import { isHoverMessage, latestDoneBuild, nodeLabels, pendingBuild, pollBuild, upsertBuild } from './previewLogic';

const b = (id, status) => ({ id, status });

describe('previewLogic', () => {
  it('picks the latest finished build and the pending one', () => {
    const builds = [b('b1', 'done'), b('b2', 'error'), b('b3', 'pending')];
    expect(latestDoneBuild(builds).id).toBe('b1');
    expect(pendingBuild(builds).id).toBe('b3');
    expect(latestDoneBuild([])).toBeNull();
    expect(pendingBuild([b('b1', 'done')])).toBeNull();
  });

  it('upserts builds by id', () => {
    expect(upsertBuild([b('b1', 'pending')], b('b1', 'done'))).toEqual([b('b1', 'done')]);
    expect(upsertBuild([b('b1', 'done')], b('b2', 'pending')).map((x) => x.id)).toEqual(['b1', 'b2']);
  });

  it('polls until the build leaves pending', async () => {
    const seq = [b('b1', 'pending'), b('b1', 'pending'), { ...b('b1', 'done'), html: '<p>' }];
    const seen = [];
    const out = await pollBuild(async () => seq.shift(), 's', 'b1', { sleep: async () => {}, onUpdate: (x) => seen.push(x.status) });
    expect(out.status).toBe('done');
    expect(seen).toEqual(['pending', 'pending', 'done']);
  });

  it('stops when cancelled and times out', async () => {
    const signal = { cancelled: true };
    expect(await pollBuild(async () => b('b1', 'pending'), 's', 'b1', { signal })).toBeNull();
    const out = await pollBuild(async () => b('b1', 'pending'), 's', 'b1', { timeoutMs: -1, sleep: async () => {} });
    expect([out.status, out.error]).toEqual(['error', 'Build timed out']);
  });

  it('maps node ids to labels in map order and validates hover messages', () => {
    const map = { nodes: [{ id: 'n1', label: 'Chat app', source: 'user', status: 'proposed' }, { id: 'n2', label: 'API', source: 'inferred', status: 'approved' }] };
    expect(nodeLabels(map, ['n2', 'n1', 'zz']).map((x) => x.label)).toEqual(['Chat app', 'API']);
    expect(isHoverMessage({ type: 'mc-hover', nodes: [] })).toBe(true);
    expect(isHoverMessage({ type: 'other', nodes: [] })).toBe(false);
    expect(isHoverMessage(null)).toBe(false);
  });
});
