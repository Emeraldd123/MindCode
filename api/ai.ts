// The one place the API picks its AI implementation.
// When ai/ lands (#4, #5), replace this with the real module, e.g.:
//   import { realAI } from "../ai/index";
//   export const ai: AI = process.env.MINDCODE_FAKE_LLM === "1" ? stubAI : realAI;
import type { AI } from "./types";
import { stubAI } from "./stubs";

export const ai: AI = stubAI;
