import { afterEach, describe, expect, it, vi } from "vitest";
import { createAsk, type Ask, type AskArgs } from "../lib/openai";
import { containsCardNumber, FALLBACK_REPLY, isJailbreak, redactCardNumbers } from "../lib/guardrails";
import { respond, ERROR_REPLY } from "../lib/chat";
import { createPostHandler } from "../lib/chatHandler";
import { tokenizeLine } from "../lib/formatReply";
import { parseChatBody } from "../lib/chatRequest";

afterEach(() => vi.unstubAllEnvs());

const okBody = { output: [{ type: "message", content: [{ type: "output_text", text: "hi" }] }] };
const askArgs = { instructions: "x", input: [{ role: "user" as const, text: "y" }], maxOutputTokens: 10 };

function fakeFetch(body: unknown) {
  const calls: { init: RequestInit }[] = [];
  const fetchImpl = (async (_u: string, init: RequestInit) => {
    calls.push({ init });
    return new Response(JSON.stringify(body), { status: 200 });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}

describe("openai hardening", () => {
  it("does not send reasoning when an explicit model is given", async () => {
    vi.stubEnv("OPENAI_REASONING_EFFORT", "low");
    const { calls, fetchImpl } = fakeFetch(okBody);
    await createAsk({ apiKey: "k", fetchImpl })({ ...askArgs, model: "gpt-4.1-mini" });
    expect(JSON.parse(calls[0].init.body as string)).not.toHaveProperty("reasoning");
  });

  it("rejects an incomplete response", async () => {
    vi.stubEnv("OPENAI_MODEL", "m");
    const { fetchImpl } = fakeFetch({ ...okBody, status: "incomplete" });
    await expect(createAsk({ apiKey: "k", fetchImpl })(askArgs)).rejects.toThrow("incomplete");
  });

  it("rejects an empty reply", async () => {
    vi.stubEnv("OPENAI_MODEL", "m");
    const { fetchImpl } = fakeFetch({ output: [{ type: "reasoning" }] });
    await expect(createAsk({ apiKey: "k", fetchImpl })(askArgs)).rejects.toThrow("empty");
  });
});

describe("card detection hardening", () => {
  it("never blocks 00-prefixed or +-prefixed phone numbers", () => {
    let seed = 12345;
    for (let i = 0; i < 1000; i++) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      const tail = String(seed).padStart(10, "0").slice(-8);
      expect(containsCardNumber(`call me on 003069${tail}`)).toBe(false);
      expect(containsCardNumber(`+3069${tail}`)).toBe(false);
    }
  });

  it("redacts card numbers and keeps the rest", () => {
    expect(redactCardNumbers("pay 4111 1111 1111 1111 ok, table for 4 at 20:45")).toBe(
      "pay [card number removed] ok, table for 4 at 20:45",
    );
  });

  it("leaves text without a card number unchanged", () => {
    expect(redactCardNumbers("Καλημέρα +30 6942662051")).toBe("Καλημέρα +30 6942662051");
  });

  it("gives the guard call a 6s timeout", async () => {
    let t: number | undefined;
    await isJailbreak("hi", async (a) => {
      t = a.timeoutMs;
      return '{"jailbreak":false,"confidence":0}';
    });
    expect(t).toBe(6000);
  });
});

function scripted(classification = "get_information") {
  const calls: AskArgs[] = [];
  const ask: Ask = async (a) => {
    calls.push(a);
    if (a.jsonSchema?.name === "classification") return JSON.stringify({ classification });
    if (a.jsonSchema?.name === "jailbreak_check") return '{"jailbreak":false,"confidence":0}';
    return "reply";
  };
  return { ask, calls };
}

describe("respond hardening", () => {
  it("removes card numbers from history before the model sees them", async () => {
    const { ask, calls } = scripted();
    await respond(
      {
        message: "ok, how do I book?",
        history: [
          { role: "user", text: "my card is 4111 1111 1111 1111" },
          { role: "assistant", text: FALLBACK_REPLY },
        ],
      },
      ask,
    );
    const main = calls.find((c) => !c.jsonSchema)!;
    expect(JSON.stringify(main.input)).not.toContain("4111");
    expect(main.input[0].text).toBe("my card is [card number removed]");
  });

  it("gives the classifier 6s and the main call 18s", async () => {
    const { ask, calls } = scripted("meze");
    await respond({ message: "hello", history: [] }, ask);
    expect(calls.find((c) => c.jsonSchema?.name === "classification")!.timeoutMs).toBe(6000);
    expect(calls.find((c) => !c.jsonSchema)!.timeoutMs).toBe(18000);
  });
});

describe("handler logging hardening", () => {
  it("never stores a card number", async () => {
    const { ask } = scripted();
    const logExchange = vi.fn(async () => {});
    const db = { logExchange, listSessions: vi.fn(), getSession: vi.fn(), deleteSession: vi.fn(), deleteDay: vi.fn(), daysWithActivity: vi.fn() };
    const req = new Request("http://x/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "my card 4111 1111 1111 1111 thanks", sessionId: "abcd-1234-efgh" }),
    });
    await createPostHandler({ ask, db })(req);
    const arg = (logExchange.mock.calls[0] as unknown as [{ userText: string; category: string }])[0];
    expect(arg.category).toBe("blocked");
    expect(arg.userText).not.toContain("4111");
    expect(ERROR_REPLY.length).toBeGreaterThan(0);
  });
});

describe("tokenizeLine with bold links", () => {
  it("keeps a link inside bold clickable", () => {
    expect(tokenizeLine("**[Book on WhatsApp](https://wa.me/306942662051)**")).toEqual([
      { type: "link", text: "Book on WhatsApp", href: "https://wa.me/306942662051" },
    ]);
  });

  it("keeps surrounding text around a bold link", () => {
    const tokens = tokenizeLine("**Go: [Map](https://maps.google.com/x)** now");
    expect(tokens.some((t) => t.type === "link" && t.href === "https://maps.google.com/x")).toBe(true);
    expect(tokens.at(-1)).toEqual({ type: "text", text: " now" });
  });
});

describe("parseChatBody total history cap", () => {
  it("keeps the newest turns within 12000 characters in total", () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      text: `${i}`.padEnd(4000, "x"),
    }));
    const r = parseChatBody({ message: "hi", sessionId: "abcd-1234-efgh", history });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.history.reduce((n, t) => n + t.text.length, 0)).toBeLessThanOrEqual(12000);
      expect(r.value.history.at(-1)?.text.startsWith("9")).toBe(true);
    }
  });
});
