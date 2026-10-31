import type { Turn } from "./types";

export type AskArgs = {
  instructions: string;
  input: Turn[];
  model?: string;
  maxOutputTokens: number;
  jsonSchema?: { name: string; schema: object };
};

export type Ask = (args: AskArgs) => Promise<string>;

type Options = { apiKey?: string; fetchImpl?: typeof fetch; timeoutMs?: number };

type OutputPart = { type?: string; text?: string };
type OutputItem = { content?: OutputPart[] };

export function createAsk(opts: Options = {}): Ask {
  const fetchImpl = opts.fetchImpl ?? fetch;
  const timeoutMs = opts.timeoutMs ?? 20000;

  return async (args) => {
    const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
    const model = args.model ?? process.env.OPENAI_MODEL;
    if (!model) throw new Error("OPENAI_MODEL is not set");

    const body: Record<string, unknown> = {
      model,
      instructions: args.instructions,
      input: args.input.map((t) => ({ role: t.role, content: t.text })),
      max_output_tokens: args.maxOutputTokens,
      store: false,
    };
    const effort = process.env.OPENAI_REASONING_EFFORT;
    if (effort) body.reasoning = { effort };
    if (args.jsonSchema) {
      body.text = {
        format: { type: "json_schema", name: args.jsonSchema.name, schema: args.jsonSchema.schema, strict: true },
      };
    }

    const res = await fetchImpl("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`OpenAI request failed with status ${res.status}`);

    const data = (await res.json()) as { output?: OutputItem[] };
    return (data.output ?? [])
      .flatMap((item) => item.content ?? [])
      .filter((part) => part.type === "output_text")
      .map((part) => part.text ?? "")
      .join("");
  };
}
