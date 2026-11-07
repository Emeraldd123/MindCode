// Ben's map of what prompt-engineering a full-stack website involves (hand-drawn, 2026-11-07).
//
// Purpose (Ben): while building, Claude silently assumes features the user never asked for, and
// often the user doesn't even know. MindCode's map must show EVERYTHING Claude plans to build. So
// nearly every topic below should appear on every user's map, *adapted to their app*. For example,
// "Pages" for a chat app means a signed-out landing page, a chat room and DMs; for a banking app
// it means an accounts dashboard, transfers and cards. The map is different every time.

export type Facet = "design" | "audience" | "functionality" | "cost";

export interface Topic {
  /** Bubble label prefix, e.g. "Color", so the bubble reads "Color: warm pastels". */
  name: string;
  /** What to decide for this app. */
  ask: string;
  /** Expand into one child bubble per concrete item (pages, features, APIs). */
  expand?: string;
}

export interface FacetSpec {
  id: Facet;
  label: string;
  topics: Topic[];
}

export const FACETS: FacetSpec[] = [
  {
    id: "design",
    label: "Design",
    topics: [
      { name: "Brand", ask: "brand personality and emotional feel, based on the audience" },
      { name: "Color", ask: "palette" },
      { name: "Font", ask: "typography" },
      { name: "Size", ask: "density, layout scale, desktop vs mobile" },
      { name: "Pages", ask: "every page/screen this app needs", expand: "one child bubble per concrete page (header, sections and other pages included where relevant)" },
      { name: "Usability", ask: "minimalism, readability, interfaces/navigation" },
    ],
  },
  {
    id: "audience",
    label: "Audience",
    topics: [
      { name: "Users", ask: "who exactly uses it" },
      { name: "Market", ask: "TAM/SAM: how big the target market is" },
      { name: "Research", ask: "consumer research: the needs that shape usability and ads" },
    ],
  },
  {
    id: "functionality",
    label: "Functionality",
    topics: [
      { name: "Features", ask: "the concrete features", expand: "one child bubble per concrete feature" },
      { name: "Buttons", ask: "key actions/interactions" },
      { name: "AI integration", ask: "any AI in the product (or none)" },
      { name: "Storage", ask: "data entities and where they live" },
      { name: "Hosting", ask: "server hosting and backend" },
      { name: "Scale", ask: "expected number of users; scalability" },
    ],
  },
  {
    id: "cost",
    label: "Cost",
    topics: [
      { name: "APIs", ask: "third-party APIs/services and their cost", expand: "one child bubble per external API/service if more than one" },
      { name: "AI usage", ask: "model/API spend, if AI is used" },
      { name: "Advertising", ask: "marketing/advertisement spend and channels" },
    ],
  },
];

/** Cross-links from Ben's map: [from, relation, to, why]. Endpoints are topic names. */
export const CROSS_LINKS: Array<[string, "informs" | "needs", string, string]> = [
  ["Users", "informs", "Brand", "the brand and emotional feel are based on the audience"],
  ["Research", "informs", "Usability", "consumer research describes usability needs"],
  ["Research", "informs", "Advertising", "consumer research changes advertisement"],
  ["Users", "informs", "Features", "who the users are influences the features"],
  ["Pages", "needs", "Features", "pages require functionality; functionality influences pages"],
  ["Features", "informs", "APIs", "functionality defines cost"],
  ["Hosting", "informs", "APIs", "hosting and scale define running cost"],
  ["Scale", "informs", "Hosting", "number of users drives scalability and hosting"],
];

export const FACET_IDS = new Set<string>(FACETS.map((f) => f.id));

/** Prompt section that teaches the extractor Ben's structure. Injected into the system prompt. */
export function taxonomyPrompt(): string {
  const facets = FACETS.map((f) => {
    const topics = f.topics
      .map((t) => `    - ${t.name}: ${t.ask}${t.expand ? ` (${t.expand})` : ""}`)
      .join("\n");
    return `  - ${f.label} (facet "${f.id}")\n${topics}`;
  }).join("\n");
  const links = CROSS_LINKS.map(([a, rel, b, why]) => `  - ${a} ${rel} ${b}: ${why}`).join("\n");
  return `### THE MAP IS CLAUDE'S FULL BUILD PLAN (most important rule)
While building an app, Claude normally decides dozens of things the user never asked for: pages, features, APIs, colors, hosting. The user often doesn't even know. MindCode exists to make every one of those decisions visible BEFORE anything is built. So the map must show EVERYTHING you would build for a full-stack version of THIS app. If you would build it or decide it, it gets a bubble. Anything the user did not ask for is "inferred", or "unknown" when it's a real choice the user should make.

Use Ben's map below. NEARLY EVERY topic must appear, each filled in for THIS app. Never a generic template. The map should look different for every app idea:
${facets}

Structure:
1. Root goal (facet "goal", parent null).
2. Four facet bubbles as children of the root: "Design", "Audience", "Functionality", "Cost" (kind "constraint", source "inferred", inventiveness 0, importance 3).
3. Under each facet, one bubble per topic, labelled "<Topic>: <decision for this app>", e.g. "Color: warm pastels", "Hosting: serverless + DB", "AI integration: none". Use source "user" if the user said it, "inferred" if you're assuming it (set inventiveness), and "unknown" if the user must decide (label the question, e.g. "Users: who exactly?").
4. Expand Pages, Features and APIs into concrete children for this app. Examples only: a chat app gets "Signed-out landing", "Chat room" and "Direct messages"; a banking app gets "Accounts dashboard", "Transfers" and "Cards menu", plus APIs "Bank data API" and "Payments API".
5. Skip a topic only if it truly cannot apply. Every node gets a "facet" field.
6. Add these cross-link edges (relation "informs"/"needs") between the matching topic bubbles:
${links}
7. Later turns: update the affected topic bubbles and add the concrete consequences of what the user said (e.g. "add DMs" → a DM page, DM storage, notifications).`;
}
