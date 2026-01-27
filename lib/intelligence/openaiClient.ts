import "server-only";

type OpenAIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAIChatOptions = {
  messages: OpenAIChatMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: string;
};

type OpenAIChatResult = {
  content: string;
  model: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

function parseAllowlist(raw: string | undefined) {
  return (raw || "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

function resolveModel(requested: string | undefined, allowlist: string[], fallback: string) {
  if (requested && allowlist.includes(requested)) return requested;
  if (allowlist.includes(fallback)) return fallback;
  return allowlist[0] || fallback;
}

function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  const defaultModel = process.env.OPENAI_MODEL || "gpt-5-mini";
  const allowlist = parseAllowlist(process.env.OPENAI_MODEL_ALLOWLIST).length
    ? parseAllowlist(process.env.OPENAI_MODEL_ALLOWLIST)
    : ["gpt-5-mini", "gpt-5", "gpt-4o-mini", "gpt-4o"];

  return { apiKey, defaultModel, allowlist };
}

function supportsMaxCompletionTokens(model: string) {
  // Some newer OpenAI models (e.g., gpt-5*) require `max_completion_tokens`
  // instead of `max_tokens` in Chat Completions requests.
  return model.startsWith("gpt-5") || model.startsWith("o1") || model.startsWith("o3");
}

async function postChatCompletions(apiKey: string, payload: Record<string, unknown>) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = typeof body?.error?.message === "string" ? body.error.message : res.statusText;
    const err = new Error(`OpenAI error: ${msg}`);
    (err as Error & { openai_message?: string }).openai_message = msg;
    throw err;
  }

  return body;
}

type ChatCompletionsResponse = {
  model?: string;
  choices?: Array<{ message?: { content?: unknown; refusal?: unknown }; text?: unknown }>;
  usage?: OpenAIChatResult["usage"];
};

function extractObjectText(obj: Record<string, unknown>): string {
  const directKeys = ["text", "value", "content", "output_text", "refusal"];
  for (const key of directKeys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }

  const nestedText = obj.text;
  if (nestedText && typeof nestedText === "object") {
    const nested = extractObjectText(nestedText as Record<string, unknown>);
    if (nested) return nested;
  }

  const nestedContent = obj.content;
  if (Array.isArray(nestedContent)) {
    const nested = extractContent(nestedContent);
    if (nested) return nested;
  }

  return "";
}

function extractContent(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    const text = value
      .map((part) => extractContent(part))
      .join("")
      .trim();
    return text;
  }
  if (value && typeof value === "object") {
    return extractObjectText(value as Record<string, unknown>);
  }
  return "";
}

function extractChoiceContent(choice: unknown): string {
  if (!choice || typeof choice !== "object") return "";
  const choiceObj = choice as { message?: { content?: unknown; refusal?: unknown }; text?: unknown };
  const message = choiceObj.message;
  const messageContent = extractContent(message?.content ?? message);
  if (messageContent) return messageContent;
  if (typeof message?.refusal === "string" && message.refusal.trim()) return message.refusal.trim();
  if (typeof choiceObj.text === "string" && choiceObj.text.trim()) return choiceObj.text.trim();
  return "";
}

function extractResponseOutput(data: unknown): string {
  if (!data || typeof data !== "object") return "";
  const outputText = (data as { output_text?: unknown }).output_text;
  if (typeof outputText === "string" && outputText.trim()) return outputText.trim();
  const output = (data as { output?: unknown }).output;
  if (!Array.isArray(output)) return "";
  const text = output
    .map((item) => {
      if (!item || typeof item !== "object") return "";
      const content = (item as { content?: unknown }).content;
      return extractContent(content);
    })
    .join("")
    .trim();
  return text;
}

function summarizeResponseShape(data: unknown): string {
  if (!data || typeof data !== "object") return `response_type=${typeof data}`;
  const obj = data as Record<string, unknown>;
  const keys = Object.keys(obj).slice(0, 12);
  const choices = Array.isArray(obj.choices) ? (obj.choices as Array<Record<string, unknown>>) : null;
  const firstChoice = choices?.[0] ?? null;
  const message = firstChoice && typeof firstChoice === "object" ? (firstChoice as Record<string, unknown>).message : null;
  const content = message && typeof message === "object" ? (message as Record<string, unknown>).content : null;
  const contentType = Array.isArray(content) ? "array" : typeof content;
  const output = Array.isArray(obj.output) ? (obj.output as Array<Record<string, unknown>>) : null;
  const outputText = typeof obj.output_text === "string" ? obj.output_text.length : 0;

  const choiceKeys = firstChoice && typeof firstChoice === "object" ? Object.keys(firstChoice).slice(0, 12) : [];
  const messageKeys = message && typeof message === "object" ? Object.keys(message as Record<string, unknown>).slice(0, 12) : [];

  return [
    `keys=${keys.join(",") || "none"}`,
    `choices=${choices ? choices.length : 0}`,
    `choice_keys=${choiceKeys.join(",") || "none"}`,
    `message_keys=${messageKeys.join(",") || "none"}`,
    `content_type=${contentType}`,
    `output_items=${output ? output.length : 0}`,
    `output_text_len=${outputText}`
  ].join(" ");
}

export async function runOpenAIChat(options: OpenAIChatOptions): Promise<OpenAIChatResult> {
  const { apiKey, defaultModel, allowlist } = getOpenAIConfig();
  const model = resolveModel(options.model, allowlist, defaultModel);
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.maxTokens ?? 900;

  const buildPayload = (useMaxCompletionTokens: boolean, includeTemperature: boolean) => ({
    model,
    messages: options.messages,
    ...(includeTemperature ? { temperature } : {}),
    ...(useMaxCompletionTokens ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens })
  });

  let useMaxCompletionTokens = supportsMaxCompletionTokens(model);
  let includeTemperature = true;
  let data: ChatCompletionsResponse | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      data = (await postChatCompletions(apiKey, buildPayload(useMaxCompletionTokens, includeTemperature))) as ChatCompletionsResponse;
      break;
    } catch (e) {
      lastError = e;
      const msg =
        e instanceof Error && "openai_message" in e
          ? String((e as Error & { openai_message?: string }).openai_message || e.message)
          : e instanceof Error
            ? e.message
            : "";

      // Some models are strict about which token-limit parameter is accepted.
      if (!useMaxCompletionTokens && msg.includes("Unsupported parameter: 'max_tokens'")) {
        useMaxCompletionTokens = true;
        continue;
      }

      if (useMaxCompletionTokens && msg.includes("Unsupported parameter: 'max_completion_tokens'")) {
        useMaxCompletionTokens = false;
        continue;
      }

      if (
        includeTemperature &&
        (msg.includes("Unsupported parameter: 'temperature'") ||
          msg.includes("Unsupported value: 'temperature'") ||
          (msg.includes("temperature") && msg.includes("Only the default (1)")))
      ) {
        includeTemperature = false;
        continue;
      }

      throw e;
    }
  }

  if (!data) {
    throw lastError instanceof Error ? lastError : new Error("OpenAI request failed");
  }

  const content = extractChoiceContent(data.choices?.[0]) || extractResponseOutput(data);
  if (!content) {
    const summary = summarizeResponseShape(data);
    console.warn("OpenAI empty response", { model, summary });
    throw new Error(`OpenAI returned an empty response. ${summary}`);
  }

  return {
    content,
    model: data.model || model,
    usage: data.usage
  };
}
