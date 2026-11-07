import { beforeEach, describe, expect, it } from "vitest";
import { handle, runBuild, type Deps } from "./router";
import { memoryStorage } from "./storage";
import { traceOf } from "./store";
import { stubAI } from "./stubs";
import type { AI, MapNode } from "./types";

let deps: Deps;
let ai: AI;

beforeEach(() => {
  ai = { ...stubAI };
  const storage = memoryStorage();
  let i = 0;
  deps = {
    storage,
    get ai() { return ai; },
    startBuild: (sid, bid) => runBuild({ storage, ai }, sid, bid),
    newId: () => `s${++i}`,
  };
});

async function call(method: string, path: string, body?: unknown) {
  const res = await handle(
    new Request(`http://x/api${path}`, { method, body: body === undefined ? undefined : JSON.stringify(body) }),
    deps,
  );
  const type = res.headers.get("content-type") ?? "";
  return { status: res.status, body: type.includes("json") ? await res.json() : await res.text() };
}

const sid = async () => (await call("POST", "/sessions")).body.id as string;
const byId = (nodes: MapNode[]) => Object.fromEntries(nodes.map((n) => [n.id, n]));

describe("api", () => {
  it("health and session shape", async () => {
    expect((await call("GET", "/health")).body).toEqual({ ok: true });
    const s = (await call("POST", "/sessions")).body;
    expect(Object.keys(s).sort()).toEqual(["builds", "checkpoints", "id", "map", "messages"]);
    expect((await call("GET", `/sessions/${s.id}`)).body.id).toBe(s.id);
    expect((await call("GET", "/sessions/nope")).status).toBe(404);
  });

  it("message builds a map with all three sources and a checkpoint", async () => {
    const id = await sid();
    const r = (await call("POST", `/sessions/${id}/messages`, { text: "I want a chat app" })).body;
    expect(new Set(r.map.nodes.map((n: MapNode) => n.source))).toEqual(new Set(["user", "inferred", "unknown"]));
    expect(r.changed).toHaveLength(5);
    const s = (await call("GET", `/sessions/${id}`)).body;
    expect(s.messages.map((m: { role: string }) => m.role)).toEqual(["user", "assistant"]);
    expect(s.checkpoints).toHaveLength(1);
  });

  it("rejects empty text", async () => {
    expect((await call("POST", `/sessions/${await sid()}/messages`, { text: "  " })).status).toBe(422);
  });

  it("approved/locked nodes and sources survive AI rewrites", async () => {
    const id = await sid();
    await call("POST", `/sessions/${id}/messages`, { text: "chat app" });
    await call("POST", `/sessions/${id}/nodes/n3/approve`);
    await call("PATCH", `/sessions/${id}/nodes/n4`, { status: "locked" });
    ai.updateMap = async (_m, cur) => ({
      reply: "ok",
      map: { nodes: cur.nodes.map((n) => ({ ...n, label: "CHANGED", source: "user", status: "approved" })), edges: cur.edges },
    });
    const r = (await call("POST", `/sessions/${id}/messages`, { text: "change everything" })).body;
    const n = byId(r.map.nodes);
    expect([n.n3.label, n.n3.status]).toEqual(["Backend API", "approved"]);
    expect([n.n4.label, n.n4.status]).toEqual(["Visual style", "locked"]);
    expect([n.n2.label, n.n2.source, n.n2.status]).toEqual(["CHANGED", "inferred", "proposed"]);
    expect(new Set(r.changed)).toEqual(new Set(["n1", "n2", "n5"]));
  });

  it("AI cannot drop nodes, reuse ids or add dangling edges", async () => {
    const id = await sid();
    await call("POST", `/sessions/${id}/messages`, { text: "chat app" });
    ai.updateMap = async () => ({
      reply: "ok",
      map: {
        nodes: [{ id: "x", label: "A", parent: "n1" }, { id: "x", label: "B", parent: "x" }],
        edges: [{ from: "n1", to: "x" }, { from: "x", to: "ghost" }],
      },
    });
    const m = (await call("POST", `/sessions/${id}/messages`, { text: "more" })).body.map;
    const ids = m.nodes.map((n: MapNode) => n.id);
    expect(new Set(ids).size).toBe(7);
    expect(m.edges.some((e: { to: string }) => e.to === "ghost")).toBe(false);
  });

  it("node chat, approve, 404s, bad status", async () => {
    const id = await sid();
    await call("POST", `/sessions/${id}/messages`, { text: "chat app" });
    const r = (await call("POST", `/sessions/${id}/nodes/n5/chat`, { text: "my study group" })).body;
    expect(r.node.detail).toBe("my study group");
    expect(r.history).toHaveLength(2);
    expect((await call("POST", `/sessions/${id}/nodes/n5/approve`)).body.status).toBe("approved");
    const s = (await call("GET", `/sessions/${id}`)).body;
    expect(byId(s.map.nodes).n5.status).toBe("approved");
    expect((await call("POST", `/sessions/${id}/nodes/n99/approve`)).status).toBe(404);
    expect((await call("PATCH", `/sessions/${id}/nodes/n1`, { status: "bogus" })).status).toBe(422);
  });

  it("build: trace, preview with injected script, checkpoint, poll", async () => {
    const id = await sid();
    expect((await call("POST", `/sessions/${id}/build`)).status).toBe(422);
    await call("POST", `/sessions/${id}/messages`, { text: "chat app" });
    const b = (await call("POST", `/sessions/${id}/build`)).body;
    expect([b.id, b.status]).toEqual(["b1", "done"]);
    expect(b.trace.n1).toEqual(["e1", "e2"]);
    expect((await call("GET", `/sessions/${id}/builds/b1`)).body.status).toBe("done");
    const html = (await call("GET", `/sessions/${id}/builds/b1/preview`)).body as string;
    expect(html.indexOf("mc-hover")).toBeGreaterThan(-1);
    expect(html.indexOf("mc-hover")).toBeLessThan(html.toLowerCase().indexOf("</body>"));
    const cps = (await call("GET", `/sessions/${id}/checkpoints`)).body;
    expect(cps.at(-1).build_id).toBe("b1");
    expect(cps.at(-1).id).toBe(b.checkpoint_id);
    expect((await call("GET", `/sessions/${id}/builds/b9/preview`)).status).toBe(404);
  });

  it("pending build returns 202 and blocks a second build", async () => {
    const id = await sid();
    await call("POST", `/sessions/${id}/messages`, { text: "chat app" });
    deps.startBuild = async () => {};
    const r = await call("POST", `/sessions/${id}/build`);
    expect([r.status, r.body.status]).toEqual([202, "pending"]);
    expect((await call("POST", `/sessions/${id}/build`)).status).toBe(409);
    expect((await call("GET", `/sessions/${id}/builds/b1/preview`)).status).toBe(409);
  });

  it("failed build is recorded as error", async () => {
    const id = await sid();
    await call("POST", `/sessions/${id}/messages`, { text: "chat app" });
    ai.buildApp = async () => { throw new Error("model timeout"); };
    const b = (await call("POST", `/sessions/${id}/build`)).body;
    expect([b.status, b.error]).toEqual(["error", "model timeout"]);
  });

  it("AI failure on a message is 502", async () => {
    ai.updateMap = async () => { throw new Error("bad json"); };
    expect((await call("POST", `/sessions/${await sid()}/messages`, { text: "hi" })).status).toBe(502);
  });

  it("trace ignores unknown nodes and untagged elements, any attribute order/quotes", () => {
    const html = `<p data-mc="n1 zz" data-mc-el="a">x</p><p data-mc-el="b">y</p><div data-mc-el='c' data-mc='n2'></div>`;
    expect(traceOf(html, new Set(["n1", "n2"]))).toEqual({ n1: ["a"], n2: ["c"] });
  });
});

