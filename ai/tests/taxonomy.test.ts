import { describe, expect, it } from "vitest";
import { CROSS_LINKS, FACETS, FACET_IDS, taxonomyPrompt } from "../taxonomy.ts";

const topicNames = new Set(FACETS.flatMap((f) => f.topics.map((t) => t.name)));

describe("Ben's prompt-engineering map", () => {
  it("has the four facets with Ben's topics (Pages, Features, APIs expand into concrete children)", () => {
    expect(FACETS.map((f) => f.id)).toEqual(["design", "audience", "functionality", "cost"]);
    for (const name of ["Brand", "Color", "Font", "Size", "Pages", "Usability", "Users", "Market", "Research", "Features", "Buttons", "AI integration", "Storage", "Hosting", "Scale", "APIs", "AI usage", "Advertising"]) {
      expect(topicNames.has(name)).toBe(true);
    }
    const expanding = FACETS.flatMap((f) => f.topics).filter((t) => t.expand).map((t) => t.name);
    expect(expanding).toEqual(["Pages", "Features", "APIs"]);
  });

  it("cross-links connect real topics with allowed relations", () => {
    for (const [a, rel, b] of CROSS_LINKS) {
      expect(topicNames.has(a)).toBe(true);
      expect(topicNames.has(b)).toBe(true);
      expect(["informs", "needs"]).toContain(rel);
    }
  });

  it("the prompt demands a full, app-specific build plan with every topic", () => {
    const p = taxonomyPrompt();
    expect(p).toContain("EVERYTHING you would build");
    expect(p).toContain("NEARLY EVERY topic must appear");
    expect(p).toContain("Never a generic template");
    for (const f of FACETS) {
      expect(p).toContain(`facet "${f.id}"`);
      for (const t of f.topics) expect(p).toContain(`- ${t.name}:`);
    }
    expect([...FACET_IDS]).toHaveLength(4);
  });
});
