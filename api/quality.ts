/**
 * Quality checker for generated standalone HTML applications.
 * Uses lightweight regex parsing without external dependencies.
 */

export interface QualityReport {
  /** Overall quality score from 0 to 100 based on documented penalty weights. */
  score: number;
  /** Count of visible text occurrences matching /Assumed:/i. */
  assumedNotes: number;
  /** Total count of placeholder occurrences (lorem ipsum, John Doe, Jane Doe, Jordan Lee, Acme, TODO, coming soon). */
  placeholders: number;
  /** Count of <a> tags with empty href or href="#". */
  deadLinks: number;
  /** Count of <button> elements lacking visible text and aria-label. */
  buttonsWithoutText: number;
  /** Count of <img> tags missing an alt attribute. */
  imagesWithoutAlt: number;
  /** Count of <input> fields missing associated <label>, aria-label, or placeholder. */
  inputsWithoutLabel: number;
  /** True if <meta name="viewport" ...> exists. */
  hasViewportMeta: boolean;
  /** True if non-empty <title>...</title> exists. */
  hasTitle: boolean;
  /** Number of inline <script> tags (without src attribute). */
  inlineScriptCount: number;
  /** Number of external <script src="..."> tags (should be 0 for standalone apps). */
  externalScripts: number;
  /** List of detected quality issues and warnings. */
  issues: string[];
}

/**
 * Weights and penalties for computing the 0-100 overall score:
 * - Missing viewport meta: -10 pts
 * - Missing title: -10 pts
 * - External script tags: -15 pts per script (generated apps must be standalone)
 * - Assumed notes in visible text: -10 pts per occurrence
 * - Placeholders: -5 pts per occurrence (max -25 pts)
 * - Dead links (href="#" or empty): -5 pts per occurrence (max -20 pts)
 * - Buttons without text or aria-label: -5 pts per occurrence (max -20 pts)
 * - Images without alt: -5 pts per occurrence (max -20 pts)
 * - Inputs without label/aria-label/placeholder: -5 pts per occurrence (max -20 pts)
 *
 * The final score is clamped between 0 and 100.
 */
export const QUALITY_WEIGHTS = {
  MISSING_VIEWPORT: 10,
  MISSING_TITLE: 10,
  EXTERNAL_SCRIPT: 15,
  ASSUMED_NOTE: 10,
  PLACEHOLDER: 5,
  MAX_PLACEHOLDER_PENALTY: 25,
  DEAD_LINK: 5,
  MAX_DEAD_LINK_PENALTY: 20,
  BUTTON_WITHOUT_TEXT: 5,
  MAX_BUTTON_PENALTY: 20,
  IMAGE_WITHOUT_ALT: 5,
  MAX_IMAGE_PENALTY: 20,
  INPUT_WITHOUT_LABEL: 5,
  MAX_INPUT_PENALTY: 20,
} as const;

const PLACEHOLDER_PATTERNS = [
  /\blorem\s+ipsum\b/i,
  /\bJohn\s+Doe\b/i,
  /\bJane\s+Doe\b/i,
  /\bJordan\s+Lee\b/i,
  /\bAcme\b/i,
  /\bTODO\b/,
  /\bcoming\s+soon\b/i,
];

