import { beforeEach, describe, expect, it } from "vitest";
import { handle, runBuild, runTurn, type Deps } from "./router";
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
    expect((await call("GET", `/sessions/${id}/builds/b1/download`)).status).toBe(409);
  });

  it("download returns raw html with attachment headers, 404 for missing build/session", async () => {
    const id = await sid();
    await call("POST", `/sessions/${id}/messages`, { text: "chat app" });
    await call("POST", `/sessions/${id}/build`);

    const res = await handle(
      new Request(`http://x/api/sessions/${id}/builds/b1/download`, { method: "GET" }),
      deps,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(res.headers.get("content-disposition")).toBe('attachment; filename="mindcode-b1.html"');
    const text = await res.text();
    expect(text).toContain('<title>Your app</title>');
    // Verify it is the raw HTML, without the injected preview script
    expect(text.includes("mc-hover")).toBe(false);

    expect((await call("GET", `/sessions/${id}/builds/missing/download`)).status).toBe(404);
    expect((await call("GET", `/sessions/nonexistent/builds/b1/download`)).status).toBe(404);
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

  it("exports mind map as mermaid flowchart", async () => {
    const id = await sid();
    await call("POST", `/sessions/${id}/messages`, { text: "chat app" });
    await call("POST", `/sessions/${id}/nodes/n3/approve`);

    const res = await handle(
      new Request(`http://x/api/sessions/${id}/map/export?format=mermaid`, { method: "GET" }),
      deps,
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("text/vnd.mermaid; charset=utf-8");

    const text = await res.text();
    expect(text).toContain("flowchart TD");
    // Check nodes and styling classes
    expect(text).toContain('n1["Your app"]:::user');
    expect(text).toContain('n2["Main page"]:::inferred');
    expect(text).toContain('n3["Backend API"]:::approved');
    expect(text).toContain('n5["Who are the users?"]:::unknown');
    // Check relation edge
    expect(text).toContain("n1 -->|has| n2");
    // Check classDef definitions
    expect(text).toContain("classDef user stroke:#d67408,stroke-width:2px;");
    expect(text).toContain("classDef inferred stroke:#17c894,stroke-dasharray: 5 5;");
    expect(text).toContain("classDef unknown stroke:#e5484d,stroke-dasharray: 2 2;");
    expect(text).toContain("classDef approved stroke:#30a46c,stroke-width:3px;");
  });

  it("exports mind map as json by default or when format=json", async () => {
    const id = await sid();
    await call("POST", `/sessions/${id}/messages`, { text: "chat app" });

    // 1. Default format (no query param)
    const resDefault = await handle(
      new Request(`http://x/api/sessions/${id}/map/export`, { method: "GET" }),
      deps,
    );
    expect(resDefault.status).toBe(200);
    expect(resDefault.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(resDefault.headers.get("content-disposition")).toBe(`attachment; filename="mindcode-map-${id}.json"`);

    const jsonDefault = await resDefault.json();
    expect(jsonDefault.id).toBe(id);
    expect(typeof jsonDefault.exportedAt).toBe("string");
    expect(isNaN(Date.parse(jsonDefault.exportedAt))).toBe(false);
    expect(jsonDefault.nodes).toHaveLength(5);
    expect(jsonDefault.edges.length).toBeGreaterThan(0);

    // 2. Explicit format=json
    const resJson = await handle(
      new Request(`http://x/api/sessions/${id}/map/export?format=json`, { method: "GET" }),
      deps,
    );
    expect(resJson.status).toBe(200);
    expect(resJson.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(resJson.headers.get("content-disposition")).toBe(`attachment; filename="mindcode-map-${id}.json"`);
    const jsonBody = await resJson.json();
    expect(jsonBody.id).toBe(id);
    expect(jsonBody.nodes).toEqual(jsonDefault.nodes);
    expect(jsonBody.edges).toEqual(jsonDefault.edges);
  });

  it("export returns 404 for nonexistent session and 422 for unsupported format", async () => {
    const id = await sid();
    expect((await call("GET", "/sessions/nonexistent/map/export")).status).toBe(404);
    expect((await call("GET", `/sessions/${id}/map/export?format=xml`)).status).toBe(422);
  });

  it("restore checkpoint rolls back map, records new checkpoint, or returns 404", async () => {
    const id = await sid();
    // 1. Initial message creates checkpoint c1 with initial 5 nodes
    await call("POST", `/sessions/${id}/messages`, { text: "chat app" });
    const s1 = (await call("GET", `/sessions/${id}`)).body;
    expect(s1.checkpoints).toHaveLength(1);
    const cp1 = s1.checkpoints[0];
    const initialNodeCount = s1.map.nodes.length;

    // 2. Add more nodes and change labels
    ai.updateMap = async (_m, cur) => ({
      reply: "ok",
      map: {
        nodes: [
          ...cur.nodes.map((n) => ({ ...n, label: `${n.label} modified` })),
          { id: "n99", label: "Brand new feature", parent: "n1" },
          { id: "n100", label: "Another feature", parent: "n1" },
        ],
        edges: cur.edges,
      },
    });
    await call("POST", `/sessions/${id}/messages`, { text: "add more stuff" });
    const s2 = (await call("GET", `/sessions/${id}`)).body;
    expect(s2.checkpoints).toHaveLength(2);
    expect(s2.map.nodes.length).toBeGreaterThan(initialNodeCount);
    expect(byId(s2.map.nodes).n1.label).toContain("modified");

    // 3. Restore checkpoint c1
    const res = await call("POST", `/sessions/${id}/checkpoints/${cp1.id}/restore`);
    expect(res.status).toBe(200);
    const restoredSession = res.body;

    // Verify map is restored to checkpoint c1 map
    expect(restoredSession.map).toEqual(cp1.map);
    expect(restoredSession.map.nodes.length).toBe(initialNodeCount);
    expect(byId(restoredSession.map.nodes).n1.label).not.toContain("modified");

    // Verify a new "Restored to ..." checkpoint is added
    expect(restoredSession.checkpoints).toHaveLength(3);
    const latestCp = restoredSession.checkpoints.at(-1);
    expect(latestCp.label).toBe(`Restored to ${cp1.label}`);
    expect(latestCp.map).toEqual(cp1.map);

    // Verify persistence via GET /sessions/:sid
    const s3 = (await call("GET", `/sessions/${id}`)).body;
    expect(s3.map).toEqual(cp1.map);
    expect(s3.checkpoints).toHaveLength(3);

    // 4. Test 404 for nonexistent checkpoint or session
    expect((await call("POST", `/sessions/${id}/checkpoints/nonexistent/restore`)).status).toBe(404);
    expect((await call("POST", `/sessions/${id}/checkpoints/nonexistent/restore`)).body).toEqual({
      detail: "checkpoint not found",
    });
    expect((await call("POST", `/sessions/nonexistent/checkpoints/${cp1.id}/restore`)).status).toBe(404);
    expect((await call("POST", `/sessions/nonexistent/checkpoints/${cp1.id}/restore`)).body).toEqual({
      detail: "session not found",
    });
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

describe("facets (Ben's prompt-engineering map)", () => {
  it("keeps a valid facet, drops an invalid one, and keeps the old facet when the AI omits it", async () => {
    const id = await sid();
    ai.updateMap = async () => ({
      reply: "ok",
      map: { nodes: [
        { id: "n1", label: "App", kind: "goal", source: "user", facet: "goal", parent: null, evidence: ["app"] },
        { id: "n2", label: "Who is it for?", kind: "constraint", source: "unknown", facet: "audience", parent: "n1" },
        { id: "n3", label: "Bogus", source: "inferred", facet: "vibes" as never, parent: "n1" },
      ] },
    });
    let m = (await call("POST", `/sessions/${id}/messages`, { text: "app" })).body.map;
    let n = byId(m.nodes);
    expect([n.n1.facet, n.n2.facet, n.n3.facet]).toEqual(["goal", "audience", undefined]);
    ai.updateMap = async () => ({ reply: "ok", map: { nodes: [{ id: "n2", label: "Students" }] } });
    m = (await call("POST", `/sessions/${id}/messages`, { text: "students" })).body.map;
    expect(byId(m.nodes).n2.facet).toBe("audience");
  });
});

describe("async chat turns (background function)", () => {
  it("returns 202 while the turn is pending, blocks a second message, then GET shows the result", async () => {
    const id = await sid();
    let started = "";
    deps.startTurn = async (s) => { started = s; };
    const r = await call("POST", `/sessions/${id}/messages`, { text: "chat app" });
    expect([r.status, r.body.pending, r.body.turn.status]).toEqual([202, true, "pending"]);
    expect(started).toBe(id);
    expect((await call("POST", `/sessions/${id}/messages`, { text: "again" })).status).toBe(409);
    // the background function runs the turn
    await runTurn({ storage: deps.storage, ai }, id);
    const s = (await call("GET", `/sessions/${id}`)).body;
    expect(s.turn.status).toBe("done");
    expect(s.turn.changed.length).toBe(5);
    expect(s.messages.map((m: { role: string }) => m.role)).toEqual(["user", "assistant"]);
  });

  it("a failed turn removes the user's message and reports the error", async () => {
    const id = await sid();
    deps.startTurn = async () => {};
    await call("POST", `/sessions/${id}/messages`, { text: "hi" });
    ai.updateMap = async () => { throw new Error("timeout"); };
    await runTurn({ storage: deps.storage, ai }, id);
    const s = (await call("GET", `/sessions/${id}`)).body;
    expect(s.turn.status).toBe("error");
    expect(s.turn.error).toContain("timeout");
    expect(s.messages).toHaveLength(0);
  });
});

describe("bubble chat vs. locking mid-reply", () => {
  it("a lock made while Claude is replying is kept, and the locked bubble's text is not rewritten", async () => {
    const id = await sid();
    await call("POST", `/sessions/${id}/messages`, { text: "chat app" });
    ai.nodeChat = async () => {
      // the user locks the bubble while Claude is still thinking
      await call("PATCH", `/sessions/${id}/nodes/n2`, { status: "locked" });
      return { reply: "ok", label: "REWRITTEN", detail: "REWRITTEN" };
    };
    const r = (await call("POST", `/sessions/${id}/nodes/n2/chat`, { text: "rename it" })).body;
    expect([r.node.status, r.node.label]).toEqual(["locked", "Main page"]);
    const n2 = byId((await call("GET", `/sessions/${id}`)).body.map.nodes).n2;
    expect([n2.status, n2.label]).toEqual(["locked", "Main page"]);
    expect(r.history).toHaveLength(2);
  });
});
