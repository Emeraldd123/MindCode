// Ben's map of what prompt-engineering a website involves (hand-drawn, 2026-11-07).
// The prompt (problem solving) sits at the center, with four facets around it. Each facet has
// sub-topics, and there are cross-links between them. Map extraction uses this so every app idea
// is broken down the same way, and so missing facets show up as open questions instead of being
// silently assumed.

export type Facet = "design" | "audience" | "functionality" | "cost";

export interface FacetSpec {
  id: Facet;
  label: string;
  /** Sub-topics Claude should consider under this facet. */
  topics: string[];
  /** The open question to raise when the user's prompt says nothing about this facet. */
  gapQuestion: string;
}

export const FACETS: FacetSpec[] = [
  {
    id: "design",
    label: "Design",
    topics: [
      "brand and emotional feel",
      "color",
      "font",
      "size and density",
      "pages: header, sections, other pages",
      "usability: minimalism, readability, interfaces",
    ],
    gapQuestion: "What should it look and feel like?",
  },
  {
    id: "audience",
    label: "Audience",
    topics: ["who the users are", "market size (TAM/SAM)", "consumer research and user needs"],
    gapQuestion: "Who exactly is this for?",
  },
  {
    id: "functionality",
    label: "Functionality",
    topics: [
      "features",
      "AI integration",
      "buttons and interactions",
      "storage and data",
      "server hosting",
      "scalability: number of users",
    ],
    gapQuestion: "What must it actually do?",
  },
  {
    id: "cost",
    label: "Cost",
    topics: ["APIs and third-party services", "AI usage", "hosting", "advertisement and growth"],
    gapQuestion: "What budget or running costs are acceptable?",
  },
];

/** Cross-links from Ben's map: [from facet/topic, relation, to facet/topic, why]. */
export const CROSS_LINKS: Array<[string, "informs" | "needs", string, string]> = [
  ["audience", "informs", "design", "the brand and emotional feel are based on the audience"],
  ["audience", "informs", "design", "consumer research describes the usability needs"],
  ["audience", "informs", "cost", "consumer research changes advertisement spend"],
  ["audience", "informs", "functionality", "who the users are influences which features matter"],
  ["design", "needs", "functionality", "pages require functionality, and functionality influences pages"],
  ["functionality", "informs", "cost", "functionality defines cost: hosting, storage, scale, AI and API use"],
  ["design", "informs", "cost", "design choices define cost (pages and assets to build)"],
];

export const FACET_IDS = new Set<string>(FACETS.map((f) => f.id));

/** Prompt section that teaches the extractor Ben's structure. Injected into the system prompt. */
export function taxonomyPrompt(): string {
  const facets = FACETS.map(
    (f) => `- ${f.label} (facet "${f.id}"): ${f.topics.join("; ")}. If the user said nothing about it: "${f.gapQuestion}"`,
  ).join("\n");
  const links = CROSS_LINKS.map(([a, rel, b, why]) => `- ${a} ${rel} ${b}: ${why}`).join("\n");
  return `### PROMPT-ENGINEERING STRUCTURE (Ben's map: how a website prompt breaks down)
The user's prompt is the problem to solve. Break it down along these four facets:
${facets}

Rules:
1. Give every node a "facet" field: one of "design", "audience", "functionality" or "cost". Use "goal" only for the single root node.
2. First turn: put the root goal at the top, then cover ALL four facets. Each facet gets at least one bubble: a user bubble when the user spoke to it, inferred bubbles for obvious needs, and an "unknown" bubble using that facet's question when the prompt leaves a decision open. Never invent an answer for a facet the user ignored; ask.
3. Use edges with relation "informs" or "needs" for these cross-links when both ends exist in the map:
${links}
4. Stay within the size limits: pick the most important topics per facet, not all of them.`;
}
