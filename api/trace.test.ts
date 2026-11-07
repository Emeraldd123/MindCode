import { describe, expect, it } from "vitest";
import { auditTrace, inject, TRACE_SCRIPT } from "./trace";
import type { MindMap } from "./types";
import demoSession from "./demo/study-group.json";

describe("TRACE_SCRIPT brand palette", () => {
  it("contains Ben's brand palette colors and no legacy colors", () => {
    // AI green: #17c894, user orange: #d67408
    expect(TRACE_SCRIPT).toContain("#17c894");
    expect(TRACE_SCRIPT).toContain("#d67408");
    // Legacy colors: #22c55e (green) and #6366f1 (indigo)
    expect(TRACE_SCRIPT).not.toContain("#22c55e");
    expect(TRACE_SCRIPT).not.toContain("#6366f1");
  });

  it("injects script before closing body tag", () => {
    const html = "<html><body><h1>Hello</h1></body></html>";
    const injected = inject(html);
    expect(injected).toContain(TRACE_SCRIPT);
    expect(injected.endsWith("</body></html>")).toBe(true);
  });
});

describe("auditTrace", () => {
  it("calculates audit metrics for rich HTML from demo session", () => {
    const demoBuild = demoSession.builds[0];
    const map = demoSession.map as MindMap;
    const audit = auditTrace(demoBuild.html, map);

    expect(audit.totalElements).toBe(41);
    expect(audit.tracedElements).toBe(16);
    expect(audit.coveragePct).toBe(39); // Math.round(16/41 * 100)
    expect(audit.nodeBreakdown).toEqual({
      n1: 1,
      n2: 5,
      n3: 3,
      n4: 2,
      n5: 3,
      n6: 3,
      n7: 2,
      n8: 4,
    });
    expect(audit.untracedNodes).toEqual([]);
  });

  it("handles empty HTML", () => {
    const map: MindMap = {
      nodes: [
        {
          id: "n1",
          label: "Root",
          detail: "",
          kind: "goal",
          source: "user",
          inventiveness: 0,
          importance: 5,
          status: "approved",
          parent: null,
          evidence: [],
          turn: 1,
        },
      ],
      edges: [],
    };
    const audit = auditTrace("", map);

    expect(audit.totalElements).toBe(0);
    expect(audit.tracedElements).toBe(0);
    expect(audit.coveragePct).toBe(0);
    expect(audit.nodeBreakdown).toEqual({});
    expect(audit.untracedNodes).toEqual(["n1"]);
  });

  it("handles HTML with no traces", () => {
    const html = `<div><header><h1>Title</h1></header><main><p>Text</p><button>Click</button></main></div>`;
    const map: MindMap = {
      nodes: [
        {
          id: "n1",
          label: "Node 1",
          detail: "",
          kind: "goal",
          source: "user",
          inventiveness: 0,
          importance: 5,
          status: "approved",
          parent: null,
          evidence: [],
          turn: 1,
        },
        {
          id: "n2",
          label: "Node 2",
          detail: "",
          kind: "feature",
          source: "user",
          inventiveness: 0,
          importance: 5,
          status: "proposed",
          parent: "n1",
          evidence: [],
          turn: 1,
        },
      ],
      edges: [],
    };
    const audit = auditTrace(html, map);

    expect(audit.totalElements).toBe(6);
    expect(audit.tracedElements).toBe(0);
    expect(audit.coveragePct).toBe(0);
    expect(audit.nodeBreakdown).toEqual({});
    expect(audit.untracedNodes).toEqual(["n1", "n2"]);
  });

  it("handles HTML with 100% traces", () => {
    const html = `
      <header data-mc="n1">
        <h1 data-mc="n1">Title</h1>
      </header>
      <main data-mc="n2">
        <p data-mc="n2">Hello world</p>
      </main>
    `;
    const map: MindMap = {
      nodes: [
        {
          id: "n1",
          label: "Node 1",
          detail: "",
          kind: "goal",
          source: "user",
          inventiveness: 0,
          importance: 5,
          status: "approved",
          parent: null,
          evidence: [],
          turn: 1,
        },
        {
          id: "n2",
          label: "Node 2",
          detail: "",
          kind: "feature",
          source: "user",
          inventiveness: 0,
          importance: 5,
          status: "approved",
          parent: "n1",
          evidence: [],
          turn: 1,
        },
      ],
      edges: [],
    };
    const audit = auditTrace(html, map);

    expect(audit.totalElements).toBe(4);
    expect(audit.tracedElements).toBe(4);
    expect(audit.coveragePct).toBe(100);
    expect(audit.nodeBreakdown).toEqual({ n1: 2, n2: 2 });
    expect(audit.untracedNodes).toEqual([]);
  });

  it("ignores non-structural tags and handles multiple node IDs per element", () => {
    // span, b, i, strong, a are non-structural and should not count towards totalElements or tracedElements
    const html = `
      <div data-mc="n1 n2">
        <span data-mc="n1">ignored tag</span>
        <a href="#" data-mc="n2">link</a>
        <p data-mc="n1">Paragraph</p>
      </div>
    `;
    const map: MindMap = {
      nodes: [
        {
          id: "n1",
          label: "Node 1",
          detail: "",
          kind: "goal",
          source: "user",
          inventiveness: 0,
          importance: 5,
          status: "approved",
          parent: null,
          evidence: [],
          turn: 1,
        },
        {
          id: "n2",
          label: "Node 2",
          detail: "",
          kind: "feature",
          source: "user",
          inventiveness: 0,
          importance: 5,
          status: "approved",
          parent: "n1",
          evidence: [],
          turn: 1,
        },
        {
          id: "n3",
          label: "Node 3",
          detail: "",
          kind: "feature",
          source: "inferred",
          inventiveness: 0.2,
          importance: 3,
          status: "proposed",
          parent: "n1",
          evidence: [],
          turn: 1,
        },
      ],
      edges: [],
    };
    const audit = auditTrace(html, map);

    // structural tags: div, p -> total 2
    expect(audit.totalElements).toBe(2);
    expect(audit.tracedElements).toBe(2);
    expect(audit.coveragePct).toBe(100);
    expect(audit.nodeBreakdown).toEqual({ n1: 2, n2: 1 });
    expect(audit.untracedNodes).toEqual(["n3"]);
  });
});
