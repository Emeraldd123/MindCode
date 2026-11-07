import { describe, expect, it } from "vitest";
import { scorePlan, scoreBuild, formatMarkdownReport, matchTopic, TAXONOMY_TOPICS } from "./score.mjs";

describe("score.mjs", () => {
  describe("matchTopic", () => {
    it("matches exact name and prefixes with colon or space", () => {
      expect(matchTopic("Brand", "Brand")).toBe(true);
      expect(matchTopic("Brand: Modern and energetic", "Brand")).toBe(true);
      expect(matchTopic("brand: sleek", "Brand")).toBe(true);
      expect(matchTopic("Color: warm pastels", "Color")).toBe(true);
      expect(matchTopic("Pages - Landing, Dashboard", "Pages")).toBe(true);
      expect(matchTopic("Random other text", "Brand")).toBe(false);
    });
  });

  describe("scorePlan", () => {
    it("scores fake mode demo map accurately", () => {
      const demoMap = {
        nodes: [
          { id: "n1", label: "Chat app", source: "user", facet: "goal", parent: null },
          { id: "n2", label: "Study group", source: "user", facet: "audience", parent: "n1" },
          { id: "n3", label: "Message API", source: "inferred", facet: "functionality", parent: "n1" },
          { id: "n4", label: "Real-time updates", source: "inferred", facet: "functionality", parent: "n1" },
          { id: "n5", label: "How do users log in?", source: "unknown", facet: "audience", parent: "n1" },
        ],
        edges: [
          { from: "n1", to: "n2", relation: "has" },
          { from: "n1", to: "n3", relation: "needs" },
          { from: "n1", to: "n4", relation: "has" },
          { from: "n1", to: "n5", relation: "needs" },
        ],
      };

      const score = scorePlan(demoMap);
      expect(score.nodeCount).toBe(5);
      expect(score.countsBySource).toEqual({
        user: 2,
        inferred: 2,
        unknown: 1,
        approved: 0,
      });
      // Missing design and cost facets
      expect(score.allFacetsPresent).toBe(false);
      expect(score.unknownCount).toBe(1);
      expect(score.pagesChildrenCount).toBe(0);
    });

    it("detects all 4 facets and topic bubbles with Pages children", () => {
      const richMap = {
        nodes: [
          { id: "n1", label: "Banking app", source: "user", facet: "goal", parent: null },
          // 4 facets
          { id: "f1", label: "Design", source: "inferred", facet: "design", parent: "n1" },
          { id: "f2", label: "Audience", source: "inferred", facet: "audience", parent: "n1" },
          { id: "f3", label: "Functionality", source: "inferred", facet: "functionality", parent: "n1" },
          { id: "f4", label: "Cost", source: "inferred", facet: "cost", parent: "n1" },
          // Topics
          { id: "t1", label: "Brand: Trustworthy", source: "inferred", facet: "design", parent: "f1" },
          { id: "t2", label: "Color: Navy and Gold", source: "inferred", facet: "design", parent: "f1" },
          { id: "t3", label: "Pages", source: "inferred", facet: "design", parent: "f1" },
          { id: "p1", label: "Accounts dashboard", source: "inferred", facet: "design", parent: "t3" },
          { id: "p2", label: "Transfers screen", source: "inferred", facet: "design", parent: "t3" },
          { id: "t4", label: "Users: retail banking clients", source: "user", facet: "audience", parent: "f2" },
          { id: "t5", label: "Hosting: AWS cloud", source: "inferred", facet: "functionality", parent: "f3" },
          { id: "t6", label: "APIs: Plaid & Stripe", source: "inferred", facet: "cost", parent: "f4" },
          { id: "u1", label: "Compliance: KYC partner?", source: "unknown", facet: "cost", parent: "f4" },
        ],
        edges: [
          { from: "t3", to: "p1", relation: "has" },
          { from: "t3", to: "p2", relation: "has" },
        ],
      };

      const score = scorePlan(richMap);
      expect(score.nodeCount).toBe(14);
      expect(score.countsBySource).toEqual({
        user: 2,
        inferred: 11,
        unknown: 1,
        approved: 0,
      });
      expect(score.allFacetsPresent).toBe(true);
      expect(score.pagesChildrenCount).toBe(2);
      expect(score.unknownCount).toBe(1);
      // Topics found: Brand, Color, Pages, Users, Hosting, APIs (6 topics)
      expect(score.topicsFound).toBe(6);
      expect(score.matchedTopics).toContain("Brand");
      expect(score.matchedTopics).toContain("Color");
      expect(score.matchedTopics).toContain("Pages");
      expect(score.matchedTopics).toContain("Users");
      expect(score.matchedTopics).toContain("Hosting");
      expect(score.matchedTopics).toContain("APIs");
    });
  });

  describe("scoreBuild", () => {
    it("evaluates clean build HTML correctly", () => {
      const html = `<!doctype html>
<html>
<head><title>App</title></head>
<body>
  <div data-mc-el="e1" data-mc="n1">Title</div>
  <button data-mc-el="e2" data-mc="n2">Action</button>
</body>
</html>`;

      const score = scoreBuild(html);
      expect(score.size).toBeGreaterThan(0);
      expect(score.htmlEndTagPresent).toBe(true);
      expect(score.dataMcCount).toBe(2);
      expect(score.hasAssumed).toBe(false);
      expect(score.hasHrefHash).toBe(false);
    });

    it("detects missing </html>, assumed text, and href='#' flags", () => {
      const html = `<div data-mc-el="e1" data-mc="n1">
        <a href="#">Placeholder link</a>
        <p>Assumed defaults for user preferences</p>
      </div>`;

      const score = scoreBuild(html);
      expect(score.htmlEndTagPresent).toBe(false);
      expect(score.dataMcCount).toBe(1);
      expect(score.hasAssumed).toBe(true);
      expect(score.assumedCount).toBe(1);
      expect(score.hasHrefHash).toBe(true);
      expect(score.hrefHashCount).toBe(1);
    });
  });

  describe("formatMarkdownReport", () => {
    it("renders valid Markdown table with correct columns", () => {
      const results = [
        {
          prompt: { id: "chat-app", name: "Chat app" },
          planScore: {
            nodeCount: 5,
            countsBySource: { user: 2, inferred: 2, unknown: 1, approved: 0 },
            allFacetsPresent: false,
            topicsFound: 2,
            topicsTotal: TAXONOMY_TOPICS.length,
            pagesChildrenCount: 0,
            unknownCount: 1,
          },
          buildScore: {
            size: 1540,
            htmlEndTagPresent: true,
            dataMcCount: 4,
            hasAssumed: false,
            assumedCount: 0,
            hasHrefHash: false,
            hrefHashCount: 0,
          },
        },
      ];

      const md = formatMarkdownReport(results);
      expect(md).toContain("# Prompt Evaluation Report");
      expect(md).toContain("| Prompt | Nodes (U/I/Unk/App) | All 4 Facets | Topics Found | Pages Children | Unknowns | Build Size | `</html>` | data-mc | Has Assumed | Has `href=\"#\"` |");
      expect(md).toContain("| Chat app | 5 (2/2/1/0) | no | 2/18 | 0 | 1 | 1540 B | yes | 4 | no | no |");
    });
  });
});
