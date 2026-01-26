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

function getOpenAIConfig() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  return { apiKey, model };
}

export async function runOpenAIChat(options: OpenAIChatOptions): Promise<OpenAIChatResult> {
  const { apiKey, model: defaultModel } = getOpenAIConfig();
  const model = options.model || defaultModel;
  const temperature = options.temperature ?? 0.2;
  const maxTokens = options.maxTokens ?? 900;

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      temperature,
      max_tokens: maxTokens,
      messages: options.messages
    })
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = typeof body?.error?.message === "string" ? body.error.message : res.statusText;
    throw new Error(`OpenAI error: ${msg}`);
  }

  const data = (await res.json()) as {
    model?: string;
    choices?: Array<{ message?: { content?: string } }>;
    usage?: OpenAIChatResult["usage"];
  };

  const content = data?.choices?.[0]?.message?.content?.trim() ?? "";
  if (!content) throw new Error("OpenAI returned an empty response");

  return {
    content,
    model: data?.model || model,
    usage: data?.usage
  };
}
