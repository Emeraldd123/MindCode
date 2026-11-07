import { afterEach, describe, expect, it } from "vitest";
import { applyPatches, edit_app, parsePatches } from "../edit.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const HTML = `<!doctype html><html><body>
<h1 data-mc-el="e1" data-mc="n1">Study Crew</h1>
<button data-mc-el="e2" data-mc="n2">Join</button>
</body></html>`;

function mockReplies(parts: string[]) {
  const bodies: any[] = [];
  globalThis.fetch = (async (_u: string, init: any) => {
    bodies.push(JSON.parse(init.body));
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: parts.shift() ?? "" } }] }) };
  }) as any;
  return bodies;
}

const map = { nodes: [{ id: "n1", label: "Goal", detail: "" }, { id: "n2", label: "Join", detail: "" }], edges: [] } as any;

describe("patch-based edits", () => {
  it("parses and applies FIND/REPLACE blocks", () => {
    const patches = parsePatches(`<<<<<<< FIND\n>Study Crew</h1>\n=======\n>Study Buddies</h1>\n>>>>>>> REPLACE`);
    expect(patches).toEqual([{ find: ">Study Crew</h1>", replace: ">Study Buddies</h1>" }]);
    expect(applyPatches(HTML, patches)).toContain("Study Buddies");
  });

  it("refuses missing or ambiguous FIND snippets", () => {
    expect(applyPatches(HTML, [{ find: "not there", replace: "x" }])).toBeNull();
    expect(applyPatches(HTML, [{ find: "data-mc-el", replace: "x" }])).toBeNull(); // appears twice
    expect(applyPatches(HTML, [])).toBeNull();
  });

  it("uses the fast patch path with a single small call", async () => {
    process.env.OPENROUTER_API_KEY = "test";
    delete process.env.MINDCODE_FAKE_LLM;
    const bodies = mockReplies([`<<<<<<< FIND\n>Join</button>\n=======\n>Join the group</button>\n>>>>>>> REPLACE`]);
    const out = await edit_app(HTML, map, { base: "b1", instruction: "say join the group" });
    expect(out).toContain("Join the group</button>");
    expect(bodies).toHaveLength(1);
    expect(bodies[0].max_tokens).toBe(8000);
  });

  it("falls back to a full rewrite when a patch doesn't apply", async () => {
    process.env.OPENROUTER_API_KEY = "test";
    delete process.env.MINDCODE_FAKE_LLM;
    const bodies = mockReplies([
      `<<<<<<< FIND\nnot in the html\n=======\nx\n>>>>>>> REPLACE`,
      `<!doctype html><html><body><h1 data-mc-el="e1" data-mc="n1">Rewritten</h1></body></html>`,
    ]);
    const out = await edit_app(HTML, map, { base: "b1", instruction: "rewrite" });
    expect(out).toContain("Rewritten");
    expect(bodies).toHaveLength(2);
  });
});
