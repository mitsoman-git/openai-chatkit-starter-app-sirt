import { afterEach, describe, expect, it, vi } from "vitest";
import { FALLBACK_REPLY, containsCardNumber, isJailbreak } from "../lib/guardrails";
import type { Ask, AskArgs } from "../lib/openai";

afterEach(() => vi.unstubAllEnvs());

describe("containsCardNumber", () => {
  it.each([
    "4111111111111111",
    "4111 1111 1111 1111",
    "4111-1111-1111-1111",
    "my card is 4111 1111 1111 1111 please book",
  ])("detects %s", (text) => {
    expect(containsCardNumber(text)).toBe(true);
  });

  it.each([
    "4111111111111112",
    "+30 6942662051",
    "2026-11-05",
    "table for 4 at 20:45",
  ])("ignores %s", (text) => {
    expect(containsCardNumber(text)).toBe(false);
  });
});

describe("isJailbreak", () => {
  const stub = (reply: string | Error): Ask => async () => {
    if (reply instanceof Error) throw reply;
    return reply;
  };

  it("is true at confidence 0.9", async () => {
    expect(await isJailbreak("x", stub('{"jailbreak":true,"confidence":0.9}'))).toBe(true);
  });
  it("is false at confidence 0.5", async () => {
    expect(await isJailbreak("x", stub('{"jailbreak":true,"confidence":0.5}'))).toBe(false);
  });
  it("is false when not a jailbreak", async () => {
    expect(await isJailbreak("x", stub('{"jailbreak":false,"confidence":0.99}'))).toBe(false);
  });
  it("is false when the call throws", async () => {
    expect(await isJailbreak("x", stub(new Error("boom")))).toBe(false);
  });
  it("is false on non-JSON output", async () => {
    expect(await isJailbreak("x", stub("not json"))).toBe(false);
  });

  it("asks with the small model, 100 tokens and the jailbreak_check schema", async () => {
    let seen: AskArgs | undefined;
    await isJailbreak("hello", async (a) => {
      seen = a;
      return '{"jailbreak":false,"confidence":0}';
    });
    expect(seen?.maxOutputTokens).toBe(100);
    expect(seen?.jsonSchema?.name).toBe("jailbreak_check");
    expect(seen?.model).toBe("gpt-4.1-mini");
    expect(seen?.input).toEqual([{ role: "user", text: "hello" }]);
  });

  it("honours OPENAI_GUARD_MODEL", async () => {
    vi.stubEnv("OPENAI_GUARD_MODEL", "guard-x");
    let model: string | undefined;
    await isJailbreak("hello", async (a) => {
      model = a.model;
      return '{"jailbreak":false,"confidence":0}';
    });
    expect(model).toBe("guard-x");
  });
});

describe("FALLBACK_REPLY", () => {
  it("is the exact fallback text", () => {
    expect(FALLBACK_REPLY).toBe(
      "I’m sorry, I can’t handle that topic. Could you try asking about something else?",
    );
  });
});
