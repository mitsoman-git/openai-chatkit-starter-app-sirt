import { afterEach, describe, expect, it, vi } from "vitest";
import { createAsk } from "../lib/openai";

type Recorded = { url: string; init: RequestInit };

function fakeFetch(responseBody: unknown, status = 200) {
  const calls: Recorded[] = [];
  const fetchImpl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(responseBody), { status });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

const okBody = {
  output: [
    { type: "reasoning", summary: [] },
    {
      type: "message",
      content: [
        { type: "output_text", text: "Hello " },
        { type: "output_text", text: "there" },
      ],
    },
  ],
};

afterEach(() => vi.unstubAllEnvs());

describe("createAsk", () => {
  it("posts to the Responses API with auth and a clean body", async () => {
    vi.stubEnv("OPENAI_MODEL", "test-model");
    const { calls, fetchImpl } = fakeFetch(okBody);
    const ask = createAsk({ apiKey: "sk-test", fetchImpl });
    await ask({
      instructions: "be nice",
      input: [{ role: "user", text: "hi" }],
      maxOutputTokens: 2048,
    });
    expect(calls[0].url).toBe("https://api.openai.com/v1/responses");
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer sk-test");
    const body = JSON.parse(calls[0].init.body as string);
    expect(body).toMatchObject({
      model: "test-model",
      instructions: "be nice",
      input: [{ role: "user", content: "hi" }],
      max_output_tokens: 2048,
      store: false,
    });
    expect(body).not.toHaveProperty("temperature");
    expect(body).not.toHaveProperty("top_p");
    expect(body).not.toHaveProperty("reasoning");
    expect(body).not.toHaveProperty("text");
  });

  it("sends a strict json_schema format when asked", async () => {
    vi.stubEnv("OPENAI_MODEL", "m");
    const { calls, fetchImpl } = fakeFetch(okBody);
    const schema = { type: "object" };
    await createAsk({ apiKey: "k", fetchImpl })({
      instructions: "x",
      input: [{ role: "user", text: "y" }],
      maxOutputTokens: 10,
      jsonSchema: { name: "classification", schema },
    });
    const body = JSON.parse(calls[0].init.body as string);
    expect(body.text.format).toEqual({
      type: "json_schema",
      name: "classification",
      schema,
      strict: true,
    });
  });

  it("sends reasoning effort only when configured", async () => {
    vi.stubEnv("OPENAI_MODEL", "m");
    vi.stubEnv("OPENAI_REASONING_EFFORT", "low");
    const { calls, fetchImpl } = fakeFetch(okBody);
    await createAsk({ apiKey: "k", fetchImpl })({
      instructions: "x",
      input: [{ role: "user", text: "y" }],
      maxOutputTokens: 10,
    });
    expect(JSON.parse(calls[0].init.body as string).reasoning).toEqual({ effort: "low" });
  });

  it("returns the concatenated output_text parts", async () => {
    vi.stubEnv("OPENAI_MODEL", "m");
    const { fetchImpl } = fakeFetch(okBody);
    const text = await createAsk({ apiKey: "k", fetchImpl })({
      instructions: "x",
      input: [{ role: "user", text: "y" }],
      maxOutputTokens: 10,
    });
    expect(text).toBe("Hello there");
  });

  it("keeps Greek and emoji text unchanged in the request body", async () => {
    vi.stubEnv("OPENAI_MODEL", "m");
    const { calls, fetchImpl } = fakeFetch(okBody);
    const message = "Καλημέρα, θα ήθελα τραπέζι για 4 😊";
    await createAsk({ apiKey: "k", fetchImpl })({
      instructions: "x",
      input: [{ role: "user", text: message }],
      maxOutputTokens: 10,
    });
    expect(JSON.parse(calls[0].init.body as string).input[0].content).toBe(message);
  });

  it("rejects with the status code on a non-2xx response", async () => {
    vi.stubEnv("OPENAI_MODEL", "m");
    const { fetchImpl } = fakeFetch({ error: "nope" }, 429);
    await expect(
      createAsk({ apiKey: "k", fetchImpl })({
        instructions: "x",
        input: [{ role: "user", text: "y" }],
        maxOutputTokens: 10,
      }),
    ).rejects.toThrow("429");
  });

  it("rejects clearly when no model is configured", async () => {
    vi.stubEnv("OPENAI_MODEL", "");
    const { fetchImpl } = fakeFetch(okBody);
    await expect(
      createAsk({ apiKey: "k", fetchImpl })({
        instructions: "x",
        input: [{ role: "user", text: "y" }],
        maxOutputTokens: 10,
      }),
    ).rejects.toThrow("OPENAI_MODEL");
  });
});
