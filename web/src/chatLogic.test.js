// web/src/chatLogic.test.js
import { describe, it, expect } from 'vitest';
import { escapeHtml, renderMarkdownSafe, summarizeChange, formatCooldown, formatApiError } from './chatLogic';

describe('chatLogic', () => {
  describe('escapeHtml', () => {
    it('escapes &, <, >, ", and \'', () => {
      expect(escapeHtml('<script>alert("xss & fun")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss &amp; fun&quot;)&lt;/script&gt;'
      );
      expect(escapeHtml("it's a test")).toBe('it&#39;s a test');
    });

    it('returns empty string for null, undefined, or empty string', () => {
      expect(escapeHtml('')).toBe('');
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });
  });

  describe('renderMarkdownSafe', () => {
    it('escapes raw HTML tags such as <script>', () => {
      const output = renderMarkdownSafe('<script>alert("xss")</script>');
      expect(output).not.toContain('<script>');
      expect(output).toContain('&lt;script&gt;');
    });

    it('renders bold text safely', () => {
      const output = renderMarkdownSafe('Hello **world** and **Claude**!');
      expect(output).toBe('Hello <strong>world</strong> and <strong>Claude</strong>!');
    });

    it('escapes html inside bold tags', () => {
      const output = renderMarkdownSafe('**<img src=x onerror=alert(1)>**');
      expect(output).toBe('<strong>&lt;img src=x onerror=alert(1)&gt;</strong>');
    });

    it('renders bullet lists starting with * or -', () => {
      const markdown = `Here are the options:
* Option 1
* Option 2 with **bold**
- Option 3`;
      const output = renderMarkdownSafe(markdown);
      expect(output).toContain('Here are the options:');
      expect(output).toContain('<ul><li>Option 1</li><li>Option 2 with <strong>bold</strong></li><li>Option 3</li></ul>');
    });

    it('handles line breaks with <br />', () => {
      const markdown = `Line 1
Line 2

Line 3`;
      const output = renderMarkdownSafe(markdown);
      expect(output).toContain('Line 1<br />Line 2<br />Line 3');
    });

    it('handles empty or non-string inputs', () => {
      expect(renderMarkdownSafe('')).toBe('');
      expect(renderMarkdownSafe(null)).toBe('');
      expect(renderMarkdownSafe(undefined)).toBe('');
    });
  });

  describe('summarizeChange', () => {
    const mockMap = {
      nodes: [
        { id: 'n1', label: 'Chat app', source: 'user' },
        { id: 'n2', label: 'Message API', source: 'inferred' },
        { id: 'n3', label: 'Real-time updates', source: 'inferred' },
        { id: 'n4', label: 'Notifications', source: 'inferred' },
        { id: 'n5', label: 'Login method?', source: 'unknown' },
        { id: 'n6', label: 'Database choice?', source: 'unknown' },
      ],
    };

    it('returns "+5 bubbles · 3 assumed · 2 questions" when matching 5 nodes', () => {
      const changedIds = ['n1', 'n2', 'n3', 'n4', 'n5', 'n6'];
      const summary = summarizeChange(changedIds, mockMap);
      expect(summary).toBe('+6 bubbles · 3 assumed · 2 questions');
    });

    it('handles singular forms correctly', () => {
      const changedIds = ['n2'];
      const summary = summarizeChange(changedIds, mockMap);
      expect(summary).toBe('+1 bubble · 1 assumed');

      const qOnly = ['n5'];
      const qSummary = summarizeChange(qOnly, mockMap);
      expect(qSummary).toBe('+1 bubble · 1 question');
    });

    it('handles only user bubbles', () => {
      const changedIds = ['n1'];
      const summary = summarizeChange(changedIds, mockMap);
      expect(summary).toBe('+1 bubble');
    });

    it('returns null when changedIds is empty or invalid', () => {
      expect(summarizeChange([], mockMap)).toBeNull();
      expect(summarizeChange(null, mockMap)).toBeNull();
      expect(summarizeChange(['n1'], null)).toBeNull();
      expect(summarizeChange(['n1'], { nodes: null })).toBeNull();
    });
  });

  describe('formatCooldown', () => {
    it('formats seconds into "Please wait N s"', () => {
      expect(formatCooldown(5)).toBe('Please wait 5 s');
      expect(formatCooldown(1)).toBe('Please wait 1 s');
      expect(formatCooldown(8)).toBe('Please wait 8 s');
    });

    it('handles fractional, 0, or negative numbers cleanly', () => {
      expect(formatCooldown(4.2)).toBe('Please wait 5 s');
      expect(formatCooldown(0)).toBe('Please wait 0 s');
      expect(formatCooldown(-2)).toBe('Please wait 0 s');
      expect(formatCooldown(null)).toBe('Please wait 0 s');
    });
  });

  describe('formatApiError', () => {
    it('formats 429 errors with retry_after_s', () => {
      const err = { status: 429, retry_after_s: 5, detail: 'chat cooldown in effect; please wait before sending another message' };
      expect(formatApiError(err)).toBe('Please wait 5 s');
    });

    it('formats 429 without retry_after_s', () => {
      const err = { status: 429, detail: 'cooldown in effect' };
      expect(formatApiError(err)).toBe('Please wait a moment before trying again');
    });

    it('formats 413 chat text limit', () => {
      const err = { status: 413, detail: 'chat text exceeds maximum length of 4000 characters' };
      expect(formatApiError(err)).toBe('Message is too long. Maximum length is 4,000 characters.');
    });

    it('formats 413 label limit', () => {
      const err = { status: 413, detail: 'label exceeds maximum length of 80 characters' };
      expect(formatApiError(err)).toBe('Bubble title is too long. Maximum length is 80 characters.');
    });

    it('formats 413 detail limit', () => {
      const err = { status: 413, detail: 'detail exceeds maximum length of 500 characters' };
      expect(formatApiError(err)).toBe('Bubble description is too long. Maximum length is 500 characters.');
    });

    it('formats 409 max nodes limit', () => {
      const err = { status: 409, detail: 'maximum map node limit of 60 reached' };
      expect(formatApiError(err)).toBe('Map limit reached: you cannot add more than 60 bubbles.');
    });

    it('formats 409 pending operations', () => {
      expect(formatApiError({ status: 409, detail: 'Claude is still working on the previous message' })).toBe(
        'Claude is still working on the previous message. Please wait.'
      );
      expect(formatApiError({ status: 409, detail: 'a build is already running' })).toBe(
        'A build is already running. Please wait for it to finish.'
      );
    });

    it('falls back cleanly for other errors or missing error object', () => {
      expect(formatApiError(null)).toBe('An unexpected error occurred');
      expect(formatApiError({ message: 'Network failed' })).toBe('Network failed');
      expect(formatApiError(new Error('Something broke'))).toBe('Something broke');
    });
  });
});
