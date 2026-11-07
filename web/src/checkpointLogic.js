// web/src/checkpointLogic.js
// Logic for MindCode checkpoint timeline: diffing maps, checkpoint classification, and navigation.

/**
 * Classifies a checkpoint as either 'build' or 'turn'.
 * Build checkpoints have `build_id` set.
 *
 * @param {object|null} cp Checkpoint object
 * @returns {'build'|'turn'}
 */
export function checkpointKind(cp) {
  if (cp && typeof cp.build_id === 'string' && cp.build_id.trim().length > 0) {
    return 'build';
  }
  return 'turn';
}

/**
 * Computes differences between two MindMaps:
 * - added: nodes present in `currentMap` but not in `prevMap`
 * - removed: nodes present in `prevMap` but not in `currentMap`
 * - approved: nodes in `currentMap` that have status 'approved' and were either
 *   not in `prevMap`, or were present with a non-'approved' status
 * - changed: nodes present in both maps whose core properties changed
 *   (label, detail, kind, status, source, inventiveness, importance, parent)
 *
 * Handles edge cases like null/undefined maps or empty node lists.
 *
 * @param {object|null} prevMap
 * @param {object|null} currentMap
 * @returns {{ added: number, removed: number, approved: number, changed: number }}
 */
export function diffMaps(prevMap, currentMap) {
  const prevNodes = prevMap?.nodes || [];
  const currNodes = currentMap?.nodes || [];

  const prevById = new Map();
  for (const node of prevNodes) {
    if (node && node.id != null) {
      prevById.set(String(node.id), node);
    }
  }

  const currById = new Map();
  for (const node of currNodes) {
    if (node && node.id != null) {
      currById.set(String(node.id), node);
    }
  }

  let added = 0;
  let removed = 0;
  let approved = 0;
  let changed = 0;

  for (const [id, currNode] of currById.entries()) {
    const prevNode = prevById.get(id);
    if (!prevNode) {
      added++;
      if (currNode.status === 'approved') {
        approved++;
      }
    } else {
      // Node exists in both
      if (currNode.status === 'approved' && prevNode.status !== 'approved') {
        approved++;
      }

      const isModified =
        currNode.label !== prevNode.label ||
        currNode.detail !== prevNode.detail ||
        currNode.status !== prevNode.status ||
        currNode.kind !== prevNode.kind ||
        currNode.source !== prevNode.source ||
        currNode.inventiveness !== prevNode.inventiveness ||
        currNode.importance !== prevNode.importance ||
        currNode.parent !== prevNode.parent;

      if (isModified) {
        changed++;
      }
    }
  }

  for (const id of prevById.keys()) {
    if (!currById.has(id)) {
      removed++;
    }
  }

  return { added, removed, approved, changed };
}

/**
 * Formats a diff object into a user-friendly string for the hover tooltip.
 * e.g., "+3 bubbles, 2 approved", "no changes", "+1 bubble, 1 removed"
 *
 * @param {{ added: number, removed: number, approved: number, changed: number }} diff
 * @returns {string}
 */
export function formatDiff(diff) {
  if (!diff) return 'no changes';
  const parts = [];

  if (diff.added > 0) {
    parts.push(`+${diff.added} bubble${diff.added === 1 ? '' : 's'}`);
  }
  if (diff.removed > 0) {
    parts.push(`-${diff.removed} removed`);
  }
  if (diff.approved > 0) {
    parts.push(`${diff.approved} approved`);
  }
  if (diff.changed > 0 && diff.added === 0 && diff.removed === 0 && diff.approved === 0) {
    parts.push(`${diff.changed} modified`);
  }

  if (parts.length === 0) {
    return 'no changes';
  }
  return parts.join(', ');
}

/**
 * Returns the neighbor checkpoint or null (live) when moving by delta (+1 or -1).
 *
 * The timeline sequence is: checkpoints[0], checkpoints[1], ..., checkpoints[N-1], null (live).
 * If checkpoints is empty, returns null.
 *
 * @param {Array<object>} checkpoints List of checkpoints
 * @param {string|null} activeId ID of current active checkpoint, or null for live
 * @param {number} delta +1 for next, -1 for previous
 * @returns {object|null} The target checkpoint object, or null for live
 */
export function neighbor(checkpoints, activeId, delta) {
  const cps = Array.isArray(checkpoints) ? checkpoints : [];
  if (cps.length === 0) return null;

  // Items sequence: [...cps, null] (null is live)
  // Find current index
  let currentIndex = -1;
  if (activeId === null || activeId === undefined) {
    currentIndex = cps.length; // live position at the end
  } else {
    currentIndex = cps.findIndex((cp) => cp && String(cp.id) === String(activeId));
    if (currentIndex === -1) {
      // If activeId wasn't found, default to live
      currentIndex = cps.length;
    }
  }

  const nextIndex = Math.max(0, Math.min(cps.length, currentIndex + delta));
  if (nextIndex === cps.length) {
    return null;
  }
  return cps[nextIndex];
}
