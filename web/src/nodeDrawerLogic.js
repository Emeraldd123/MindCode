// web/src/nodeDrawerLogic.js
// Pure helper functions for NodeDrawer component

/**
 * Returns badge label and CSS className based on node source and status.
 * According to product spec:
 * - approved nodes show green check whatever their source
 * - locked nodes show locked badge
 * - otherwise source determines: user (blue), inferred (amber), unknown (red with '?')
 */
export function sourceBadge(node) {
  if (!node) {
    return { label: 'Unknown ?', className: 'badge-unknown' };
  }

  if (node.status === 'locked') {
    return { label: 'Locked 🔒', className: 'badge-locked' };
  }

  if (node.status === 'approved' || node.source === 'approved') {
    return { label: 'Approved ✓', className: 'badge-approved' };
  }

  if (node.source === 'user') {
    return { label: 'User', className: 'badge-user' };
  }

  if (node.source === 'inferred') {
    return { label: 'Inferred', className: 'badge-inferred' };
  }

  if (node.source === 'unknown') {
    return { label: 'Unknown ?', className: 'badge-unknown' };
  }

  return { label: node.source || 'Unknown ?', className: 'badge-unknown' };
}

/**
 * Returns whether the node can be approved.
 * Approve is disabled or hidden when already approved or locked.
 */
export function canApprove(node) {
  if (!node) return false;
  return node.status !== 'approved' && node.status !== 'locked';
}

/**
 * Returns the next status when toggling lock.
 * If currently locked, toggles to 'approved'.
 * Otherwise toggles to 'locked'.
 */
export function nextLockStatus(node) {
  return node?.status === 'locked' ? 'approved' : 'locked';
}

/**
 * Returns whether chat input is enabled for the node.
 * Locked nodes cannot be chatted with.
 */
export function canChat(node) {
  if (!node) return false;
  return node.status !== 'locked';
}

/**
 * Clamps inventiveness value to [0, 1].
 */
export function normalizeInventiveness(val) {
  const num = typeof val === 'number' ? val : parseFloat(val);
  if (Number.isNaN(num)) return 0;
  return Math.max(0, Math.min(1, num));
}
