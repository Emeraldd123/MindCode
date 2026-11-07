// The one place the API picks its AI implementation.
// updateMap: real ai/ module (#4). It handles MINDCODE_FAKE_LLM=1 itself with the canned demo map.
// nodeChat / buildApp: stubs until #5 lands, then swap them in here the same way.
import { update_map } from "../ai/extract.ts";
import { stubAI } from "./stubs";
import type { AI } from "./types";

export const ai: AI = {
  updateMap: async (messages, current) => {
    const { reply, map } = await update_map(messages, current);
    return { reply, map };
  },
  nodeChat: stubAI.nodeChat,
  buildApp: stubAI.buildApp,
};
