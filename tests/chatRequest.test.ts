import { describe, expect, it } from "vitest";
import { parseChatBody } from "../lib/chatRequest";

const sessionId = "abcd-1234-efgh";

describe("parseChatBody", () => {
  it("accepts a valid body and trims the message", () => {
    const r = parseChatBody({ message: "  hi  ", sessionId });
    expect(r).toEqual({ ok: true, value: { message: "hi", history: [], sessionId } });
  });

  it.each([
    ["empty", ""],
    ["whitespace", "   "],
    ["a number", 42],
    ["missing", undefined],
    ["1001 chars", "a".repeat(1001)],
  ])("rejects a %s message", (_n, message) => {
    expect(parseChatBody({ message, sessionId }).ok).toBe(false);
  });

  it("accepts a 1000-char message", () => {
    expect(parseChatBody({ message: "a".repeat(1000), sessionId }).ok).toBe(true);
  });

  it("rejects a non-object body", () => {
    expect(parseChatBody(null).ok).toBe(false);
    expect(parseChatBody("hello").ok).toBe(false);
  });

  it("keeps only the last 20 history turns", () => {
    const history = Array.from({ length: 25 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      text: `t${i}`,
    }));
    const r = parseChatBody({ message: "hi", sessionId, history });
    expect(r.ok && r.value.history).toHaveLength(20);
    expect(r.ok && r.value.history[0].text).toBe("t5");
  });

  it("truncates a history text to 4000 chars", () => {
    const r = parseChatBody({
      message: "hi",
      sessionId,
      history: [{ role: "user", text: "x".repeat(5000) }],
    });
    expect(r.ok && r.value.history[0].text).toHaveLength(4000);
  });

  it.each(["system", "developer"])("rejects a %s role in history", (role) => {
    expect(parseChatBody({ message: "hi", sessionId, history: [{ role, text: "x" }] }).ok).toBe(false);
  });

  it("rejects a non-string history text", () => {
    expect(parseChatBody({ message: "hi", sessionId, history: [{ role: "user", text: 5 }] }).ok).toBe(false);
  });

  it.each(["short", "has space 12345", "x".repeat(65), "bad/chars-123"])(
    "rejects sessionId %s",
    (id) => {
      expect(parseChatBody({ message: "hi", sessionId: id }).ok).toBe(false);
    },
  );
});
