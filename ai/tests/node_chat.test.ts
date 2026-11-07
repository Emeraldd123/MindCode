import { describe, test } from "vitest";
import assert from "node:assert/strict";
import { node_chat } from "../node_chat.ts";
import { fakeNodeChat } from "../fake.ts";
import type { Node, MindMap } from "../types.ts";

const sampleMap: MindMap = {
  nodes: [
    {
      id: "n1",
      label: "Chat app",
      detail: "A real-time messaging application.",
      kind: "goal",
      source: "user",
      inventiveness: 0,
      importance: 5,
      status: "proposed",
      parent: null,
      evidence: ["chat app"],
      turn: 1
    },
    {
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
      turn: 1
    }
  ],
  edges: [
    { from: "n1", to: "n5", relation: "needs" }
  ]
};

describe("AI: node_chat", () => {
  test("fake mode returns conversational reply and brainstorms without label change", async () => {
    process.env.MINDCODE_FAKE_LLM = "1";
    const node = sampleMap.nodes[0];
    const res = await node_chat(node, sampleMap, [], "How should we handle scaling?");

    assert.ok(res.reply.length > 0, "Must return a reply");
    assert.ok(res.reply.includes("Chat app"), "Reply should reference the node");
    assert.equal(res.label, undefined, "Label should not be changed for generic question");
    assert.equal(res.detail, undefined, "Detail should not be changed for generic question");
    assert.ok(Array.isArray(res.suggest), "Suggest should be an array");
    assert.ok(res.suggest.length >= 1 && res.suggest.length <= 4, "Should return 1-4 suggestions");
  });

  test("fake mode updates label and detail when user suggests nickname login", async () => {
    process.env.MINDCODE_FAKE_LLM = "1";
    const loginNode = sampleMap.nodes.find(n => n.id === "n5")!;
    const res = await node_chat(
      loginNode,
      sampleMap,
      [],
      "just a nickname, no passwords"
    );

    assert.ok(res.reply.length > 0, "Must return reply");
    assert.equal(res.label, "Nickname login", "Should update label to Nickname login");
    assert.ok(res.detail?.includes("nickname"), "Should update detail with nickname explanation");
    assert.ok(Array.isArray(res.suggest) && res.suggest.length > 0, "Should include suggestions");
  });

  test("fake mode updates label when user asks to rename", async () => {
    process.env.MINDCODE_FAKE_LLM = "1";
    const node = sampleMap.nodes[0];
    const res = await node_chat(
      node,
      sampleMap,
      [],
      "rename to Study Lounge"
    );

    assert.equal(res.label, "Study Lounge");
    assert.ok(res.detail?.includes("Study Lounge"));
  });

  test("does not update label, detail, or return suggestions if node is locked", async () => {
    process.env.MINDCODE_FAKE_LLM = "1";
    const lockedNode: Node = {
      ...sampleMap.nodes[0],
      status: "locked"
    };

    const res = await node_chat(
      lockedNode,
      sampleMap,
      [],
      "rename to Study Lounge"
    );

    assert.equal(res.label, undefined, "Locked node label must not be updated");
    assert.equal(res.detail, undefined, "Locked node detail must not be updated");
    assert.equal(res.suggest, undefined, "Locked node must not have suggestions");
    assert.ok(res.reply.includes("locked"), "Reply should mention locked status");
  });

  test("throws error when MINDCODE_FAKE_LLM is not 1 and OPENROUTER_API_KEY is missing", async () => {
    const oldFake = process.env.MINDCODE_FAKE_LLM;
    const oldKey = process.env.OPENROUTER_API_KEY;
    delete process.env.MINDCODE_FAKE_LLM;
    delete process.env.OPENROUTER_API_KEY;

    try {
      await assert.rejects(
        async () => {
          await node_chat(sampleMap.nodes[0], sampleMap, [], "hello");
        },
        /OPENROUTER_API_KEY is not set/
      );
    } finally {
      if (oldFake !== undefined) process.env.MINDCODE_FAKE_LLM = oldFake;
      if (oldKey !== undefined) process.env.OPENROUTER_API_KEY = oldKey;
    }
  });

  test("real mode parses LLM reply and enforces locked status even if LLM returns a label and suggestions", async () => {
    const oldFake = process.env.MINDCODE_FAKE_LLM;
    const oldKey = process.env.OPENROUTER_API_KEY;
    delete process.env.MINDCODE_FAKE_LLM;
    process.env.OPENROUTER_API_KEY = "mock-key";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: "I changed it anyway!",
                label: "Hacked Label",
                detail: "Hacked Detail",
                suggest: [
                  { label: "Hacked Suggestion", detail: "Should be dropped" }
                ]
              })
            }
          }
        ]
      })
    })) as any;

    try {
      const lockedNode: Node = {
        ...sampleMap.nodes[0],
        status: "locked"
      };

      const res = await node_chat(lockedNode, sampleMap, [], "change it");
      assert.equal(res.label, undefined, "Locked node label must be stripped");
      assert.equal(res.detail, undefined, "Locked node detail must be stripped");
      assert.equal(res.suggest, undefined, "Locked node suggestions must be stripped");
      assert.equal(res.reply, "I changed it anyway!");
    } finally {
      globalThis.fetch = originalFetch;
      if (oldFake !== undefined) process.env.MINDCODE_FAKE_LLM = oldFake;
      if (oldKey !== undefined) process.env.OPENROUTER_API_KEY = oldKey;
      else delete process.env.OPENROUTER_API_KEY;
    }
  });

  test("real mode parses, deduplicates, drops existing map labels, drops invalid entries, and caps suggestions at 4", async () => {
    const oldFake = process.env.MINDCODE_FAKE_LLM;
    const oldKey = process.env.OPENROUTER_API_KEY;
    delete process.env.MINDCODE_FAKE_LLM;
    process.env.OPENROUTER_API_KEY = "mock-key";

    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                reply: "Here are some ideas for your chat app.",
                suggest: [
                  // 1. Should be dropped because "chat app" exists in sampleMap.nodes
                  { label: "chat app", detail: "Already in map" },
                  // 2. Should be dropped because label is empty
                  { label: "", detail: "Empty label" },
                  // 3. Should be dropped because detail is empty
                  { label: "Valid Label 0", detail: "   " },
                  // 4. Valid suggestion 1
                  { label: "Typing indicator", detail: "Shows live typing status", kind: "feature" },
                  // 5. Duplicate of 4 (case-insensitive) - should be dropped
                  { label: "TYPING INDICATOR", detail: "Duplicate typing indicator" },
                  // 6. Valid suggestion 2
                  { label: "Read receipts", detail: "Shows message delivery and read status" },
                  // 7. Valid suggestion 3
                  { label: "Emoji reactions", detail: "React with emojis to messages", kind: "feature" },
                  // 8. Valid suggestion 4
                  { label: "Audio notes", detail: "Send voice messages to group", kind: "feature" },
                  // 9. Extra suggestion - should be dropped by cap (max 4)
                  { label: "Video calls", detail: "Live group video calling", kind: "feature" }
                ]
              })
            }
          }
        ]
      })
    })) as any;

    try {
      const res = await node_chat(sampleMap.nodes[0], sampleMap, [], "What features can we add?");
      assert.ok(res.suggest !== undefined, "Should have suggestions");
      assert.equal(res.suggest?.length, 4, "Must cap at 4 suggestions");
      assert.deepEqual(res.suggest, [
        { label: "Typing indicator", detail: "Shows live typing status", kind: "feature" },
        { label: "Read receipts", detail: "Shows message delivery and read status" },
        { label: "Emoji reactions", detail: "React with emojis to messages", kind: "feature" },
        { label: "Audio notes", detail: "Send voice messages to group", kind: "feature" }
      ]);
    } finally {
      globalThis.fetch = originalFetch;
      if (oldFake !== undefined) process.env.MINDCODE_FAKE_LLM = oldFake;
      if (oldKey !== undefined) process.env.OPENROUTER_API_KEY = oldKey;
      else delete process.env.OPENROUTER_API_KEY;
    }
  });
});