function getAttr(tag: string, attrName: string): string | null {
  const match = tag.match(new RegExp(`(?:^|\\s)${attrName}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"));
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? "";
}

function hasAttr(tag: string, attrName: string): boolean {
  return new RegExp(`(?:^|\\s)${attrName}(?:\\s*=\\s*|\\s|[/>])`, "i").test(tag);
}

/**
 * Extracts visible body text by stripping scripts, styles, comments, and HTML tags.
 */
function extractVisibleText(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ");
}

/**
 * Runs automated quality inspection on standalone generated HTML.
 */
export function checkQuality(html: string): QualityReport {
  const issues: string[] = [];

  // 1. Meta Viewport
  const hasViewportMeta = /<meta\b[^>]*\bname\s*=\s*["']?viewport["']?[^>]*>/i.test(html) ||
    /<meta\b[^>]*\bcontent\s*=[^>]*\bname\s*=\s*["']?viewport["']?[^>]*>/i.test(html);
  if (!hasViewportMeta) {
    issues.push("Missing <meta name=\"viewport\"> tag");
  }

  // 2. Title
  const titleMatch = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  const titleText = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
  const hasTitle = Boolean(titleText);
  if (!hasTitle) {
    issues.push("Missing or empty <title> tag");
  }

  // 3. Scripts: inline vs external
  let inlineScriptCount = 0;
  let externalScripts = 0;
  const scriptTagRegex = /<script\b([^>]*)>/gi;
  let scriptMatch: RegExpExecArray | null;
  while ((scriptMatch = scriptTagRegex.exec(html)) !== null) {
    const attrs = scriptMatch[1];
    if (/\bsrc\s*=/i.test(attrs)) {
      externalScripts++;
    } else {
      inlineScriptCount++;
    }
  }
  if (externalScripts > 0) {
    issues.push(`Contains ${externalScripts} external script tag(s); apps should be self-contained`);
  }

  // 4. Visible Text Checks (Assumed notes and placeholders)
  const visibleText = extractVisibleText(html);

  // Assumed notes
  const assumedMatches = visibleText.match(/Assumed:/gi);
  const assumedNotes = assumedMatches ? assumedMatches.length : 0;
  if (assumedNotes > 0) {
    issues.push(`Found ${assumedNotes} visible "Assumed:" note(s)`);
  }

  // Placeholders
  let placeholders = 0;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    const globalPattern = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
    const m = visibleText.match(globalPattern);
    if (m) {
      placeholders += m.length;
    }
  }
  if (placeholders > 0) {
    issues.push(`Found ${placeholders} placeholder text instance(s)`);
  }

  // 5. Dead links: href="#" or empty href
  let deadLinks = 0;
  const anchorTagRegex = /<a\b([^>]*)>/gi;
  let anchorMatch: RegExpExecArray | null;
  while ((anchorMatch = anchorTagRegex.exec(html)) !== null) {
    const tag = anchorMatch[0];
    const hrefVal = getAttr(tag, "href");
    if (hrefVal === null || hrefVal.trim() === "" || hrefVal.trim() === "#") {
      deadLinks++;
    }
  }
  if (deadLinks > 0) {
    issues.push(`Found ${deadLinks} dead link(s) with empty href or href="#"`);
  }

  // 6. Buttons without text or aria-label
  let buttonsWithoutText = 0;
  const buttonRegex = /<button\b([^>]*)>([\s\S]*?)<\/button>/gi;
  let buttonMatch: RegExpExecArray | null;
  while ((buttonMatch = buttonRegex.exec(html)) !== null) {
    const openingTag = buttonMatch[1];
    const innerContent = buttonMatch[2];
    const textOnly = innerContent.replace(/<[^>]+>/g, "").trim();
    const ariaLabel = getAttr(`<button ${openingTag}>`, "aria-label");
    const titleAttr = getAttr(`<button ${openingTag}>`, "title");

    const hasAccessibleText = Boolean(textOnly) || Boolean(ariaLabel?.trim()) || Boolean(titleAttr?.trim());
    if (!hasAccessibleText) {
      buttonsWithoutText++;
    }
  }
  if (buttonsWithoutText > 0) {
    issues.push(`Found ${buttonsWithoutText} button(s) with no text, title, or aria-label`);
  }

  // 7. Images without alt attribute
  let imagesWithoutAlt = 0;
  const imgRegex = /<img\b([^>]*)>/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgRegex.exec(html)) !== null) {
    const tag = imgMatch[0];
    if (!hasAttr(tag, "alt")) {
      imagesWithoutAlt++;
    }
  }
  if (imagesWithoutAlt > 0) {
    issues.push(`Found ${imagesWithoutAlt} image(s) missing alt attribute`);
  }

  // 8. Inputs without label, aria-label, aria-labelledby, or placeholder
  // Find all label for="..." targets
  const labelForTargets = new Set<string>();
  const labelForRegex = /<label\b[^>]*\bfor\s*=\s*["']?([^"'\s>]+)["']?[^>]*>/gi;
  let labelMatch: RegExpExecArray | null;
  while ((labelMatch = labelForRegex.exec(html)) !== null) {
    labelForTargets.add(labelMatch[1]);
  }

  // Check inputs wrapped in <label>...</label>
  const wrappedInputIds = new Set<string>();
  const labelWrapperRegex = /<label\b[^>]*>([\s\S]*?)<\/label>/gi;
  let wrapperMatch: RegExpExecArray | null;
  while ((wrapperMatch = labelWrapperRegex.exec(html)) !== null) {
    const content = wrapperMatch[1];
    const idMatches = content.matchAll(/<input\b[^>]*\bid\s*=\s*["']?([^"'\s>]+)["']?[^>]*>/gi);
    for (const m of idMatches) {
      wrappedInputIds.add(m[1]);
    }
  }

  let inputsWithoutLabel = 0;
  const inputRegex = /<input\b([^>]*)>/gi;
  let inputTagMatch: RegExpExecArray | null;
  while ((inputTagMatch = inputRegex.exec(html)) !== null) {
    const tag = inputTagMatch[0];
    const type = (getAttr(tag, "type") || "text").toLowerCase();
    // Non-interactive or self-labeled input types don't need external labels
    if (["hidden", "submit", "button", "reset", "image"].includes(type)) {
      continue;
    }

    const id = getAttr(tag, "id");
    const ariaLabel = getAttr(tag, "aria-label");
    const ariaLabelledBy = getAttr(tag, "aria-labelledby");
    const placeholder = getAttr(tag, "placeholder");

    const hasLabel =
      (id && labelForTargets.has(id)) ||
      (id && wrappedInputIds.has(id)) ||
      Boolean(ariaLabel?.trim()) ||
      Boolean(ariaLabelledBy?.trim()) ||
      Boolean(placeholder?.trim());

    if (!hasLabel) {
      inputsWithoutLabel++;
    }
  }
  if (inputsWithoutLabel > 0) {
    issues.push(`Found ${inputsWithoutLabel} input(s) with no associated label, aria-label, or placeholder`);
  }

  // Calculate score (0-100)
  let penalty = 0;
  if (!hasViewportMeta) penalty += QUALITY_WEIGHTS.MISSING_VIEWPORT;
  if (!hasTitle) penalty += QUALITY_WEIGHTS.MISSING_TITLE;
  penalty += externalScripts * QUALITY_WEIGHTS.EXTERNAL_SCRIPT;
  penalty += assumedNotes * QUALITY_WEIGHTS.ASSUMED_NOTE;
  penalty += Math.min(placeholders * QUALITY_WEIGHTS.PLACEHOLDER, QUALITY_WEIGHTS.MAX_PLACEHOLDER_PENALTY);
  penalty += Math.min(deadLinks * QUALITY_WEIGHTS.DEAD_LINK, QUALITY_WEIGHTS.MAX_DEAD_LINK_PENALTY);
  penalty += Math.min(buttonsWithoutText * QUALITY_WEIGHTS.BUTTON_WITHOUT_TEXT, QUALITY_WEIGHTS.MAX_BUTTON_PENALTY);
  penalty += Math.min(imagesWithoutAlt * QUALITY_WEIGHTS.IMAGE_WITHOUT_ALT, QUALITY_WEIGHTS.MAX_IMAGE_PENALTY);
  penalty += Math.min(inputsWithoutLabel * QUALITY_WEIGHTS.INPUT_WITHOUT_LABEL, QUALITY_WEIGHTS.MAX_INPUT_PENALTY);

  const score = Math.max(0, Math.min(100, 100 - penalty));

  return {
    score,
    assumedNotes,
    placeholders,
    deadLinks,
    buttonsWithoutText,
    imagesWithoutAlt,
    inputsWithoutLabel,
    hasViewportMeta,
    hasTitle,
    inlineScriptCount,
    externalScripts,
    issues,
  };
}
