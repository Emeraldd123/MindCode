import { afterEach, describe, expect, it } from "vitest";
import { generateHtml } from "../longform.ts";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function mockReplies(parts: string[]) {
  const bodies: any[] = [];
  globalThis.fetch = (async (_u: string, init: any) => {
    bodies.push(JSON.parse(init.body));
    const content = parts.shift() ?? "";
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content } }] }) };
  }) as any;
  return bodies;
}

describe("generateHtml (continues past the token cap)", () => {
  it("stitches a cut-off answer with its continuation", async () => {
    process.env.OPENROUTER_API_KEY = "test";
    const bodies = mockReplies(["```html\n<!doctype html><html><body><h1>Hi", "</h1></body></html>"]);
    const html = await generateHtml([{ role: "user", content: "build" }]);
    expect(html).toBe("<!doctype html><html><body><h1>Hi</h1></body></html>");
    expect(bodies).toHaveLength(2);
    const second = bodies[1].messages;
    expect(second.at(-2)).toMatchObject({ role: "assistant" });
    expect(second.at(-1).content).toContain("Continue EXACTLY where it stopped");
  });

  it("returns after one call when the first answer is complete", async () => {
    process.env.OPENROUTER_API_KEY = "test";
    const bodies = mockReplies(["<!doctype html><html></html>"]);
    expect(await generateHtml([{ role: "user", content: "x" }])).toBe("<!doctype html><html></html>");
    expect(bodies).toHaveLength(1);
  });

  it("gives up with a clear error after 3 cut-off parts", async () => {
    process.env.OPENROUTER_API_KEY = "test";
    mockReplies(["<html><body>a", "b", "c"]);
    await expect(generateHtml([{ role: "user", content: "x" }])).rejects.toThrow(/after 3 parts/);
  });
});