describe("answered questions", () => {
  it("unknown -> user only with a quote; other source changes are ignored", async () => {
    const id = await sid();
    await call("POST", `/sessions/${id}/messages`, { text: "chat app" });
    ai.updateMap = async () => ({
      reply: "ok",
      map: { nodes: [
        { id: "n5", label: "Nicknames only", source: "user", evidence: ["just nicknames"] },
        { id: "n2", label: "Main page", source: "user", evidence: ["x"] },
        { id: "n4", label: "Visual style", source: "user", evidence: [] },
      ] },
    });
    const r = (await call("POST", `/sessions/${id}/messages`, { text: "just nicknames" })).body;
    const n = byId(r.map.nodes);
    expect([n.n5.source, n.n5.label]).toEqual(["user", "Nicknames only"]);
    expect(n.n2.source).toBe("inferred");
    expect(n.n4.source).toBe("inferred");
    expect(r.changed).toContain("n5");
  });
});

describe("demo session", () => {
  it("POST /sessions/demo returns an independent copy with a finished, traced build", async () => {
    const a = (await call("POST", "/sessions/demo")).body;
    const b = (await call("POST", "/sessions/demo")).body;
    expect(a.id).not.toBe(b.id);
    expect(a.map.nodes.length).toBeGreaterThanOrEqual(5);
    expect(new Set(a.map.nodes.map((n: MapNode) => n.source))).toEqual(new Set(["user", "inferred", "unknown"]));
    expect(a.map.nodes.some((n: MapNode) => n.status === "approved")).toBe(true);
    expect(a.builds[0].status).toBe("done");
    expect(Object.keys(a.builds[0].trace).length).toBeGreaterThan(0);
    expect(a.checkpoints.some((c: { build_id?: string }) => c.build_id === a.builds[0].id)).toBe(true);
    // independent: approving in one copy doesn't touch the other
    const nid = a.map.nodes.find((n: MapNode) => n.status === "proposed").id;
    await call("POST", `/sessions/${a.id}/nodes/${nid}/approve`);
    const b2 = (await call("GET", `/sessions/${b.id}`)).body;
    expect(byId(b2.map.nodes)[nid].status).toBe("proposed");
    // the copy keeps working: preview renders with the trace script
    const html = (await call("GET", `/sessions/${a.id}/builds/${a.builds[0].id}/preview`)).body as string;
    expect(html).toContain("mc-hover");
  });
});
