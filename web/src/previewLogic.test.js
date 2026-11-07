import { describe, expect, it } from 'vitest';
import {
  buildStage,
  emptyStep,
  formatElapsed,
  isHoverMessage,
  latestDoneBuild,
  nodeLabels,
  pendingBuild,
  pollBuild,
  titleFromHtml,
  traceCount,
  upsertBuild,
} from './previewLogic';

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

  describe('formatElapsed', () => {
    it('formats milliseconds into m:ss', () => {
      expect(formatElapsed(0)).toBe('0:00');
      expect(formatElapsed(5000)).toBe('0:05');
      expect(formatElapsed(59000)).toBe('0:59');
      expect(formatElapsed(60000)).toBe('1:00');
      expect(formatElapsed(78000)).toBe('1:18');
      expect(formatElapsed(125000)).toBe('2:05');
      expect(formatElapsed(-1000)).toBe('0:00');
      expect(formatElapsed()).toBe('0:00');
    });
  });

  describe('buildStage', () => {
    it('advances stage every 15 seconds and holds on the last stage', () => {
      expect(buildStage(0)).toBe(0);
      expect(buildStage(14999)).toBe(0);
      expect(buildStage(15000)).toBe(1);
      expect(buildStage(29999)).toBe(1);
      expect(buildStage(30000)).toBe(2);
      expect(buildStage(45000)).toBe(3);
      expect(buildStage(60000)).toBe(4);
      expect(buildStage(85000)).toBe(4);
      expect(buildStage(120000)).toBe(4);
      expect(buildStage(-500)).toBe(0);
    });
  });

  describe('traceCount', () => {
    it('counts unique element IDs across all nodes in build.trace', () => {
      expect(traceCount(null)).toBe(0);
      expect(traceCount({})).toBe(0);
      expect(traceCount({ trace: {} })).toBe(0);

      const build = {
        trace: {
          n1: ['el-1', 'el-2'],
          n2: ['el-2', 'el-3'],
          n3: ['el-4'],
        },
      };
      // el-1, el-2, el-3, el-4 -> 4 unique elements
      expect(traceCount(build)).toBe(4);
    });
  });

  describe('titleFromHtml', () => {
    it('extracts and trims <title> from HTML', () => {
      expect(titleFromHtml('<!DOCTYPE html><html><head><title> Study Group Chat </title></head></html>')).toBe('Study Group Chat');
      expect(titleFromHtml('<TITLE>My App</TITLE>')).toBe('My App');
      expect(titleFromHtml('<div>No title here</div>')).toBe('');
      expect(titleFromHtml('')).toBe('');
      expect(titleFromHtml(null)).toBe('');
    });
  });

  describe('emptyStep', () => {
    it('returns step 1 when no map or nodes are empty', () => {
      expect(emptyStep(null)).toBe(1);
      expect(emptyStep({})).toBe(1);
      expect(emptyStep({ nodes: [] })).toBe(1);
    });

    it('returns step 2 when map has nodes but none are approved or locked', () => {
      const map = {
        nodes: [
          { id: 'n1', status: 'proposed' },
          { id: 'n2', status: 'proposed' },
        ],
      };
      expect(emptyStep(map)).toBe(2);
    });

    it('returns step 3 when map has approved or locked nodes', () => {
      const mapApproved = {
        nodes: [
          { id: 'n1', status: 'proposed' },
          { id: 'n2', status: 'approved' },
        ],
      };
      expect(emptyStep(mapApproved)).toBe(3);

      const mapLocked = {
        nodes: [
          { id: 'n1', status: 'locked' },
        ],
      };
      expect(emptyStep(mapLocked)).toBe(3);
    });
  });
});
