// All /api routes from docs/api-contract.md. Pure Request -> Response so tests can call it directly.
import { addCheckpoint, BIG_CHANGE, findNode, mergeMap, newSession, publicSession, traceOf, userTurn } from "./store";
import type { Storage } from "./storage";
import { auditTrace, inject } from "./trace";
import type { AI, Session } from "./types";
import demoSession from "./demo/study-group.json";

export interface Deps {
  storage: Storage;
  ai: AI;
  /** Start generating build `bid`. Netlify: trigger the background function. Tests / fake mode: run inline. */
  startBuild(sid: string, bid: string): Promise<void>;
  /** Start processing the pending chat turn. Netlify: background function. Omitted (tests / fake mode): run inline. */
  startTurn?(sid: string): Promise<void>;
  newId?: () => string;
}

class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

const json = (data: unknown, status = 200) => Response.json(data, { status });

async function readText(req: Request): Promise<string> {
  let body: { text?: unknown };
  try { body = await req.json(); } catch { throw new HttpError(422, "body must be JSON"); }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) throw new HttpError(422, "text is empty");
  return text;
}

async function callAI<T>(p: () => Promise<T>): Promise<T> {
  try { return await p(); } catch (e) {
    console.error("AI call failed", e);
    throw new HttpError(502, `AI call failed: ${(e as Error).message}`);
  }
}

/**
 * Process the pending chat turn: ask the AI to update the map, merge, and save.
 * Used by the turn background function and inline in tests and fake mode.
 * On failure the user's message is removed again, so a retry starts clean.
 */
export async function runTurn(deps: Pick<Deps, "storage" | "ai">, sid: string): Promise<void> {
  const s = await deps.storage.get(sid);
  if (!s || s.turn?.status !== "pending") return;
  let out: Awaited<ReturnType<AI["updateMap"]>>;
  try {
    out = await deps.ai.updateMap(s.messages, s.map);
  } catch (e) {
    console.error("AI call failed", e);
    const latest = (await deps.storage.get(sid)) ?? s;
    const last = latest.messages.at(-1);
    if (last?.role === "user") latest.messages = latest.messages.slice(0, -1);
    latest.turn = { status: "error", error: `AI call failed: ${(e as Error).message}`, changed: [], started_at: s.turn.started_at };
    await deps.storage.put(latest);
    return;
  }
  // Re-read so approvals/locks made while Claude was thinking are kept (mergeMap protects them).
  const latest = (await deps.storage.get(sid)) ?? s;
  latest.messages = [...latest.messages, { role: "assistant", text: out.reply ?? "" }];
  const changed = mergeMap(latest, out.map ?? {}, userTurn(latest));
  if (changed.length >= BIG_CHANGE) addCheckpoint(latest, `Turn ${userTurn(latest)}: ${changed.length} bubbles changed`);
  latest.turn = { status: "done", changed, started_at: s.turn.started_at };
  await deps.storage.put(latest);
}

/** Run a build to completion and save it. Used by the background function and by fake mode. */
export async function runBuild(deps: Pick<Deps, "storage" | "ai">, sid: string, bid: string): Promise<void> {
  const s = await deps.storage.get(sid);
  const b = s?.builds.find((x) => x.id === bid);
  if (!s || !b) return;
  const cp = s.checkpoints.find((c) => c.id === b.checkpoint_id)!;
  const prev = [...s.builds].reverse().find((x) => x.status === "done" && x.id !== bid)?.html ?? null;
  let patch: Partial<typeof b>;
  try {
    const html = await deps.ai.buildApp(cp.map, prev);
    patch = {
      status: "done",
      html,
      trace: traceOf(html, new Set(cp.map.nodes.map((n) => n.id))),
      audit: auditTrace(html, cp.map),
    };
  } catch (e) {
    console.error("build failed", e);
    patch = { status: "error", error: (e as Error).message };
  }
  // Re-read so we don't clobber chat that happened while the build ran.
  const latest = (await deps.storage.get(sid)) ?? s;
  const target = latest.builds.find((x) => x.id === bid);
  if (target) Object.assign(target, patch);
  await deps.storage.put(latest);
}

