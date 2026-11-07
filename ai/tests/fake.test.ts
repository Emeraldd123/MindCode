import { describe, expect, it } from "vitest";
import { fakeUpdateMap } from "../fake.ts";
import { FACETS, CROSS_LINKS, FACET_IDS } from "../taxonomy.ts";

describe("fakeUpdateMap full plan", () => {
  const result = fakeUpdateMap([
    { role: "user", text: "I want a chat app for my study group" }
  ]);
  const { nodes, edges } = result.map;

  it("returns a realistic ~30-bubble full plan", () => {
    expect(nodes.length).toBeGreaterThanOrEqual(25);
    expect(nodes.length).toBeLessThanOrEqual(40);
  });

  it("every topic name in ai/taxonomy.ts appears", () => {
    const allTopics = FACETS.flatMap((f) => f.topics.map((t) => t.name));
    for (const topic of allTopics) {
      const match = nodes.find((n) => n.label.startsWith(`${topic}:`));
      expect(match, `Topic "${topic}" should have a node starting with "${topic}:"`).toBeDefined();
    }
  });

  it("every node has a valid facet", () => {
    const allowedFacets = new Set([...FACET_IDS, "goal"]);
    for (const node of nodes) {
      expect(node.facet, `Node ${node.id} (${node.label}) must have a facet`).toBeDefined();
      expect(allowedFacets.has(node.facet!)).toBe(true);
    }
  });

  it("parents exist (or null for root)", () => {
    const nodeIds = new Set(nodes.map((n) => n.id));
    const rootNodes = nodes.filter((n) => n.parent === null);
    expect(rootNodes).toHaveLength(1);
    expect(rootNodes[0].id).toBe("n1");

    for (const node of nodes) {
      if (node.id === "n1") {
        expect(node.parent).toBeNull();
      } else {
        expect(node.parent, `Node ${node.id} must have a non-null parent`).not.toBeNull();
        expect(nodeIds.has(node.parent!), `Node ${node.id} parent ${node.parent} must exist`).toBe(true);
      }
    }
  });

  it("has at least one unknown node (and specifically 2-3 unknowns)", () => {
    const unknowns = nodes.filter((n) => n.source === "unknown");
    expect(unknowns.length).toBeGreaterThanOrEqual(1);
    expect(unknowns.length).toBeGreaterThanOrEqual(2);
    expect(unknowns.length).toBeLessThanOrEqual(3);
  });

  it("edges reference real nodes and include 6+ cross-links", () => {
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const edge of edges) {
      expect(nodeIds.has(edge.from), `Edge from ${edge.from} must exist`).toBe(true);
      expect(nodeIds.has(edge.to), `Edge to ${edge.to} must exist`).toBe(true);
    }

    const nonHasEdges = edges.filter((e) => e.relation === "informs" || e.relation === "needs");
    expect(nonHasEdges.length).toBeGreaterThanOrEqual(6);
    expect(nonHasEdges.length).toBeGreaterThanOrEqual(CROSS_LINKS.length);
  });

  it("expands Pages, Features and APIs into concrete children", () => {
    const pagesNode = nodes.find((n) => n.label.startsWith("Pages:"));
    expect(pagesNode).toBeDefined();
    const pageChildren = nodes.filter((n) => n.parent === pagesNode?.id);
    const pageChildLabels = pageChildren.map((n) => n.label);
    expect(pageChildLabels).toContain("Sign-in/join");
    expect(pageChildLabels).toContain("Group chat room");
    expect(pageChildLabels).toContain("Direct messages");
    expect(pageChildLabels).toContain("Members & settings");

    const featuresNode = nodes.find((n) => n.label.startsWith("Features:"));
    expect(featuresNode).toBeDefined();
    const featureChildren = nodes.filter((n) => n.parent === featuresNode?.id);
    expect(featureChildren.length).toBeGreaterThanOrEqual(2);

    const apisNode = nodes.find((n) => n.label.startsWith("APIs:"));
    expect(apisNode).toBeDefined();
    const apiChildren = nodes.filter((n) => n.parent === apisNode?.id);
    expect(apiChildren.length).toBeGreaterThanOrEqual(1);
  });

  it("supports follow-up turns: stable ids, approved/locked untouched, answering login unknown", () => {
    // 1. Answering login unknown
    const turn2 = fakeUpdateMap(
      [
        { role: "user", text: "I want a chat app for my study group" },
        { role: "assistant", text: result.reply },
        { role: "user", text: "just a nickname, no passwords" },
      ],
      result.map
    );
    const loginNode = turn2.map.nodes.find((n) => n.label === "Nickname login");
    expect(loginNode).toBeDefined();
    expect(loginNode?.source).toBe("user");
    expect(turn2.changed).toContain(loginNode?.id);

    // 2. Incremental additions
    const turn3 = fakeUpdateMap(
      [
        { role: "user", text: "I want a chat app for my study group" },
        { role: "assistant", text: result.reply },
        { role: "user", text: "Add file sharing" },
      ],
      result.map
    );
    const added = turn3.map.nodes.find((n) => n.label.includes("Add file sharing"));
    expect(added).toBeDefined();
    expect(turn3.changed).toContain(added?.id);
  });
});
