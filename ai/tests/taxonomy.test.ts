import { describe, expect, it } from "vitest";
import { CROSS_LINKS, FACETS, FACET_IDS, taxonomyPrompt } from "../taxonomy.ts";

describe("Ben's prompt-engineering taxonomy", () => {
  it("has the four facets from Ben's map, each with topics and a gap question", () => {
    expect(FACETS.map((f) => f.id)).toEqual(["design", "audience", "functionality", "cost"]);
    for (const f of FACETS) {
      expect(f.topics.length).toBeGreaterThan(1);
      expect(f.gapQuestion.endsWith("?")).toBe(true);
    }
  });

  it("cross-links only reference real facets and allowed relations", () => {
    for (const [a, rel, b] of CROSS_LINKS) {
      expect(FACET_IDS.has(a)).toBe(true);
      expect(FACET_IDS.has(b)).toBe(true);
      expect(["informs", "needs"]).toContain(rel);
    }
  });

  it("the prompt section names every facet, its gap question and the facet field", () => {
    const p = taxonomyPrompt();
    for (const f of FACETS) {
      expect(p).toContain(`facet "${f.id}"`);
      expect(p).toContain(f.gapQuestion);
    }
    expect(p).toContain('"facet" field');
    expect(p).toContain("functionality informs cost");
  });
});
