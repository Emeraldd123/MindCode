import { describe, test } from "vitest";
import assert from "node:assert/strict";
import { update_map } from "../extract.ts";
import { fakeUpdateMap, fakeNodeChat, fakeBuildApp } from "../fake.ts";
import { callOpenRouter } from "../client.ts";
import type { MindMap, Node } from "../types.ts";

describe("MindMap Extraction & Fake Generator", () => {
  test("generates at least 5 bubbles for the demo prompt in fake mode", async () => {
    process.env.MINDCODE_FAKE_LLM = "1";
    const messages = [
      { role: "user" as const, text: "I want a chat app for my study group" }
    ];

    const result = await update_map(messages, { nodes: [], edges: [] });

    assert.ok(result.reply.length > 0, "reply must not be empty");
    assert.ok(result.map.nodes.length >= 5, `Expected >= 5 nodes, got ${result.map.nodes.length}`);
    assert.ok(result.map.edges.length >= 4, "Expected edges connecting nodes");

    // Check sources
    const userNodes = result.map.nodes.filter(n => n.source === "user");
    const inferredNodes = result.map.nodes.filter(n => n.source === "inferred");
    const unknownNodes = result.map.nodes.filter(n => n.source === "unknown");

    assert.ok(userNodes.length >= 1, "Must have at least one user node");
    assert.ok(inferredNodes.length >= 1, "Must have at least one inferred node");
    assert.ok(unknownNodes.length >= 1, "Must have at least one unknown node");

    // Check evidence quotes for user nodes
    for (const u of userNodes) {
      assert.ok(u.evidence.length > 0, `User node ${u.id} must have evidence quote`);
      assert.equal(u.inventiveness, 0, "User node inventiveness must be 0");
    }

    // Check inventiveness on inferred nodes: should have both low and high inventiveness
    for (const inf of inferredNodes) {
      assert.equal(inf.evidence.length, 0, "Inferred node evidence must be empty");
      assert.ok(inf.inventiveness >= 0 && inf.inventiveness <= 1, "Inventiveness must be 0..1");
    }

    const hasLowInventiveness = inferredNodes.some(n => n.inventiveness <= 0.3);
    const hasHighInventiveness = inferredNodes.some(n => n.inventiveness >= 0.7);
    assert.ok(hasLowInventiveness, "Must have low inventiveness inferred node");
    assert.ok(hasHighInventiveness, "Must have high inventiveness inferred node");

    // Check unknown node
    for (const unk of unknownNodes) {
      assert.equal(unk.evidence.length, 0, "Unknown node evidence must be empty");
      assert.ok(unk.label.includes("?") || unk.detail.includes("?"), "Unknown node should represent an open question");
    }

    // Check changed array
    assert.deepEqual(
      result.changed.sort(),
      result.map.nodes.map(n => n.id).sort(),
      "First turn should mark all new nodes as changed"
    );
  });

  test("preserves approved and locked nodes without modification across turns", async () => {
    process.env.MINDCODE_FAKE_LLM = "1";

    const initial = fakeUpdateMap([
      { role: "user" as const, text: "I want a chat app for my study group" }
    ]);

    // Approve node n1 and lock node n2
    const n1 = initial.map.nodes.find(n => n.id === "n1")!;
    const n2 = initial.map.nodes.find(n => n.id === "n2")!;
    n1.status = "approved";
    n2.status = "locked";
    n2.label = "Custom Locked Label";

    const messages = [
      { role: "user" as const, text: "I want a chat app for my study group" },
      { role: "assistant" as const, text: initial.reply },
      { role: "user" as const, text: "Use just a nickname, no passwords" }
    ];

    const secondTurn = await update_map(messages, initial.map);

    const preservedN1 = secondTurn.map.nodes.find(n => n.id === "n1");
    const preservedN2 = secondTurn.map.nodes.find(n => n.id === "n2");

    assert.ok(preservedN1, "n1 must still exist");
    assert.equal(preservedN1?.status, "approved", "n1 must remain approved");

    assert.ok(preservedN2, "n2 must still exist");
    assert.equal(preservedN2?.status, "locked", "n2 must remain locked");
    assert.equal(preservedN2?.label, "Custom Locked Label", "n2 label must remain intact");
  });

  test("maintains stable IDs and assigns new IDs for new additions", async () => {
    process.env.MINDCODE_FAKE_LLM = "1";

    const initial = fakeUpdateMap([
      { role: "user" as const, text: "I want a chat app for my study group" }
    ]);

    const messages = [
      { role: "user" as const, text: "I want a chat app for my study group" },
      { role: "assistant" as const, text: initial.reply },
      { role: "user" as const, text: "Add markdown support" }
    ];

    const turn2 = await update_map(messages, initial.map);

    // Initial IDs n1..n5 must all be present
    for (let i = 1; i <= 5; i++) {
      assert.ok(turn2.map.nodes.some(n => n.id === `n${i}`), `Node n${i} must be preserved`);
    }

    // New node must have id n6
    const n6 = turn2.map.nodes.find(n => n.id === "n6");
    assert.ok(n6, "New node n6 must be added");
    assert.ok(turn2.changed.includes("n6"), "n6 must be in changed array");
  });

  test("handles login unknown answer by updating node in fake mode", async () => {
    process.env.MINDCODE_FAKE_LLM = "1";

    const initial = fakeUpdateMap([
      { role: "user" as const, text: "I want a chat app for my study group" }
    ]);

    const messages = [
      { role: "user" as const, text: "I want a chat app for my study group" },
      { role: "assistant" as const, text: initial.reply },
      { role: "user" as const, text: "just a nickname, no passwords" }
    ];

    const turn2 = await update_map(messages, initial.map);

    const loginNode = turn2.map.nodes.find(n => n.id === "n5");
    assert.ok(loginNode, "n5 must exist");
    assert.equal(loginNode?.label, "Nickname login");
    assert.equal(loginNode?.source, "user");
    assert.ok(turn2.changed.includes("n5"), "n5 must be in changed list");
  });

  test("fakeNodeChat rewrites login node to Nickname login for demo prompt", () => {
    const node: Node = {
      id: "n5",
      label: "How do users log in?",
      detail: "Authentication method is currently undefined.",
      kind: "constraint",
      source: "unknown",
      inventiveness: 0,
      importance: 5,
      status: "proposed",
      parent: "n1",
      evidence: [],
      turn: 1,
    };
    const res = fakeNodeChat(node, { nodes: [node], edges: [] }, [], "just a nickname, no passwords");
    assert.equal(res.label, "Nickname login");
    assert.ok(res.reply.includes("nickname"));
  });

  test("fakeBuildApp produces HTML with demo traces matching n1, n2, n3, n4, n5", () => {
    const html = fakeBuildApp({ nodes: [], edges: [] });
    assert.ok(html.includes('data-mc-el="e-title"'));
    assert.ok(html.includes('data-mc="n1 n2"'));
    assert.ok(html.includes('data-mc-el="e-login"'));
    assert.ok(html.includes('data-mc="n5"'));
    assert.ok(html.includes('data-mc-el="e-messages"'));
  });

  test("throws error when MINDCODE_FAKE_LLM is not 1 and API key is missing", async () => {
    const oldFake = process.env.MINDCODE_FAKE_LLM;
    const oldKey = process.env.OPENROUTER_API_KEY;
    delete process.env.MINDCODE_FAKE_LLM;
    delete process.env.OPENROUTER_API_KEY;

    try {
      await assert.rejects(
        async () => {
          await update_map([{ role: "user", text: "hello" }]);
        },
        /OPENROUTER_API_KEY is not set/
      );
    } finally {
      if (oldFake !== undefined) process.env.MINDCODE_FAKE_LLM = oldFake;
      if (oldKey !== undefined) process.env.OPENROUTER_API_KEY = oldKey;
    }
  });
});

describe("OpenRouter Client", () => {
  test("retries once when initial response is invalid JSON and time allows", async () => {
    const originalFetch = globalThis.fetch;
    let callCount = 0;

    globalThis.fetch = (async () => {
      callCount++;
      if (callCount === 1) {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: "Not valid JSON at all!" } }]
          })
        } as any;
      } else {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            choices: [{ message: { content: JSON.stringify({ success: true, count: 42 }) } }]
          })
        } as any;
      }
    }) as any;

    try {
      const result = await callOpenRouter<{ success: boolean; count: number }>(
        [{ role: "user", content: "test" }],
        { apiKey: "mock-key", jsonMode: true }
      );

      assert.equal(callCount, 2, "Should have retried once");
      assert.equal(result.data.success, true);
      assert.equal(result.data.count, 42);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("handles JSON wrapped in markdown fences", async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async () => {
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [{
            message: {
              content: "```json\n{\"fenced\": true}\n```"
            }
          }]
        })
      } as any;
    }) as any;

    try {
      const result = await callOpenRouter<{ fenced: boolean }>(
        [{ role: "user", content: "test" }],
        { apiKey: "mock-key", jsonMode: true }
      );

      assert.equal(result.data.fenced, true);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
