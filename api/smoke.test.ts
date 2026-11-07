process.env.MINDCODE_FAKE_LLM = "1";

import { describe, expect, it } from "vitest";
import { ai } from "./ai";
import { handle, runBuild, type Deps } from "./router";
import { memoryStorage } from "./storage";
import type { Build, Checkpoint, MapNode, MindMap, Session } from "./types";

function createTestDeps(): Deps {
  const storage = memoryStorage();
  let idCounter = 0;
  return {
    storage,
    ai,
    startBuild: (sid, bid) => runBuild({ storage, ai }, sid, bid),
    newId: () => `s${++idCounter}`,
  };
}

async function request(deps: Deps, method: string, path: string, body?: unknown) {
  const req = new Request(`http://localhost:8888/api${path}`, {
    method,
    headers: body !== undefined ? { "content-type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const res = await handle(req, deps);
  const contentType = res.headers.get("content-type") ?? "";
  const responseBody = contentType.includes("json") ? await res.json() : await res.text();
  return { status: res.status, headers: res.headers, body: responseBody };
}

describe("End-to-end smoke test (MINDCODE_FAKE_LLM=1)", () => {
  it("verifies the full MindCode lifecycle end-to-end", async () => {
    const deps = createTestDeps();

    // 1. Health check: GET /api/health returns { "ok": true }
    const healthRes = await request(deps, "GET", "/health");
    expect(healthRes.status).toBe(200);
    expect(healthRes.body).toEqual({ ok: true });

    // 2. Session creation: POST /api/sessions returns a fresh Session with an empty map
    const sessionRes = await request(deps, "POST", "/sessions");
    expect(sessionRes.status).toBe(200);
    const session = sessionRes.body as Session;
    expect(session.id).toBeDefined();
    expect(session.map).toBeDefined();
    expect(session.map.nodes).toEqual([]);
    expect(session.map.edges).toEqual([]);
    const sid = session.id;

    // 3. Prompt extraction: POST /api/sessions/:sid/messages with { "text": "I want a chat app for my study group" }
    const msgRes = await request(deps, "POST", `/sessions/${sid}/messages`, {
      text: "I want a chat app for my study group",
    });
    expect(msgRes.status).toBe(200);
    const msgBody = msgRes.body as { reply: string; map: MindMap; changed: string[] };

    // - Returns at least 5 nodes in map.nodes
    expect(msgBody.map.nodes.length).toBeGreaterThanOrEqual(5);

    // - Contains at least 1 user source node with non-empty evidence
    const userNodes = msgBody.map.nodes.filter((n: MapNode) => n.source === "user");
    expect(userNodes.length).toBeGreaterThanOrEqual(1);
    expect(userNodes.some((n: MapNode) => Array.isArray(n.evidence) && n.evidence.length > 0)).toBe(true);

    // - Contains at least 1 inferred source node with inventiveness between 0 and 1
    const inferredNodes = msgBody.map.nodes.filter((n: MapNode) => n.source === "inferred");
    expect(inferredNodes.length).toBeGreaterThanOrEqual(1);
    expect(
      inferredNodes.some((n: MapNode) => typeof n.inventiveness === "number" && n.inventiveness >= 0 && n.inventiveness <= 1),
    ).toBe(true);

    // - Contains at least 1 unknown source node
    const unknownNodes = msgBody.map.nodes.filter((n: MapNode) => n.source === "unknown");
    expect(unknownNodes.length).toBeGreaterThanOrEqual(1);
    const unknownNode = unknownNodes[0];

    // 4. Bubble brainstorm & rewrite: POST /api/sessions/:sid/nodes/:nid/chat on the unknown node
    // with { "text": "just a nickname, no passwords" }
    const chatRes = await request(deps, "POST", `/sessions/${sid}/nodes/${unknownNode.id}/chat`, {
      text: "just a nickname, no passwords",
    });
    expect(chatRes.status).toBe(200);
    const chatBody = chatRes.body as { reply: string; node: MapNode; history: unknown[] };

    // - Returns updated node with label === "Nickname login"
    expect(chatBody.node.label).toBe("Nickname login");

    // 5. Approval: POST /api/sessions/:sid/nodes/:nid/approve
    const approveRes = await request(deps, "POST", `/sessions/${sid}/nodes/${unknownNode.id}/approve`);
    expect(approveRes.status).toBe(200);
    const approvedNode = approveRes.body as MapNode;

    // - Returns node with status === "approved"
    expect(approvedNode.status).toBe("approved");

    // 6. Build generation: POST /api/sessions/:sid/build
    const buildRes = await request(deps, "POST", `/sessions/${sid}/build`);
    expect([200, 202]).toContain(buildRes.status);
    let build = buildRes.body as Build;
    expect(["pending", "done"]).toContain(build.status);

    // - If pending, polls GET /api/sessions/:sid/builds/:bid until status === "done"
    const bid = build.id;
    if (build.status === "pending") {
      let attempts = 0;
      while (build.status === "pending" && attempts < 10) {
        attempts++;
        const pollRes = await request(deps, "GET", `/sessions/${sid}/builds/${bid}`);
        expect(pollRes.status).toBe(200);
        build = pollRes.body as Build;
      }
    }
    expect(build.status).toBe("done");

    // - Verify build.audit is populated
    expect(build.audit).toBeDefined();
    expect(build.audit?.totalElements).toBeGreaterThan(0);
    expect(build.audit?.coveragePct).toBeGreaterThanOrEqual(0);

    // 7. Preview HTML & Traceability: GET /api/sessions/:sid/builds/:bid/preview
    const previewRes = await request(deps, "GET", `/sessions/${sid}/builds/${bid}/preview`);
    expect(previewRes.status).toBe(200);
    expect(previewRes.headers.get("content-type")).toContain("text/html");
    const previewHtml = previewRes.body as string;

    // - HTML contains <script> trace bridge
    expect(previewHtml).toMatch(/<script[\s\S]*?>[\s\S]*?mc-hover[\s\S]*?<\/script>/i);

    // - HTML contains elements with data-mc-el and data-mc attributes referencing nodes in map.nodes
    const updatedSessionRes = await request(deps, "GET", `/sessions/${sid}`);
    const latestMap = (updatedSessionRes.body as Session).map;
    const nodeIds = new Set(latestMap.nodes.map((n) => n.id));

    const elementMatches = [...previewHtml.matchAll(/data-mc-el=["']([^"']+)["']\s+data-mc=["']([^"']+)["']/g)];
    const elementMatchesRev = [...previewHtml.matchAll(/data-mc=["']([^"']+)["']\s+data-mc-el=["']([^"']+)["']/g)];
    const allMatches = [
      ...elementMatches.map((m) => ({ el: m[1], mc: m[2] })),
      ...elementMatchesRev.map((m) => ({ el: m[2], mc: m[1] })),
    ];
    expect(allMatches.length).toBeGreaterThan(0);

    const referencedNodeIds = allMatches.flatMap((m) => m.mc.split(/\s+/).filter(Boolean));
    expect(referencedNodeIds.length).toBeGreaterThan(0);
    for (const refId of referencedNodeIds) {
      expect(nodeIds.has(refId)).toBe(true);
    }

    // 8. Standalone Download Check: GET /api/sessions/:sid/builds/:bid/download
    const downloadRes = await request(deps, "GET", `/sessions/${sid}/builds/${bid}/download`);
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(downloadRes.headers.get("content-disposition")).toBe(`attachment; filename="mindcode-${bid}.html"`);
    const downloadHtml = downloadRes.body as string;
    expect(downloadHtml).not.toMatch(/mc-hover/);
    expect(downloadHtml).toBe(build.html);

    // 9. Checkpoints: GET /api/sessions/:sid/checkpoints
    const checkpointsRes = await request(deps, "GET", `/sessions/${sid}/checkpoints`);
    expect(checkpointsRes.status).toBe(200);
    const checkpoints = checkpointsRes.body as Checkpoint[];

    // - Returns array of Checkpoint items with turn numbers and snapshot maps
    expect(Array.isArray(checkpoints)).toBe(true);
    expect(checkpoints.length).toBeGreaterThanOrEqual(1);
    for (const cp of checkpoints) {
      expect(typeof cp.turn).toBe("number");
      expect(cp.map).toBeDefined();
      expect(Array.isArray(cp.map.nodes)).toBe(true);
      expect(Array.isArray(cp.map.edges)).toBe(true);
    }

    // 10. Checkpoint Restore Check: POST /api/sessions/:sid/checkpoints/:cid/restore
    const c1 = checkpoints[0];
    const restoreRes = await request(deps, "POST", `/sessions/${sid}/checkpoints/${c1.id}/restore`);
    expect(restoreRes.status).toBe(200);
    const restoredSession = restoreRes.body as Session;
    expect(restoredSession.map).toEqual(c1.map);

    const postRestoreCheckpointsRes = await request(deps, "GET", `/sessions/${sid}/checkpoints`);
    expect(postRestoreCheckpointsRes.status).toBe(200);
    const postRestoreCheckpoints = postRestoreCheckpointsRes.body as Checkpoint[];
    expect(postRestoreCheckpoints.some((cp) => cp.label.startsWith("Restored to "))).toBe(true);

    // 11. Mind map export (Mermaid & JSON)
    // 11a. Mermaid export: GET /api/sessions/:sid/map/export?format=mermaid
    const mermaidRes = await request(deps, "GET", `/sessions/${sid}/map/export?format=mermaid`);
    expect(mermaidRes.status).toBe(200);
    expect(mermaidRes.headers.get("content-type")).toBe("text/vnd.mermaid; charset=utf-8");
    const mermaidBody = mermaidRes.body as string;
    expect(mermaidBody).toContain("flowchart TD");
    expect(mermaidBody).toMatch(/:::(user|inferred|unknown|approved)/);
    expect(mermaidBody).toMatch(/-->\|(has|needs)\|/);
    expect(mermaidBody).toContain("classDef user");
    expect(mermaidBody).toContain("classDef inferred");
    expect(mermaidBody).toContain("classDef unknown");
    expect(mermaidBody).toContain("classDef approved");

    // 11b. JSON export: GET /api/sessions/:sid/map/export?format=json (and default without format query)
    const jsonRes = await request(deps, "GET", `/sessions/${sid}/map/export?format=json`);
    expect(jsonRes.status).toBe(200);
    expect(jsonRes.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(jsonRes.headers.get("content-disposition")).toBe(`attachment; filename="mindcode-map-${sid}.json"`);
    const jsonBody = jsonRes.body as { id: string; exportedAt: string; nodes: MapNode[]; edges: unknown[] };
    expect(jsonBody.id).toBe(sid);
    expect(typeof jsonBody.exportedAt).toBe("string");
    expect(isNaN(Date.parse(jsonBody.exportedAt))).toBe(false);

    // Verify nodes and edges match the session's map
    const curSessionRes = await request(deps, "GET", `/sessions/${sid}`);
    const curMap = (curSessionRes.body as Session).map;
    expect(jsonBody.nodes).toEqual(curMap.nodes);
    expect(jsonBody.edges).toEqual(curMap.edges);

    // Default format check (no format query param)
    const defaultExportRes = await request(deps, "GET", `/sessions/${sid}/map/export`);
    expect(defaultExportRes.status).toBe(200);
    expect(defaultExportRes.headers.get("content-type")).toBe("application/json; charset=utf-8");
    expect(defaultExportRes.headers.get("content-disposition")).toBe(`attachment; filename="mindcode-map-${sid}.json"`);
    const defaultBody = defaultExportRes.body as { id: string; exportedAt: string; nodes: MapNode[]; edges: unknown[] };
    expect(defaultBody.id).toBe(sid);
    expect(defaultBody.nodes).toEqual(curMap.nodes);
    expect(defaultBody.edges).toEqual(curMap.edges);

    // 11c. Invalid format validation: GET /api/sessions/:sid/map/export?format=invalid
    const invalidRes = await request(deps, "GET", `/sessions/${sid}/map/export?format=invalid`);
    expect(invalidRes.status).toBe(422);
  });
});
