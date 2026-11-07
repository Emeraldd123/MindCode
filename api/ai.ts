// The one place the API picks its AI implementation.
// updateMap: real ai/ module (#4). It handles MINDCODE_FAKE_LLM=1 itself with the canned demo map.
// nodeChat / buildApp: real ai/ modules (#5), also fake-aware. api/stubs.ts is only used by the API tests.
import { build_app } from "../ai/build.ts";
import { update_map } from "../ai/extract.ts";
import { node_chat } from "../ai/node_chat.ts";
import type { AI } from "./types";

export const ai: AI = {
  updateMap: async (messages, current) => {
    const { reply, map } = await update_map(messages, current);
    return { reply, map };
  },
  nodeChat: (node, map, history, text) => node_chat(node, map, history, text),
  buildApp: (map, previousHtml) => build_app(map, previousHtml),
};
