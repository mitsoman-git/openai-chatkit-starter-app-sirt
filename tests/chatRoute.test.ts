import { describe, expect, it, vi } from "vitest";
import { createPostHandler } from "../lib/chatHandler";
import { ERROR_REPLY } from "../lib/chat";
import type { Ask, AskArgs } from "../lib/openai";

const sessionId = "abcd-1234-efgh";

function makeAsk(mainReply: string | Error = "the reply") {
  const calls: AskArgs[] = [];
  const ask: Ask = async (args) => {
    calls.push(args);
    if (args.jsonSchema?.name === "classification") return '{"classification":"get_information"}';
    if (args.jsonSchema?.name === "jailbreak_check") return '{"jailbreak":false,"confidence":0}';
    if (mainReply instanceof Error) throw mainReply;
    return mainReply;
  };
  return { ask, calls };
}

function makeDb(fail = false) {
  const logExchange = vi.fn(async () => {
    if (fail) throw new Error("db down");
  });
  return { logExchange, listSessions: vi.fn(), getSession: vi.fn(), deleteSession: vi.fn(), deleteDay: vi.fn(), daysWithActivity: vi.fn(), toggleStar: vi.fn(), isStarred: vi.fn(), messagesOfDay: vi.fn() };
}

const post = (body: unknown) =>
  new Request("http://x/api/chat", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

describe("POST /api/chat", () => {
  it("answers and logs the exchange with its category", async () => {
    const { ask } = makeAsk();
    const db = makeDb();
    const res = await createPostHandler({ ask, db })(post({ message: "Καλημέρα", sessionId }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: "the reply" });
    expect(db.logExchange).toHaveBeenCalledWith({
      sessionId,
      userText: "Καλημέρα",
      replyText: "the reply",
      category: "get_information",
    });
  });

  it.each([["invalid JSON", "{nope"], ["invalid body", { message: "", sessionId }]])(
    "returns 400 for %s without calling OpenAI",
    async (_n, body) => {
      const { ask, calls } = makeAsk();
      const res = await createPostHandler({ ask, db: makeDb() })(post(body));
      expect(res.status).toBe(400);
      expect(calls).toHaveLength(0);
    },
  );

  it("returns the error reply and logs category error when the main call fails", async () => {
    const { ask } = makeAsk(new Error("openai down"));
    const db = makeDb();
    const res = await createPostHandler({ ask, db })(post({ message: "hi", sessionId }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: ERROR_REPLY });
    expect(db.logExchange).toHaveBeenCalledWith({
      sessionId,
      userText: "hi",
      replyText: ERROR_REPLY,
      category: "error",
    });
  });

  it("still answers when logging fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { ask } = makeAsk();
    const res = await createPostHandler({ ask, db: makeDb(true) })(post({ message: "hi", sessionId }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reply: "the reply" });
  });
});
