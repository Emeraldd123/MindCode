// Pure helpers for the bubble side panel's design widgets (font size, font, text).

/** Web-safe font stacks only: generated apps can't load web fonts inside the sandboxed preview. */
export const FONT_OPTIONS = [
  { label: 'System', value: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { label: 'Sans (Helvetica)', value: "'Helvetica Neue', Helvetica, Arial, sans-serif" },
  { label: 'Serif (Georgia)', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Rounded', value: "'Trebuchet MS', 'Segoe UI', sans-serif" },
  { label: 'Mono', value: "ui-monospace, 'SF Mono', Menlo, 'Courier New', monospace" },
  { label: '日本語ゴシック', value: "'Hiragino Sans', 'Noto Sans JP', 'Yu Gothic', Meiryo, sans-serif" },
  { label: '日本語明朝', value: "'Hiragino Mincho ProN', 'Noto Serif JP', 'Yu Mincho', serif" },
];

export const FONT_SIZE_MIN = 8;
export const FONT_SIZE_MAX = 96;

/** A bubble is a leaf when no other bubble hangs off it (by parent or a "has" edge). */
export function isLeaf(node, map) {
  if (!node) return false;
  const nodes = map?.nodes || [];
  const edges = map?.edges || [];
  return !nodes.some((n) => n.parent === node.id && n.id !== node.id)
    && !edges.some((e) => e.from === node.id && e.to !== node.id && (e.relation || 'has') === 'has');
}

const TAG_NAMES = {
  h1: 'Heading', h2: 'Heading', h3: 'Heading', h4: 'Heading', h5: 'Heading', h6: 'Heading',
  p: 'Text', span: 'Text', label: 'Label', a: 'Link', button: 'Button', input: 'Input',
  textarea: 'Text box', select: 'Dropdown', form: 'Form', ul: 'List', ol: 'List', li: 'List item',
  img: 'Image', nav: 'Navigation', header: 'Header', footer: 'Footer', section: 'Section',
  article: 'Card', main: 'Main', aside: 'Sidebar', table: 'Table',
};

/** Short human name for an inspected element, e.g. `Button · "Send"`. */
export function elementLabel(item) {
  const kind = TAG_NAMES[item?.tag] || (item?.tag ? item.tag.toUpperCase() : 'Element');
  const text = String(item?.text || '').replace(/\s+/g, ' ').trim();
  if (!text) return kind;
  return `${kind} · "${text.length > 28 ? `${text.slice(0, 27)}…` : text}"`;
}

/** Which FONT_OPTIONS entry matches a computed font-family, or '' if none does. */
export function matchFont(computed) {
  const first = String(computed || '').split(',')[0].trim().replace(/^['"]|['"]$/g, '').toLowerCase();
  if (!first) return '';
  const hit = FONT_OPTIONS.find((o) => o.value.split(',')[0].trim().replace(/^['"]|['"]$/g, '').toLowerCase() === first);
  return hit ? hit.value : '';
}

export function clampFontSize(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return null;
  return Math.max(FONT_SIZE_MIN, Math.min(FONT_SIZE_MAX, n));
}
