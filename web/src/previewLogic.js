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
