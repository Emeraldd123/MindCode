import { describe, it, expect } from 'vitest';
import {
  sourceBadge,
  canApprove,
  nextLockStatus,
  canChat,
  normalizeInventiveness,
} from './nodeDrawerLogic';

describe('nodeDrawerLogic pure helpers', () => {
  describe('sourceBadge', () => {
    it('returns badge for user source', () => {
      const badge = sourceBadge({ source: 'user', status: 'proposed' });
      expect(badge.label).toBe('User');
      expect(badge.className).toBe('badge-user');
    });

    it('returns badge for inferred source', () => {
      const badge = sourceBadge({ source: 'inferred', status: 'proposed' });
      expect(badge.label).toBe('Inferred');
      expect(badge.className).toBe('badge-inferred');
    });

    it('returns badge with question mark for unknown source', () => {
      const badge = sourceBadge({ source: 'unknown', status: 'proposed' });
      expect(badge.label).toBe('Unknown ?');
      expect(badge.className).toBe('badge-unknown');
    });

    it('returns approved check badge when status is approved regardless of source', () => {
      const badgeUser = sourceBadge({ source: 'user', status: 'approved' });
      expect(badgeUser.label).toContain('Approved');
      expect(badgeUser.label).toContain('✓');
      expect(badgeUser.className).toBe('badge-approved');

      const badgeInferred = sourceBadge({ source: 'inferred', status: 'approved' });
      expect(badgeInferred.className).toBe('badge-approved');

      const badgeUnknown = sourceBadge({ source: 'unknown', status: 'approved' });
      expect(badgeUnknown.className).toBe('badge-approved');
    });

    it('returns locked badge when status is locked', () => {
      const badge = sourceBadge({ source: 'user', status: 'locked' });
      expect(badge.label).toContain('Locked');
      expect(badge.className).toBe('badge-locked');
    });

    it('handles null or missing node gracefully', () => {
      const badge = sourceBadge(null);
      expect(badge.label).toBe('Unknown ?');
      expect(badge.className).toBe('badge-unknown');
    });
  });

  describe('canApprove', () => {
    it('allows approving proposed nodes', () => {
      expect(canApprove({ status: 'proposed' })).toBe(true);
    });

    it('disallows approving already approved nodes', () => {
      expect(canApprove({ status: 'approved' })).toBe(false);
    });

    it('disallows approving locked nodes', () => {
      expect(canApprove({ status: 'locked' })).toBe(false);
    });

    it('returns false for null/undefined node', () => {
      expect(canApprove(null)).toBe(false);
      expect(canApprove(undefined)).toBe(false);
    });
  });

  describe('nextLockStatus', () => {
    it('returns approved when currently locked', () => {
      expect(nextLockStatus({ status: 'locked' })).toBe('approved');
    });

    it('returns locked when currently proposed', () => {
      expect(nextLockStatus({ status: 'proposed' })).toBe('locked');
    });

    it('returns locked when currently approved', () => {
      expect(nextLockStatus({ status: 'approved' })).toBe('locked');
    });

    it('returns locked when node has no status', () => {
      expect(nextLockStatus({})).toBe('locked');
      expect(nextLockStatus(null)).toBe('locked');
    });
  });

  describe('canChat', () => {
    it('allows chat for proposed nodes', () => {
      expect(canChat({ status: 'proposed' })).toBe(true);
    });

    it('allows chat for approved nodes', () => {
      expect(canChat({ status: 'approved' })).toBe(true);
    });

    it('disallows chat for locked nodes', () => {
      expect(canChat({ status: 'locked' })).toBe(false);
    });

    it('returns false for null node', () => {
      expect(canChat(null)).toBe(false);
    });
  });

  describe('normalizeInventiveness', () => {
    it('clamps values to 0..1', () => {
      expect(normalizeInventiveness(0.5)).toBe(0.5);
      expect(normalizeInventiveness(-0.2)).toBe(0);
      expect(normalizeInventiveness(1.5)).toBe(1);
      expect(normalizeInventiveness(undefined)).toBe(0);
    });
  });
});
