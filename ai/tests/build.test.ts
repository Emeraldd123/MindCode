import { describe, test } from "vitest";
import assert from "node:assert/strict";
import {
  build_app,
  cleanHtmlOutput,
  sanitizeTracedElements,
  preserveLockedElements,
  extractLockedElements,
  ensureTracedElementIds,
  findFullElement,
  SYSTEM_PROMPT,
} from "../build.ts";
import { fakeBuildApp } from "../fake.ts";
import type { MindMap } from "../types.ts";

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
      id: "n2",
      label: "Study group",
      detail: "Tailored for students.",
      kind: "feature",
      source: "user",
      inventiveness: 0,
      importance: 4,
      status: "proposed",
      parent: "n1",
      evidence: ["study group"],
      turn: 1
    },
    {
      id: "n3",
      label: "Message API",
      detail: "Backend endpoints.",
      kind: "api",
      source: "inferred",
      inventiveness: 0.2,
      importance: 3,
      status: "proposed",
      parent: "n1",
      evidence: [],
      turn: 1
    },
    {
      id: "n4",
      label: "Real-time updates",
      detail: "Live bidirectional push.",
      kind: "feature",
      source: "inferred",
      inventiveness: 0.85,
      importance: 4,
      status: "proposed",
      parent: "n1",
      evidence: [],
      turn: 1
    },
    {
      id: "n5",
      label: "Nickname login",
      detail: "Simple nickname entry.",
      kind: "constraint",
      source: "user",
      inventiveness: 0,
      importance: 5,
      status: "proposed",
      parent: "n1",
      evidence: ["nickname"],
      turn: 1
    }
  ],
  edges: [
    { from: "n1", to: "n2", relation: "has" },
    { from: "n1", to: "n3", relation: "needs" },
    { from: "n1", to: "n4", relation: "has" },
    { from: "n1", to: "n5", relation: "needs" }
  ]
};

