export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
  maxTokens?: number;
  timeoutMs?: number;
  jsonMode?: boolean;
}

export async function callOpenRouter<T = any>(
  messages: ChatMessage[],
  options: OpenRouterOptions = {}
): Promise<{ data: T; rawText: string }> {
  const apiKey = options.apiKey || process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set in environment");
  }

  const model = options.model || process.env.OPENROUTER_MODEL || "anthropic/claude-opus-5.5";
  const jsonMode = options.jsonMode ?? true;
  const timeoutMs = options.timeoutMs ?? 24000;
  const maxTokens = options.maxTokens ?? 2000;

  const url = "https://openrouter.ai/api/v1/chat/completions";
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "HTTP-Referer": "https://github.com/Emeraldd123/MindCode",
    "X-Title": "MindCode"
  };

  const bodyPayload: any = {
    model,
    messages,
    temperature: options.temperature ?? 0.2,
    max_tokens: maxTokens
  };

  if (jsonMode) {
    bodyPayload.response_format = { type: "json_object" };
  }

  const startTime = Date.now();
  let attempt = 0;
  let lastError: Error | null = null;
  const maxAttempts = 2; // initial attempt + one retry on invalid JSON if time permits

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const elapsed = Date.now() - startTime;
      const remainingTimeout = Math.max(1000, timeoutMs - elapsed);

      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(bodyPayload),
        signal: AbortSignal.timeout(remainingTimeout)
      });

      if (!res.ok) {
        const errorText = await res.text();
        const err = new Error(friendlyOpenRouterError(res.status, errorText));
        (err as Error & { status?: number }).status = res.status;
        // Credit/auth problems won't fix themselves on retry.
        if (res.status === 401 || res.status === 402 || res.status === 403) throw Object.assign(err, { fatal: true });
        throw err;
      }

      const resJson = await res.json() as any;
      const rawText = resJson.choices?.[0]?.message?.content || "";

      if (!jsonMode) {
        return { data: rawText as unknown as T, rawText };
      }

      // Try parsing JSON
      try {
        let cleanText = rawText.trim();
        // Only strip fences that wrap the WHOLE answer. A lazy global match would stop at a code
        // block inside the JSON (e.g. a reply that contains ``` itself).
        const wrapped = cleanText.match(/^```(?:json)?\s*([\s\S]*)\s*```$/i);
        if (wrapped) {
            cleanText = wrapped[1];
        } else {
            const firstBrace = cleanText.indexOf('{');
            const firstBracket = cleanText.indexOf('[');
            let startIndex = -1;
            if (firstBrace !== -1 && firstBracket !== -1) startIndex = Math.min(firstBrace, firstBracket);
            else if (firstBrace !== -1) startIndex = firstBrace;
            else if (firstBracket !== -1) startIndex = firstBracket;

            if (startIndex !== -1) {
                const lastBrace = cleanText.lastIndexOf('}');
                const lastBracket = cleanText.lastIndexOf(']');
                let endIndex = -1;
                if (lastBrace !== -1 && lastBracket !== -1) endIndex = Math.max(lastBrace, lastBracket);
                else if (lastBrace !== -1) endIndex = lastBrace;
                else if (lastBracket !== -1) endIndex = lastBracket;

                if (endIndex !== -1 && endIndex > startIndex) {
                    cleanText = cleanText.substring(startIndex, endIndex + 1);
                }
            }
        }
        const data = JSON.parse(cleanText) as T;
        return { data, rawText };
      } catch (parseErr) {
        lastError = new Error(`Invalid JSON from model (attempt ${attempt}/${maxAttempts}): ${(parseErr as Error).message}\nRaw: ${rawText}`);

        // Check if there is enough time left to retry (skip if first attempt took > 12 s)
        const currentElapsed = Date.now() - startTime;
        if (attempt < maxAttempts && currentElapsed <= 12000) {
          bodyPayload.messages = [
            ...messages,
            { role: "assistant", content: rawText },
            { role: "user", content: "Your previous response was not valid JSON. Please respond ONLY with valid raw JSON, with no explanation or markdown code fences." }
          ];
          continue;
        } else {
          break;
        }
      }
    } catch (err) {
      if ((err as { fatal?: boolean })?.fatal) throw err;
      lastError = err as Error;
      break;
    }
  }

  throw lastError || new Error("Failed to call OpenRouter");
}


/** Short, human message for OpenRouter errors. The raw body can be huge and includes key/account ids. */
export function friendlyOpenRouterError(status: number, body: string): string {
  let msg = "";
  try {
    msg = JSON.parse(body)?.error?.message ?? "";
  } catch {
    msg = body;
  }
  if (status === 402) {
    const afford = msg.match(/can only afford (\d+)/i)?.[1];
    return `Out of AI credit: the OpenRouter key has reached its spending limit${afford ? ` (it can only afford ~${afford} more tokens)` : ""}. Raise the key's limit or add credit at openrouter.ai/settings/keys, then try again.`;
  }
  if (status === 401 || status === 403) return "The OpenRouter API key was rejected. Check OPENROUTER_API_KEY in the Netlify environment variables.";
  if (status === 429) return "Claude is rate-limited right now. Wait a few seconds and try again.";
  if (status >= 500) return `OpenRouter is having trouble (HTTP ${status}). Try again in a moment.`;
  return `OpenRouter error ${status}: ${String(msg).slice(0, 200)}`;
}
