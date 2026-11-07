export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterOptions {
  apiKey?: string;
  model?: string;
  temperature?: number;
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
    temperature: options.temperature ?? 0.2
  };

  if (jsonMode) {
    bodyPayload.response_format = { type: "json_object" };
  }

  let attempt = 0;
  let lastError: Error | null = null;
  const maxAttempts = 2; // initial attempt + one retry on invalid JSON

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const res = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(bodyPayload)
      });

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`OpenRouter API error ${res.status}: ${errorText}`);
      }

      const resJson = await res.json() as any;
      const rawText = resJson.choices?.[0]?.message?.content || "";

      if (!jsonMode) {
        return { data: rawText as unknown as T, rawText };
      }

      // Try parsing JSON
      try {
        // Strip markdown code fences if model enclosed JSON in ```json ... ```
        let cleanText = rawText.trim();
        if (cleanText.startsWith("```")) {
          cleanText = cleanText.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
        }
        const data = JSON.parse(cleanText) as T;
        return { data, rawText };
      } catch (parseErr) {
        lastError = new Error(`Invalid JSON from model (attempt ${attempt}/${maxAttempts}): ${(parseErr as Error).message}\nRaw: ${rawText}`);
        if (attempt < maxAttempts) {
          // Add retry prompt to messages for the retry
          bodyPayload.messages = [
            ...messages,
            { role: "assistant", content: rawText },
            { role: "user", content: "Your previous response was not valid JSON. Please respond ONLY with valid raw JSON, with no explanation or markdown code fences." }
          ];
          continue;
        }
      }
    } catch (err) {
      lastError = err as Error;
      if (attempt >= maxAttempts) {
        break;
      }
    }
  }

  throw lastError || new Error("Failed to call OpenRouter after retry");
}