describe("AI: build_app", () => {
  test("fake mode returns valid standalone HTML for demo app", async () => {
    process.env.MINDCODE_FAKE_LLM = "1";
    const html = await build_app(sampleMap, null);

    assert.ok(html.startsWith("<!doctype html>"), "Must start with <!doctype html>");
    assert.ok(html.includes("<html"), "Must contain <html> tag");
    assert.ok(html.includes("</html>"), "Must contain </html> tag");
    assert.ok(html.includes("<style>"), "Must contain <style> tag");
    assert.ok(html.includes("<script>"), "Must contain <script> tag");
  });

  test("every data-mc ID in generated HTML exists in input map nodes", async () => {
    process.env.MINDCODE_FAKE_LLM = "1";
    const html = await build_app(sampleMap, null);

    const validIds = new Set(sampleMap.nodes.map(n => n.id));
    const mcRegex = /data-mc=["']([^"']*)["']/g;
    let match;
    let matchCount = 0;

    while ((match = mcRegex.exec(html)) !== null) {
      matchCount++;
      const ids = match[1].split(/\s+/).filter(Boolean);
      assert.ok(ids.length > 0, "Traced elements should have at least one node ID");
      for (const id of ids) {
        assert.ok(validIds.has(id), `Node ID ${id} in data-mc must exist in map.nodes`);
      }
    }

    assert.ok(matchCount >= 4, `Expected multiple data-mc tagged elements, got ${matchCount}`);

    // Check data-mc-el attributes format
    const mcElRegex = /data-mc-el=["']([^"']*)["']/g;
    let elMatch;
    let elCount = 0;
    while ((elMatch = mcElRegex.exec(html)) !== null) {
      elCount++;
      assert.match(elMatch[1], /^e[-\w]+$/, `data-mc-el must match e<id>, got ${elMatch[1]}`);
    }
    assert.ok(elCount >= 4, "Expected data-mc-el attributes for traced elements");
  });

  test("invalid or hallucinated node IDs in data-mc are rejected/stripped", () => {
    const validIds = new Set(["n1", "n2"]);
    const dirtyHtml = `<div data-mc="n1 n999 hallucinated_id n2">Content</div>`;
    const cleaned = sanitizeTracedElements(dirtyHtml, validIds);

    assert.equal(cleaned, `<div data-mc="n1 n2">Content</div>`);
  });

  test("sanitizeTracedElements removes empty data-mc attributes when all IDs are invalid", () => {
    const rawHtml = `<h1 data-mc="n1 n999">Valid</h1><p data-mc="n888 n999">Invalid</p>`;
    const valid = new Set(["n1"]);
    const sanitized = sanitizeTracedElements(rawHtml, valid);
    assert.ok(sanitized.includes('data-mc="n1"'));
    assert.ok(!sanitized.includes('data-mc="n888"'));
    assert.ok(!sanitized.includes('data-mc=""'));
  });

  test("markdown code blocks are stripped from model output", () => {
    const fenced = "```html\n<!doctype html><html><body><h1>Hello</h1></body></html>\n```";
    const cleaned = cleanHtmlOutput(fenced);
    assert.equal(cleaned, "<!doctype html><html><body><h1>Hello</h1></body></html>");
  });

  test("locked node content from previousHtml is preserved", async () => {
    process.env.MINDCODE_FAKE_LLM = "1";

    const customHeader = `<header data-mc-el="e1" data-mc="n1 n2" class="custom-header"><h1>Preserved Custom Title</h1></header>`;
    const previousHtml = `<!doctype html><html><body><div class="app-container">${customHeader}</div></body></html>`;

    // Lock n1
    const lockedMap: MindMap = {
      ...sampleMap,
      nodes: sampleMap.nodes.map(n => n.id === "n1" ? { ...n, status: "locked" } : n)
    };

    const newHtml = await build_app(lockedMap, previousHtml);

    assert.ok(newHtml.includes("Preserved Custom Title"), "Locked node HTML from previousHtml must be preserved");
    assert.ok(newHtml.includes('class="custom-header"'), "Locked node attributes must be preserved");
  });

  test("nested locked elements of the same tag type are preserved completely without truncation", () => {
    const previousHtml = `<html><body><div data-mc-el="e1" data-mc="n1" class="outer-card"><div class="inner-header"><h3>Title</h3></div><div class="inner-body"><p>Content</p></div></div></body></html>`;
    const lockedIds = new Set(["n1"]);
    const extracted = extractLockedElements(previousHtml, lockedIds);
    assert.equal(
      extracted.get("n1"),
      `<div data-mc-el="e1" data-mc="n1" class="outer-card"><div class="inner-header"><h3>Title</h3></div><div class="inner-body"><p>Content</p></div></div>`
    );

    const currentHtml = `<html><body><div data-mc-el="e9" data-mc="n1" class="old-card"><p>Replaced</p></div></body></html>`;
    const preserved = preserveLockedElements(currentHtml, previousHtml, lockedIds);
    assert.ok(preserved.includes('<div class="inner-header"><h3>Title</h3></div>'));
    assert.ok(preserved.includes('<div class="inner-body"><p>Content</p></div>'));
    assert.ok(preserved.includes('class="outer-card"'));
  });

  test("ensureTracedElementIds assigns missing data-mc-el attributes and fixes duplicates", () => {
    const rawHtml = `<div data-mc="n1"><span data-mc="n2">Hello</span><p data-mc-el="e1" data-mc="n3">World</p></div>`;
    const tagged = ensureTracedElementIds(rawHtml);
    assert.ok(/<div data-mc-el="e\d+" data-mc="n1">/.test(tagged));
    assert.ok(/<span data-mc-el="e\d+" data-mc="n2">/.test(tagged));
    // Verify each element has a unique data-mc-el
    const elIds = [...tagged.matchAll(/data-mc-el=["']([^"']*)["']/g)].map(m => m[1]);
    const unique = new Set(elIds);
    assert.equal(unique.size, elIds.length, "All data-mc-el IDs must be unique");
  });

  test("findFullElement properly handles self-closing and void tags", () => {
    const html = `<input type="text" data-mc="n1" /><p>After</p>`;
    const parsed = findFullElement(html, 0);
    assert.ok(parsed);
    assert.equal(parsed.fullElement, `<input type="text" data-mc="n1" />`);
  });

  test("real mode calls OpenRouter with correct options and validates response", async () => {
    const oldFake = process.env.MINDCODE_FAKE_LLM;
    const oldKey = process.env.OPENROUTER_API_KEY;
    delete process.env.MINDCODE_FAKE_LLM;
    process.env.OPENROUTER_API_KEY = "mock-key";

    const originalFetch = globalThis.fetch;
    let passedOptions: any = null;

    globalThis.fetch = (async (_url: string, init: any) => {
      passedOptions = JSON.parse(init.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({
          choices: [
            {
              message: {
                content: "```html\n<!doctype html><html><body><h1 data-mc-el=\"e1\" data-mc=\"n1 n999\">Real App</h1></body></html>\n```"
              }
            }
          ]
        })
      };
    }) as any;

    try {
      const html = await build_app(sampleMap, null);

      assert.equal(passedOptions.max_tokens, 16000);
      assert.ok(!html.includes("```"), "Should strip markdown fences");
      assert.ok(html.includes("<!doctype html>"), "Must be valid HTML");
      assert.ok(html.includes('data-mc="n1"'), "Must preserve valid node id");
      assert.ok(!html.includes("n999"), "Must strip hallucinated n999 node id");
    } finally {
      globalThis.fetch = originalFetch;
      if (oldFake !== undefined) process.env.MINDCODE_FAKE_LLM = oldFake;
      if (oldKey !== undefined) process.env.OPENROUTER_API_KEY = oldKey;
      else delete process.env.OPENROUTER_API_KEY;
    }
  });
  test("SYSTEM_PROMPT enforces ship-ready builds with no Assumed disclaimers or placeholder names", () => {
    assert.ok(SYSTEM_PROMPT.includes('NEVER output "Assumed: ..."'), "Must forbid Assumed notes");
    assert.ok(SYSTEM_PROMPT.includes("NO placeholder names or generic bios"), "Must forbid generic placeholder names");
    assert.ok(SYSTEM_PROMPT.includes("Jordan Lee"), "Must specifically cite Jordan Lee as anti-pattern");
    assert.ok(SYSTEM_PROMPT.includes("BUILD ONLY WHAT IS ON THE MAP"), "Must include core build-only-what's-on-the-map rule");
  });

  test("SYSTEM_PROMPT enforces working navigation, tabs, and buttons without dead hrefs", () => {
    assert.ok(SYSTEM_PROMPT.includes("EVERY button, tab, link, and control MUST be functional"), "Must enforce functional controls");
    assert.ok(SYSTEM_PROMPT.includes('Never use dead href="#"'), "Must forbid dead href=# anchors");
    assert.ok(SYSTEM_PROMPT.includes("In-page navigation, tabs, or anchor links MUST actually switch views"), "Must require tab/nav switching in vanilla JS");
  });
});