export async function handle(req: Request, deps: Deps): Promise<Response> {
  try {
    return await route(req, deps);
  } catch (e) {
    if (e instanceof HttpError) return json({ detail: e.message }, e.status);
    console.error(e);
    return json({ detail: "internal error" }, 500);
  }
}

async function route(req: Request, deps: Deps): Promise<Response> {
  const path = new URL(req.url).pathname.replace(/^\/api/, "").replace(/\/+$/, "") || "/";
  const parts = path.split("/").filter(Boolean);
  const m = req.method;
  const { storage, ai } = deps;

  if (m === "GET" && path === "/health") return json({ ok: true });

  if (m === "POST" && path === "/sessions") {
    const s = newSession((deps.newId ?? (() => crypto.randomUUID().slice(0, 12)))());
    await storage.put(s);
    return json(publicSession(s));
  }

  // A fresh copy of a recorded real-Opus session (map, approvals, working build, checkpoints),
  // so a live demo never waits on a build or a model call. See docs/demo.md.
  if (m === "POST" && path === "/sessions/demo") {
    const s: Session = {
      ...structuredClone(demoSession as Omit<Session, "id" | "node_chats">),
      id: (deps.newId ?? (() => crypto.randomUUID().slice(0, 12)))(),
      node_chats: {},
    };
    await storage.put(s);
    return json(publicSession(s));
  }

  if (parts[0] !== "sessions" || !parts[1]) throw new HttpError(404, "not found");
  const s = await storage.get(parts[1]);
  if (!s) throw new HttpError(404, "session not found");
  const rest = parts.slice(2);
  const save = () => storage.put(s);

  if (m === "GET" && rest.length === 0) return json(publicSession(s));

  if (m === "POST" && rest.length === 1 && rest[0] === "messages") {
    const text = await readText(req);
    if (s.turn?.status === "pending") throw new HttpError(409, "Claude is still working on the previous message");
    s.messages = [...s.messages, { role: "user" as const, text }];
    s.turn = { status: "pending", changed: [], started_at: Date.now() };
    await save();
    if (deps.startTurn) await deps.startTurn(s.id);
    else await runTurn(deps, s.id);
    const after = (await storage.get(s.id)) ?? s;
    const t = after.turn;
    if (t?.status === "pending") return json({ pending: true, turn: t }, 202);
    if (t?.status === "error") throw new HttpError(502, t.error || "AI call failed");
    const reply = [...after.messages].reverse().find((x) => x.role === "assistant")?.text ?? "";
    return json({ reply, map: after.map, changed: t?.changed ?? [] });
  }

  if (rest[0] === "nodes" && rest[1]) {
    const n = findNode(s, rest[1]);
    if (!n) throw new HttpError(404, "node not found");
    const action = rest[2];

    if (m === "POST" && action === "chat") {
      const text = await readText(req);
      const history = (s.node_chats[n.id] ??= []);
      const out = await callAI(() => ai.nodeChat(n, s.map, [...history], text));
      // Re-read: the user may have locked/approved this bubble (or changed others) while Claude was replying.
      const latest = (await storage.get(s.id)) ?? s;
      const ln = findNode(latest, n.id) ?? n;
      const lh = (latest.node_chats[n.id] ??= []);
      lh.push({ role: "user", text, node_id: n.id }, { role: "assistant", text: out.reply ?? "", node_id: n.id });
      if (ln.status !== "locked") {
        ln.label = out.label || ln.label;
        ln.detail = out.detail || ln.detail;
      }
      await storage.put(latest);
      return json({ reply: out.reply ?? "", node: ln, history: lh });
    }

    if (m === "POST" && action === "approve") {
      if (n.status !== "locked") n.status = "approved";
      await save();
      return json(n);
    }

    if (m === "PATCH" && !action) {
      const body = (await req.json().catch(() => ({}))) as { label?: string; detail?: string; status?: string };
      if (body.status !== undefined) {
        if (!["proposed", "approved", "locked"].includes(body.status)) throw new HttpError(422, "status must be proposed, approved or locked");
        n.status = body.status as Session["map"]["nodes"][number]["status"];
      }
      if (typeof body.label === "string") n.label = body.label;
      if (typeof body.detail === "string") n.detail = body.detail;
      await save();
      return json(n);
    }
  }

  if (m === "POST" && rest.length === 1 && rest[0] === "build") {
    if (!s.map.nodes.length) throw new HttpError(422, "map is empty; send a message first");
    if (s.builds.some((b) => b.status === "pending")) throw new HttpError(409, "a build is already running");
    const bid = `b${s.builds.length + 1}`;
    const cp = addCheckpoint(s, `Build ${bid}`, bid);
    const b = { id: bid, status: "pending" as const, html: "", trace: {}, checkpoint_id: cp.id };
    s.builds.push(b);
    await save();
    await deps.startBuild(s.id, bid);
    const after = (await storage.get(s.id))?.builds.find((x) => x.id === bid) ?? b;
    return json(after, after.status === "pending" ? 202 : 200);
  }

  if (rest[0] === "map" && rest[1] === "export" && m === "GET") {
    const url = new URL(req.url);
    const format = url.searchParams.get("format") || "json";

    if (format === "mermaid") {
      const lines = ["flowchart TD"];
      for (const n of s.map.nodes) {
        const cls = n.status === "approved" ? "approved" : n.source;
        // Escape quotes and newlines in labels
        const escapedLabel = n.label.replace(/"/g, "'").replace(/\n/g, " ");
        lines.push(`    ${n.id}["${escapedLabel}"]:::${cls}`);
      }
      for (const e of s.map.edges) {
        lines.push(`    ${e.from} -->|${e.relation}| ${e.to}`);
      }
      lines.push("    classDef user stroke:#d67408,stroke-width:2px;");
      lines.push("    classDef inferred stroke:#17c894,stroke-dasharray: 5 5;");
      lines.push("    classDef unknown stroke:#e5484d,stroke-dasharray: 2 2;");
      lines.push("    classDef approved stroke:#30a46c,stroke-width:3px;");

      return new Response(lines.join("\n") + "\n", {
        headers: { "content-type": "text/vnd.mermaid; charset=utf-8" },
      });
    }

    if (format === "json") {
      const body = {
        id: s.id,
        exportedAt: new Date().toISOString(),
        nodes: s.map.nodes,
        edges: s.map.edges,
      };
      return new Response(JSON.stringify(body, null, 2), {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-disposition": `attachment; filename="mindcode-map-${s.id}.json"`,
        },
      });
    }

    throw new HttpError(422, "unsupported format; must be mermaid or json");
  }

  if (rest[0] === "builds" && rest[1]) {
    const b = s.builds.find((x) => x.id === rest[1]);
    if (!b) throw new HttpError(404, "build not found");
    if (m === "GET" && rest.length === 2) return json(b);
    if (m === "GET" && rest[2] === "preview") {
      if (b.status !== "done") throw new HttpError(409, `build is ${b.status}`);
      return new Response(inject(b.html), { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    if (m === "GET" && rest[2] === "download") {
      if (b.status !== "done") throw new HttpError(409, `build is ${b.status}`);
      return new Response(b.html, {
        headers: {
          "content-type": "text/html; charset=utf-8",
          "content-disposition": `attachment; filename="mindcode-${b.id}.html"`,
        },
      });
    }
  }

  if (rest[0] === "checkpoints") {
    if (m === "GET" && rest.length === 1) return json(s.checkpoints);

    if (m === "POST" && rest.length === 3 && rest[2] === "restore") {
      const cid = rest[1];
      const cp = s.checkpoints.find((c) => c.id === cid);
      if (!cp) throw new HttpError(404, "checkpoint not found");
      s.map = structuredClone(cp.map);
      addCheckpoint(s, `Restored to ${cp.label}`);
      await save();
      return json(publicSession(s));
    }
  }

  throw new HttpError(404, "not found");
}
