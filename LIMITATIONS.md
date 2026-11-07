# MindCode Feature Limitations & Proposed Improvements

## Known Limitations

1. **Strict JSON parsing from LLMs:** The application initially relied on a strict `.replace(/^```(?:json)?\s*/i, "")` regex to parse LLM outputs. This proved fragile if the model generated conversational text before the code block.
   - *Fix applied:* A more robust JSON extraction method was implemented (`ai/client.ts`) that correctly searches for the ````json` fences globally or extracts JSON using the first and last occurrence of curly braces or square brackets.

2. **Server/Backend Limitation (Single-file build):** The AI generation prompt currently restricts building to a strict single-file constraint (no external scripts, images, or real server API). Backend functionality must be mocked as an in-page data layer (`store.list()`, `store.add()`).
   - *Improvement:* Support a multi-file export or a small `server.js` Node/Express stub for real database calls.

3. **Restricted Styling & Theming:** Generating inline `style` tags limits the app's complexity. A real design system or framework like Tailwind (via a CDN) could dramatically improve visual quality rather than asking the LLM to write CSS from scratch for every element.

4. **Hardcoded Mock Data (Fake Mode):** When operating under `MINDCODE_FAKE_LLM=1`, generations and node extraction are completely hardcoded to the chat app/study group example. Real feature iteration can only happen with an active `OPENROUTER_API_KEY`.

5. **Traceability mapping:** The AI must explicitly inject `data-mc` tags onto the DOM elements to trace them back to the bubbles. If the LLM misses these or creates hallucinatory node IDs, the visual traceback mapping breaks. The HTML utility functions (`html_utils.ts`) sanitize and preserve these IDs, but the initial generation relies entirely on the AI's compliance.
