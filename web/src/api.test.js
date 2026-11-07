import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as api from './api';

describe('api client wrapper', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('getHealth fetches /health', async () => {
    const mockData = { ok: true };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockData,
    });

    const res = await api.getHealth();
    expect(res).toEqual(mockData);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/health$/),
      expect.objectContaining({
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      })
    );
  });

  it('createSession calls POST /sessions', async () => {
    const mockSession = { id: 's1', messages: [], map: { nodes: [], edges: [] } };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSession,
    });

    const res = await api.createSession();
    expect(res).toEqual(mockSession);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/sessions$/),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('getSession calls GET /sessions/{sid}', async () => {
    const mockSession = { id: 's123', messages: [], map: { nodes: [], edges: [] } };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockSession,
    });

    const res = await api.getSession('s123');
    expect(res).toEqual(mockSession);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/sessions\/s123$/),
      expect.anything()
    );
  });

  it('sendMessage calls POST /sessions/{sid}/messages with text body', async () => {
    const mockRes = { reply: 'Hi', map: { nodes: [], edges: [] }, changed: ['n1'] };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRes,
    });

    const res = await api.sendMessage('s1', 'Hello Claude');
    expect(res).toEqual(mockRes);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/sessions\/s1\/messages$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'Hello Claude' }),
      })
    );
  });

  it('chatNode calls POST /sessions/{sid}/nodes/{nid}/chat', async () => {
    const mockRes = { reply: 'Refined idea', node: { id: 'n1', label: 'Updated' }, history: [] };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockRes,
    });

    const res = await api.chatNode('s1', 'n1', 'Make it simpler');
    expect(res).toEqual(mockRes);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/sessions\/s1\/nodes\/n1\/chat$/),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ text: 'Make it simpler' }),
      })
    );
  });

  it('approveNode calls POST /sessions/{sid}/nodes/{nid}/approve', async () => {
    const mockNode = { id: 'n1', status: 'approved' };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockNode,
    });

    const res = await api.approveNode('s1', 'n1');
    expect(res).toEqual(mockNode);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/sessions\/s1\/nodes\/n1\/approve$/),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('patchNode calls PATCH /sessions/{sid}/nodes/{nid}', async () => {
    const updates = { label: 'New label', status: 'locked' };
    const mockNode = { id: 'n1', ...updates };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockNode,
    });

    const res = await api.patchNode('s1', 'n1', updates);
    expect(res).toEqual(mockNode);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/sessions\/s1\/nodes\/n1$/),
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
    );
  });

  it('build calls POST /sessions/{sid}/build', async () => {
    const mockBuild = { id: 'b1', html: '<div>test</div>', trace: {}, checkpoint_id: 'c1' };
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockBuild,
    });

    const res = await api.build('s1');
    expect(res).toEqual(mockBuild);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/sessions\/s1\/build$/),
      expect.objectContaining({ method: 'POST' })
    );
  });

  it('getBuildPreviewUrl returns expected preview URL', () => {
    const url = api.getBuildPreviewUrl('s1', 'b1');
    expect(url).toMatch(/\/sessions\/s1\/builds\/b1\/preview$/);
  });

  it('getCheckpoints calls GET /sessions/{sid}/checkpoints', async () => {
    const mockCps = [{ id: 'c1', label: 'initial', turn: 1 }];
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockCps,
    });

    const res = await api.getCheckpoints('s1');
    expect(res).toEqual(mockCps);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/sessions\/s1\/checkpoints$/),
      expect.anything()
    );
  });

  it('throws descriptive error on HTTP failure with json detail', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
      json: async () => ({ detail: 'Session not found' }),
    });

    await expect(api.getSession('missing-id')).rejects.toThrow('Session not found');
  });
});
