import { FACETS } from "../../ai/taxonomy.ts";

/** All 18 canonical taxonomy topic names */
export const TAXONOMY_TOPICS = FACETS.flatMap((f) => f.topics.map((t) => t.name));
export const REQUIRED_FACETS = ["design", "audience", "functionality", "cost"];

/**
 * Normalizes a topic or string for comparison (lowercase, trimmed).
 */
function normalize(str) {
  return String(str || "").toLowerCase().trim();
}

/**
 * Checks whether a node corresponds to a taxonomy topic.
 * Topics are typically formatted as "<Topic>: <decision>" or named "<Topic>".
 */
export function matchTopic(nodeLabel, topicName) {
  const normLabel = normalize(nodeLabel);
  const normTopic = normalize(topicName);
  if (normLabel === normTopic) return true;
  if (normLabel.startsWith(`${normTopic}:`)) return true;
  if (normLabel.startsWith(`${normTopic} `)) return true;
  if (normLabel.startsWith(`${normTopic} -`)) return true;
  return false;
}

/**
 * Scores a mind map plan.
 *
 * @param {object} sessionOrMap - Session object or MindMap { nodes, edges }
 * @returns {object} Plan score metrics
 */
export function scorePlan(sessionOrMap) {
  const map = sessionOrMap?.map ?? sessionOrMap ?? { nodes: [], edges: [] };
  const nodes = Array.isArray(map.nodes) ? map.nodes : [];
  const edges = Array.isArray(map.edges) ? map.edges : [];

  const countsBySource = {
    user: 0,
    inferred: 0,
    unknown: 0,
    approved: 0,
  };

  const presentFacets = new Set();
  const matchedTopics = new Set();

  for (const node of nodes) {
    const src = node.source;
    if (countsBySource[src] !== undefined) {
      countsBySource[src]++;
    }

    if (node.facet && REQUIRED_FACETS.includes(node.facet)) {
      presentFacets.add(node.facet);
    }

    // Check if the node label represents one of the 4 facet bubbles directly (e.g. "Design", "Audience")
    const normLabel = normalize(node.label);
    for (const f of REQUIRED_FACETS) {
      if (normLabel === f) {
        presentFacets.add(f);
      }
    }

    // Match taxonomy topics
    for (const topic of TAXONOMY_TOPICS) {
      if (matchTopic(node.label, topic)) {
        matchedTopics.add(topic);
      }
    }
  }

  const allFacetsPresent = REQUIRED_FACETS.every((f) => presentFacets.has(f));

  // Find Pages node(s) and count their children
  const pageNodes = nodes.filter((n) => matchTopic(n.label, "Pages") || normalize(n.label) === "pages");
  const pageNodeIds = new Set(pageNodes.map((n) => n.id));

  // Children can be linked via `node.parent === pageNode.id` or via edges from pageNode
  const pageChildrenIds = new Set();
  for (const node of nodes) {
    if (node.parent && pageNodeIds.has(node.parent)) {
      pageChildrenIds.add(node.id);
    }
  }
  for (const edge of edges) {
    if (pageNodeIds.has(edge.from) && edge.to) {
      pageChildrenIds.add(edge.to);
    }
  }

  return {
    nodeCount: nodes.length,
    countsBySource,
    allFacetsPresent,
    topicsFound: matchedTopics.size,
    topicsTotal: TAXONOMY_TOPICS.length,
    matchedTopics: Array.from(matchedTopics),
    pagesChildrenCount: pageChildrenIds.size,
    unknownCount: countsBySource.unknown,
  };
}

/**
 * Scores a build HTML output.
 *
 * @param {string|object} buildOrHtml - HTML string or Build object { html }
 * @returns {object} Build score metrics
 */
export function scoreBuild(buildOrHtml) {
  const html = typeof buildOrHtml === "string" ? buildOrHtml : (buildOrHtml?.html ?? "");
  const size = Buffer.byteLength(html, "utf8");
  const htmlEndTagPresent = /<\/html\s*>/i.test(html);

  // Count elements with data-mc attribute
  const dataMcMatches = html.match(/data-mc=["'][^"']*["']/g) || [];
  const dataMcCount = dataMcMatches.length;

  // Check for any "Assumed" text (case-insensitive)
  // Look for occurrences of "assumed" outside of tag definitions or within visible text/attributes
  const assumedMatches = html.match(/\bassumed\b/gi) || [];
  const hasAssumed = assumedMatches.length > 0;

  // Check for href="#" or href='#'
  const hrefHashMatches = html.match(/href=["']#["']/g) || [];
  const hasHrefHash = hrefHashMatches.length > 0;

  return {
    size,
    htmlEndTagPresent,
    dataMcCount,
    hasAssumed,
    assumedCount: assumedMatches.length,
    hasHrefHash,
    hrefHashCount: hrefHashMatches.length,
  };
}

/**
 * Formats evaluation results into tools/eval/report.md Markdown table format.
 *
 * @param {Array<object>} results - Array of { prompt, planScore, buildScore }
 * @returns {string} Markdown document
 */
export function formatMarkdownReport(results) {
  const lines = [
    "# Prompt Evaluation Report",
    "",
    "| Prompt | Nodes (U/I/Unk/App) | All 4 Facets | Topics Found | Pages Children | Unknowns | Build Size | `</html>` | data-mc | Has Assumed | Has `href=\"#\"` |",
    "|---|---|---|---|---|---|---|---|---|---|---|",
  ];

  for (const r of results) {
    const p = r.prompt;
    const name = p.name || p.id || "Unknown";
    const ps = r.planScore || {
      nodeCount: 0,
      countsBySource: { user: 0, inferred: 0, unknown: 0, approved: 0 },
      allFacetsPresent: false,
      topicsFound: 0,
      topicsTotal: TAXONOMY_TOPICS.length,
      pagesChildrenCount: 0,
      unknownCount: 0,
    };
    const bs = r.buildScore;

    const sources = `${ps.countsBySource.user}/${ps.countsBySource.inferred}/${ps.countsBySource.unknown}/${ps.countsBySource.approved}`;
    const nodeCol = `${ps.nodeCount} (${sources})`;
    const facetsCol = ps.allFacetsPresent ? "yes" : "no";
    const topicsCol = `${ps.topicsFound}/${ps.topicsTotal}`;
    const pagesCol = `${ps.pagesChildrenCount}`;
    const unkCol = `${ps.unknownCount}`;

    let buildSizeCol = "-";
    let htmlEndCol = "-";
    let dataMcCol = "-";
    let assumedCol = "-";
    let hrefHashCol = "-";

    if (bs) {
      buildSizeCol = `${bs.size} B`;
      htmlEndCol = bs.htmlEndTagPresent ? "yes" : "no";
      dataMcCol = `${bs.dataMcCount}`;
      assumedCol = bs.hasAssumed ? `yes (${bs.assumedCount})` : "no";
      hrefHashCol = bs.hasHrefHash ? `yes (${bs.hrefHashCount})` : "no";
    }

    lines.push(
      `| ${name} | ${nodeCol} | ${facetsCol} | ${topicsCol} | ${pagesCol} | ${unkCol} | ${buildSizeCol} | ${htmlEndCol} | ${dataMcCol} | ${assumedCol} | ${hrefHashCol} |`
    );
  }

  lines.push("");
  return lines.join("\n");
}
