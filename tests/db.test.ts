import { describe, expect, it } from "vitest";
import { createDb, type Sql } from "../lib/db";

function recordingSql(rows: unknown[] = []) {
  const calls: { text: string; values: unknown[] }[] = [];
  const sql: Sql = async (strings, ...values) => {
    calls.push({ text: strings.join("?"), values });
    return rows;
  };
  return { sql, calls };
}

describe("logExchange", () => {
  it("inserts a user row and an assistant row with the same session", async () => {
    const { sql, calls } = recordingSql();
    const text = "Καλημέρα 😊 τραπέζι για 4";
    await createDb(sql).logExchange({
      sessionId: "sess-12345678",
      userText: text,
      replyText: "Sure",
      category: "reserve",
    });
    expect(calls).toHaveLength(2);
    expect(calls[0].values).toEqual(["sess-12345678", "user", text, null]);
    expect(calls[1].values).toEqual(["sess-12345678", "assistant", "Sure", "reserve"]);
    for (const c of calls) {
      expect(c.text).toContain("insert into messages");
      expect(c.text).not.toContain(text);
    }
  });
});

describe("listSessions / getSession", () => {
  it("maps session summary rows", async () => {
    const { sql, calls } = recordingSql([
      { session_id: "s1", first_text: "hi", message_count: "4", last_at: "2026-10-31T10:00:00Z" },
    ]);
    const out = await createDb(sql).listSessions(10);
    expect(out).toEqual([
      { sessionId: "s1", firstText: "hi", messageCount: 4, lastAt: "2026-10-31T10:00:00Z" },
    ]);
    expect(calls[0].values).toContain(10);
  });

  it("maps stored message rows in the returned order", async () => {
    const { sql, calls } = recordingSql([
      { id: "1", session_id: "s1", role: "user", text: "a", category: null, created_at: "t1" },
      { id: "2", session_id: "s1", role: "assistant", text: "b", category: "meze", created_at: "t2" },
    ]);
    const out = await createDb(sql).getSession("s1");
    expect(out).toEqual([
      { id: 1, sessionId: "s1", role: "user", text: "a", category: null, createdAt: "t1" },
      { id: 2, sessionId: "s1", role: "assistant", text: "b", category: "meze", createdAt: "t2" },
    ]);
    expect(calls[0].values).toEqual(["s1"]);
  });
});
