// Stand-in AI used until ai/ lands (and by the API tests). Deterministic, no network.
import type { AI, MindMap, ProposedNode } from "./types";

type Row = [string, string, ProposedNode["kind"], ProposedNode["source"], number, number, string | null];

export const stubAI: AI = {
  async updateMap(messages, current) {
    const text = messages.at(-1)?.text ?? "";
    if (current.nodes.length) {
      const id = `n${current.nodes.length + 1}`;
      return {
        reply: "Noted. I added that to the map.",
        map: {
          nodes: [...current.nodes, { id, label: text.slice(0, 30) || "Idea", detail: text, kind: "feature", source: "user", parent: "n1", evidence: [text] }],
          edges: [...current.edges, { from: "n1", to: id, relation: "has" }],
        },
      };
    }
    const rows: Row[] = [
      ["n1", "Your app", "goal", "user", 0, 5, null],
      ["n2", "Main page", "page", "inferred", 0.2, 3, "n1"],
      ["n3", "Backend API", "api", "inferred", 0.5, 4, "n1"],
      ["n4", "Visual style", "style", "inferred", 0.8, 2, "n2"],
      ["n5", "Who are the users?", "constraint", "unknown", 0, 5, "n1"],
    ];
    return {
      reply: "Here's how I read that. Amber bubbles are my assumptions; red ones need your call.",
      map: {
        nodes: rows.map(([id, label, kind, source, inventiveness, importance, parent]) => ({
          id, label, detail: label, kind, source, inventiveness, importance, parent, evidence: source === "user" ? [text] : [],
        })),
        edges: rows.filter((r) => r[6]).map((r) => ({ from: r[6]!, to: r[0], relation: "has" as const })),
      },
    };
  },

  async nodeChat(node, _map, _history, text) {
    return { reply: `Got it: ${text}`, label: node.label, detail: text || node.detail };
  },

  async buildApp(map: MindMap) {
    const root = map.nodes.find((n) => n.parent === null);
    const items = map.nodes.map((n, i) => `<li data-mc-el="e${i + 2}" data-mc="${n.id}">${n.label}</li>`).join("");
    return `<!doctype html><html><head><meta charset="utf-8"><title>${root?.label ?? "App"}</title></head><body>` +
      `<h1 data-mc-el="e1" data-mc="${root?.id ?? ""}">${root?.label ?? "App"}</h1><ul>${items}</ul></body></html>`;
  },
};
