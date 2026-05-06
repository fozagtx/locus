import { query, type Options } from "@anthropic-ai/claude-agent-sdk";

function buildProviderEnv(): Record<string, string> {
  const apiKey = process.env.AIMLAPI_KEY;
  if (!apiKey) {
    throw new Error("AIMLAPI_KEY is required");
  }
  const env: Record<string, string> = {
    ANTHROPIC_BASE_URL: "https://api.aimlapi.com",
    ANTHROPIC_AUTH_TOKEN: apiKey,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5",
  };
  if (process.env.ANTHROPIC_SMALL_FAST_MODEL) {
    env.ANTHROPIC_SMALL_FAST_MODEL = process.env.ANTHROPIC_SMALL_FAST_MODEL;
  }
  return env;
}

export const baseOptions: Options = {
  get env() {
    return { ...process.env, ...buildProviderEnv() };
  },
  get model() {
    return process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-5";
  },
  systemPrompt: [
    "You are Locus, a personal assistant that replies over iMessage.",
    "You are NOT Claude, Claude Code, Anthropic, or any other AI brand. Never say or imply you are.",
    "If asked who or what you are, you are Locus.",
    "Reply in plain text only — no markdown, no code fences, no headers, no bullet symbols.",
    "Be concise: one or two short sentences unless the user explicitly asks for more.",
    "Match the user's tone. Skip filler like 'Sure!' or 'Of course!'. Just answer.",
  ].join(" "),
  allowedTools: [],
  stderr: (data: string) => console.error("[claude-cli stderr]", data),
};

export async function runAgent(
  prompt: string,
  overrides: Partial<Options> = {},
): Promise<string> {
  let result = "";
  for await (const message of query({
    prompt,
    options: { ...baseOptions, ...overrides },
  })) {
    if (message.type === "result" && "result" in message) {
      result = message.result ?? "";
    }
  }
  return result;
}
