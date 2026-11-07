// web/src/api.js
// Client wrapper for MindCode API contract (docs/api-contract.md)

export function resolveApiBase() {
  const raw = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_URL) || '';
  if (!raw) return '/api';
  return raw.endsWith('/api') ? raw : `${raw.replace(/\/$/, '')}/api`;
}

export const API_BASE = resolveApiBase();

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = `HTTP ${response.status} ${response.statusText}`;
    try {
      const errJson = await response.json();
      if (errJson && errJson.detail) {
        errorDetail = errJson.detail;
      }
    } catch {
      // Non-JSON error body
    }
    const err = new Error(errorDetail);
    err.status = response.status;
    throw err;
  }

  return response.json();
}

export async function getHealth() {
  return request('/health');
}

export async function createSession() {
  return request('/sessions', {
    method: 'POST',
  });
}

export async function getSession(sessionId) {
  return request(`/sessions/${encodeURIComponent(sessionId)}`);
}

export async function sendMessage(sessionId, text) {
  return request(`/sessions/${encodeURIComponent(sessionId)}/messages`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function chatNode(sessionId, nodeId, text) {
  return request(`/sessions/${encodeURIComponent(sessionId)}/nodes/${encodeURIComponent(nodeId)}/chat`, {
    method: 'POST',
    body: JSON.stringify({ text }),
  });
}

export async function approveNode(sessionId, nodeId) {
  return request(`/sessions/${encodeURIComponent(sessionId)}/nodes/${encodeURIComponent(nodeId)}/approve`, {
    method: 'POST',
  });
}

export async function patchNode(sessionId, nodeId, updates) {
  return request(`/sessions/${encodeURIComponent(sessionId)}/nodes/${encodeURIComponent(nodeId)}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
}

export async function build(sessionId) {
  return request(`/sessions/${encodeURIComponent(sessionId)}/build`, {
    method: 'POST',
  });
}

export async function getBuild(sessionId, buildId) {
  return request(`/sessions/${encodeURIComponent(sessionId)}/builds/${encodeURIComponent(buildId)}`);
}

export function getBuildPreviewUrl(sessionId, buildId) {
  return `${API_BASE}/sessions/${encodeURIComponent(sessionId)}/builds/${encodeURIComponent(buildId)}/preview`;
}

export async function getCheckpoints(sessionId) {
  return request(`/sessions/${encodeURIComponent(sessionId)}/checkpoints`);
}
