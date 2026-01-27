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
  let data: {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: OpenAIChatResult["usage"];
  } | null = null;
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      data = (await postChatCompletions(apiKey, buildPayload(useMaxCompletionTokens, includeTemperature))) as typeof data;
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

  const content = data?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) throw new Error("OpenAI returned an empty response");

  return {
    content,
    model: data?.model || model,
    usage: data?.usage
  };
}
