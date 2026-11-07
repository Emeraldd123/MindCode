// Long HTML generation that survives the output-token cap.
// Full-plan apps (25-35 bubbles) can exceed one response. If Claude stops before </html>, we ask it to
// continue exactly where it stopped and stitch the parts together, up to MAX_PARTS times.
import { callOpenRouter, type ChatMessage } from "./client.ts";
import { cleanHtmlOutput } from "./html_utils.ts";

const MAX_PARTS = 3;
const done = (html: string) => /<\/html>\s*$/i.test(html.trim());

export async function generateHtml(
  messages: ChatMessage[],
  opts: { maxTokens?: number; timeoutMs?: number; temperature?: number } = {},
): Promise<string> {
  const maxTokens = opts.maxTokens ?? 24000;
  const timeoutMs = opts.timeoutMs ?? 6 * 60 * 1000;
  let html = "";
  for (let part = 1; part <= MAX_PARTS; part++) {
    const convo: ChatMessage[] =
      part === 1
        ? messages
        : [
            ...messages,
            { role: "assistant", content: html },
            {
              role: "user",
              content:
                "Your previous message was cut off by the length limit. Continue EXACTLY where it stopped. Output only the remaining characters (no repetition, no markdown fences, no explanation), ending with </html>.",
            },
          ];
    const { rawText } = await callOpenRouter(convo, {
      jsonMode: false,
      maxTokens,
      timeoutMs,
      temperature: opts.temperature ?? 0.3,
    });
    const chunk = part === 1 ? cleanHtmlOutput(rawText) : rawText.replace(/^```(?:html)?\s*/i, "").replace(/\s*```\s*$/, "");
    html += chunk;
    if (done(html)) return html.trim();
  }
  throw new Error("The generated app was still cut off after 3 parts. Try a smaller map or Rebuild.");
}
