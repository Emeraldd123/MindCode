import { afterEach, describe, expect, it } from "vitest";
import { callOpenRouter, friendlyOpenRouterError } from "../client.ts";

const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

const body402 = JSON.stringify({ error: { message: "This request requires more credits, or fewer max_tokens. You requested up to 10000 tokens, but can only afford 5033. To increase, visit https://openrouter.ai/workspaces/x/keys/abc", code: 402 } });

describe("friendly OpenRouter errors", () => {
  it("402 becomes a short out-of-credit message without urls or ids", () => {
    const m = friendlyOpenRouterError(402, body402);
    expect(m).toContain("Out of AI credit");
    expect(m).toContain("5033");
    expect(m).not.toContain("workspaces/x/keys");
    expect(m.length).toBeLessThan(260);
  });

  it("402 is not retried", async () => {
    process.env.OPENROUTER_API_KEY = "test";
    let calls = 0;
    globalThis.fetch = (async () => { calls++; return { ok: false, status: 402, text: async () => body402 }; }) as any;
    await expect(callOpenRouter([{ role: "user", content: "x" }])).rejects.toThrow(/Out of AI credit/);
    expect(calls).toBe(1);
  });

  it("other statuses get short messages", () => {
    expect(friendlyOpenRouterError(429, "{}")).toMatch(/rate-limited/);
    expect(friendlyOpenRouterError(401, "{}")).toMatch(/rejected/);
    expect(friendlyOpenRouterError(503, "{}")).toMatch(/having trouble/);
  });
});
