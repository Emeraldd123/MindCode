// Pure helpers for the build preview (unit-tested in previewLogic.test.js).

/** Latest build that finished successfully, or null. */
export function latestDoneBuild(builds = []) {
  for (let i = builds.length - 1; i >= 0; i--) if (builds[i]?.status === 'done') return builds[i];
  return null;
}

/** The build currently generating, or null. */
export function pendingBuild(builds = []) {
  return builds.find((b) => b?.status === 'pending') ?? null;
}

/** Replace a build by id, or append it. */
export function upsertBuild(builds = [], build) {
  const i = builds.findIndex((b) => b.id === build.id);
  if (i === -1) return [...builds, build];
  const next = builds.slice();
  next[i] = build;
  return next;
}

/**
 * Poll getBuild until the build is no longer pending.
 * Calls onUpdate with each fresh build. Returns the final build.
 * `signal.cancelled = true` stops polling (returns null).
 */
export async function pollBuild(getBuild, sid, bid, { intervalMs = 2000, timeoutMs = 10 * 60 * 1000, onUpdate, signal = {}, sleep = defaultSleep } = {}) {
  const start = Date.now();
  for (;;) {
    if (signal.cancelled) return null;
    const b = await getBuild(sid, bid);
    onUpdate?.(b);
    if (b.status !== 'pending') return b;
    if (Date.now() - start > timeoutMs) return { ...b, status: 'error', error: 'Build timed out' };
    await sleep(intervalMs);
  }
}

const defaultSleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Labels of the given node ids, in map order, for the "informed by" chip. */
export function nodeLabels(map, ids = []) {
  const want = new Set(ids);
  return (map?.nodes ?? []).filter((n) => want.has(n.id)).map((n) => ({ id: n.id, label: n.label, source: n.source, status: n.status }));
}

/** Is this a hover message from our preview iframe? */
export function isHoverMessage(data) {
  return !!data && data.type === 'mc-hover' && Array.isArray(data.nodes);
}

/**
 * Format milliseconds into m:ss format (e.g. 78000 -> "1:18", 5000 -> "0:05").
 */
export function formatElapsed(ms = 0) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export const BUILD_STAGES = [
  'Reading N bubbles',
  'Planning screens',
  'Writing the data layer',
  'Wiring interactions',
  'Tracing elements to bubbles',
];

/**
 * Determines stage index (0 to 4) advancing about every 15s (15000ms),
 * holding at the last stage (index 4) until the build is done.
 */
export function buildStage(elapsedMs = 0) {
  if (elapsedMs < 0) return 0;
  const stage = Math.floor(elapsedMs / 15000);
  return Math.min(stage, BUILD_STAGES.length - 1);
}

/**
 * Total unique element ids traced across all nodes in build.trace.
 * build.trace is Record<string, string[]>.
 */
export function traceCount(build) {
  if (!build?.trace || typeof build.trace !== 'object') return 0;
  const uniqueElements = new Set();
  for (const els of Object.values(build.trace)) {
    if (Array.isArray(els)) {
      for (const el of els) {
        if (el) uniqueElements.add(el);
      }
    }
  }
  return uniqueElements.size;
}

/**
 * Extracts app title from HTML <title>...</title> tag.
 */
export function titleFromHtml(html = '') {
  if (typeof html !== 'string') return '';
  const match = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  return match ? match[1].trim() : '';
}

/**
 * Evaluates the empty state step (1, 2, or 3) from the mind map:
 * Step 1 ("Describe"): no map or empty nodes.
 * Step 2 ("Approve bubbles"): map has nodes, but none approved or locked.
 * Step 3 ("Build"): ready (has at least one approved or locked node).
 */
export function emptyStep(map) {
  const nodes = map?.nodes;
  if (!nodes || nodes.length === 0) return 1;
  const hasApproved = nodes.some((n) => n.status === 'approved' || n.status === 'locked');
  if (!hasApproved) return 2;
  return 3;
}

/**
 * Generates the download filename for a build.
 */
export function buildDownloadFilename(buildId) {
  return `mindcode-${buildId}.html`;
}
