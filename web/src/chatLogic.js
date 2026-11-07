// web/src/chatLogic.js
// Pure logic functions for Chat component

/**
 * Escapes HTML characters in a string to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Renders light markdown safely:
 * - Escapes HTML first to block <script> and dangerous tags
 * - Supports bold text (**bold**)
 * - Supports bullet lists (* item or - item)
 * - Supports line breaks (\n)
 *
 * @param {string} text
 * @returns {string} Safe HTML string containing only <strong>, <ul>, <li>, <br />
 */
export function renderMarkdownSafe(text) {
  if (!text || typeof text !== 'string') return '';

  // 1. First escape all raw HTML characters
  const escaped = escapeHtml(text);

  // 2. Process line by line for bullet lists and line breaks
  const rawLines = escaped.split('\n');
  const resultBlocks = [];
  let currentList = null;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    // Check if line is a bullet item: starts with "* " or "- " (with optional whitespace)
    const bulletMatch = line.match(/^\s*[\*\-]\s+(.*)$/);

    if (bulletMatch) {
      const itemText = formatInline(bulletMatch[1]);
      if (!currentList) {
        currentList = [];
      }
      currentList.push(`<li>${itemText}</li>`);
    } else {
      if (currentList) {
        resultBlocks.push(`<ul>${currentList.join('')}</ul>`);
        currentList = null;
      }
      // If line is empty or whitespace
      if (line.trim() === '') {
        resultBlocks.push('');
      } else {
        resultBlocks.push(formatInline(line));
      }
    }
  }

  if (currentList) {
    resultBlocks.push(`<ul>${currentList.join('')}</ul>`);
  }

  // Join blocks: consecutive text blocks get <br />, empty lines preserve spacing
  let html = '';
  for (let i = 0; i < resultBlocks.length; i++) {
    const block = resultBlocks[i];
    if (block.startsWith('<ul>')) {
      html += block;
    } else if (block === '') {
      // Empty line -> line break if not directly after a <ul>
      if (i > 0 && !resultBlocks[i - 1].startsWith('<ul>')) {
        html += '<br />';
      }
    } else {
      if (html && !html.endsWith('</ul>') && !html.endsWith('<br />')) {
        html += '<br />';
      }
      html += block;
    }
  }

  return html;
}

/**
 * Helper to format inline markdown like **bold**.
 * Input must already be HTML-escaped.
 */
function formatInline(str) {
  // Replace **bold** with <strong>bold</strong>
  // Using non-greedy match to handle multiple bold sections
  return str.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
}

/**
 * Summarizes changes from changedIds and map.
 * Format: "+N bubbles · X assumed · Y questions"
 * Handles singular/plural cleanly.
 *
 * @param {string[]} changedIds Array of changed node IDs
 * @param {{ nodes: Array<{ id: string, source: string }> } | null} map Mind map object
 * @returns {string | null}
 */
export function summarizeChange(changedIds, map) {
  if (!Array.isArray(changedIds) || changedIds.length === 0 || !map || !Array.isArray(map.nodes)) {
    return null;
  }

  const changedSet = new Set(changedIds);
  const changedNodes = map.nodes.filter((n) => changedSet.has(n.id));

  const total = changedIds.length;
  if (total === 0) return null;

  let assumedCount = 0;
  let questionCount = 0;

  for (const node of changedNodes) {
    if (node.source === 'inferred') {
      assumedCount++;
    } else if (node.source === 'unknown') {
      questionCount++;
    }
  }

  const parts = [];
  const bubbleLabel = total === 1 ? '+1 bubble' : `+${total} bubbles`;
  parts.push(bubbleLabel);

  if (assumedCount > 0) {
    parts.push(`${assumedCount} assumed`);
  }

  if (questionCount > 0) {
    const qLabel = questionCount === 1 ? '1 question' : `${questionCount} questions`;
    parts.push(qLabel);
  }

  return parts.join(' · ');
}
