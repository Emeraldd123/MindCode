import { describe, test } from "vitest";
import assert from "node:assert/strict";
import { update_map, normalizeAndValidateMapResult } from "../extract.ts";
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

    // Initial IDs must all be preserved
    for (const node of initial.map.nodes) {
      assert.ok(turn2.map.nodes.some(n => n.id === node.id), `Node ${node.id} must be preserved`);
    }

    // New node must have the next sequential ID
    const nextId = `n${initial.map.nodes.length + 1}`;
    const newNode = turn2.map.nodes.find(n => n.id === nextId);
    assert.ok(newNode, `New node ${nextId} must be added`);
    assert.ok(turn2.changed.includes(nextId), `${nextId} must be in changed array`);
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

    const loginNode = turn2.map.nodes.find(n => /nickname login/i.test(n.label));
    assert.ok(loginNode, "Login node must exist");
    assert.equal(loginNode?.label, "Nickname login");
    assert.equal(loginNode?.source, "user");
    assert.ok(turn2.changed.includes(loginNode!.id), "Login node must be in changed list");
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

  test("validates user evidence quotes strictly against user messages", () => {
    const messages = [
      { role: "user" as const, text: "I want an offline markdown notes app with tags" },
      { role: "assistant" as const, text: "Got it! How about sync?" },
      { role: "user" as const, text: "No cloud sync please, local only" }
    ];

    const raw = {
      reply: "Notes app map",
      nodes: [
        {
          id: "n1",
          label: "Markdown notes",
          detail: "Offline notes app",
          source: "user",
          kind: "goal",
          evidence: ["markdown notes", "offline", "hallucinated quote"]
        }
      ],
      edges: []
    };

    const result = normalizeAndValidateMapResult(raw, { nodes: [], edges: [] }, 1, messages);
    const n1 = result.map.nodes.find(n => n.id === "n1")!;

    assert.equal(n1.source, "user");
    assert.deepEqual(n1.evidence, ["markdown notes", "offline"]);
    assert.equal(n1.inventiveness, 0);
  });

  test("strips hallucinated evidence from inferred and unknown nodes", () => {
    const messages = [
      { role: "user" as const, text: "I want a simple calculator" }
    ];

    const raw = {
      reply: "Calculator map",
      nodes: [
        {
          id: "n1",
          label: "Calculator",
          detail: "Simple calculator",
          source: "user",
          kind: "goal",
          evidence: ["simple calculator"]
        },
        {
          id: "n2",
          label: "Math Engine",
          detail: "Evaluates expressions",
          source: "inferred",
          kind: "api",
          inventiveness: 0.2,
          evidence: ["simple calculator", "math engine"]
        },
        {
          id: "n3",
          label: "Scientific mode?",
          detail: "Should it support sin/cos?",
          source: "unknown",
          kind: "constraint",
          evidence: ["calculator"]
        }
      ],
      edges: []
    };

    const result = normalizeAndValidateMapResult(raw, { nodes: [], edges: [] }, 1, messages);
    const n2 = result.map.nodes.find(n => n.id === "n2")!;
    const n3 = result.map.nodes.find(n => n.id === "n3")!;

    assert.equal(n2.source, "inferred");
    assert.deepEqual(n2.evidence, []);
    assert.equal(n2.inventiveness, 0.2);

    assert.equal(n3.source, "unknown");
    assert.deepEqual(n3.evidence, []);
    assert.equal(n3.inventiveness, 0);
  });

  test("demotes user node to inferred when all evidence quotes are invalid or user never spoke words", () => {
    const messages = [
      { role: "user" as const, text: "Build a todo list" }
    ];

    const raw = {
      reply: "Todo map",
      nodes: [
        {
          id: "n1",
          label: "Todo list",
          detail: "Todo list app",
          source: "user",
          kind: "goal",
          evidence: ["todo list"]
        },
        {
          id: "n2",
          label: "Export to PDF",
          detail: "Export todos as PDF document",
          source: "user",
          kind: "feature",
          evidence: ["export as PDF", "completely made up"]
        },
        {
          id: "n3",
          label: "Dark Mode",
          detail: "Dark theme support",
          source: "user",
          kind: "feature",
          evidence: []
        }
      ],
      edges: []
    };

    const result = normalizeAndValidateMapResult(raw, { nodes: [], edges: [] }, 1, messages);
    const n1 = result.map.nodes.find(n => n.id === "n1")!;
    const n2 = result.map.nodes.find(n => n.id === "n2")!;
    const n3 = result.map.nodes.find(n => n.id === "n3")!;

    assert.equal(n1.source, "user");
    assert.deepEqual(n1.evidence, ["todo list"]);

    // n2 had quotes that never appeared in user messages -> demoted
    assert.equal(n2.source, "inferred");
    assert.deepEqual(n2.evidence, []);
    assert.equal(n2.inventiveness, 0.3);

    // n3 had empty evidence -> demoted
    assert.equal(n3.source, "inferred");
    assert.deepEqual(n3.evidence, []);
    assert.equal(n3.inventiveness, 0.3);
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

describe("OpenRouter JSON extraction (#78 follow-up)", () => {
  test("keeps JSON whose string values contain code fences", async () => {
    const original = globalThis.fetch;
    process.env.OPENROUTER_API_KEY = "test";
    const payload = { reply: "Use this:\n```js\nconsole.log(1)\n```\nDone.", nodes: [] };
    globalThis.fetch = (async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) })) as any;
    try {
      const { callOpenRouter } = await import("../client.ts");
      const { data } = await callOpenRouter<any>([{ role: "user", content: "x" }]);
      assert.equal(data.reply, payload.reply);
    } finally { globalThis.fetch = original; }
  });

  test("extracts JSON after chatty preamble, and from a fenced answer", async () => {
    const original = globalThis.fetch;
    process.env.OPENROUTER_API_KEY = "test";
    const replies = ['Sure! Here it is: {"reply":"a","nodes":[]} hope that helps', '```json\n{"reply":"b","nodes":[]}\n```'];
    globalThis.fetch = (async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: replies.shift() } }] }) })) as any;
    try {
      const { callOpenRouter } = await import("../client.ts");
      assert.equal((await callOpenRouter<any>([{ role: "user", content: "x" }])).data.reply, "a");
      assert.equal((await callOpenRouter<any>([{ role: "user", content: "x" }])).data.reply, "b");
    } finally { globalThis.fetch = original; }
  });
});
