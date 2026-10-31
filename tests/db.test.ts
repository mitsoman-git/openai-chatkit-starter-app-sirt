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
      { session_id: "s1", first_text: "hi", message_count: "4", last_at: "2026-10-31T10:00:00Z", starred: true },
    ]);
    const out = await createDb(sql).listSessions({ limit: 10 });
    expect(out).toEqual([
      { sessionId: "s1", firstText: "hi", messageCount: 4, lastAt: "2026-10-31T10:00:00Z", starred: true },
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

describe("listSessions filters", () => {
  it("passes the Athens date range and category as parameters, never inline", async () => {
    const { sql, calls } = recordingSql();
    await createDb(sql).listSessions({ from: "2026-10-01", to: "2026-10-31", category: "reserve", limit: 50 });
    expect(calls[0].text).toContain("Europe/Athens");
    expect(calls[0].text).not.toContain("2026-10-01");
    expect(calls[0].values).toEqual(expect.arrayContaining(["2026-10-01", "2026-10-31", "reserve", 50]));
  });

  it("passes nulls when no filter is given", async () => {
    const { sql, calls } = recordingSql();
    await createDb(sql).listSessions();
    expect(calls[0].values).toEqual([null, null, null, null, null, null, null, 100]);
  });
});

describe("daysWithActivity", () => {
  it("maps day rows to counts for the given month", async () => {
    const { sql, calls } = recordingSql([
      { day: "2026-10-30", sessions: "3" },
      { day: "2026-10-31", sessions: "1" },
    ]);
    const out = await createDb(sql).daysWithActivity("2026-10");
    expect(out).toEqual({ "2026-10-30": 3, "2026-10-31": 1 });
    expect(calls[0].values).toEqual(["2026-10"]);
    expect(calls[0].text).toContain("Europe/Athens");
  });
});

describe("deleteSession / deleteDay", () => {
  it("deletes only the rows of the given session", async () => {
    const { sql, calls } = recordingSql();
    await createDb(sql).deleteSession("s1");
    expect(calls[0].text).toContain("delete from messages");
    expect(calls[0].text).toContain("session_id =");
    expect(calls[0].values).toEqual(["s1"]);
  });

  it("deletes the rows of one Athens day, date passed as a parameter", async () => {
    const { sql, calls } = recordingSql();
    await createDb(sql).deleteDay("2026-10-31");
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toContain("delete from messages");
    expect(calls[0].text).toContain("Europe/Athens");
    expect(calls[0].values).toEqual(["2026-10-31"]);
  });
});

describe("stars", () => {
  it("toggles a star for one session using a parameter", async () => {
    const { sql, calls } = recordingSql();
    await createDb(sql).toggleStar("s1");
    expect(calls).toHaveLength(1);
    expect(calls[0].text).toContain("starred_sessions");
    expect(calls[0].values).toEqual(expect.arrayContaining(["s1"]));
    expect(calls[0].text).not.toContain("s1");
  });

  it("filters to starred sessions across all dates", async () => {
    const { sql, calls } = recordingSql();
    await createDb(sql).listSessions({ starredOnly: true });
    expect(calls[0].values).toContain(true);
    expect(calls[0].text).toContain("starred_sessions");
  });

  it("reports whether a session is starred", async () => {
    const { sql } = recordingSql([{ session_id: "s1" }]);
    expect(await createDb(sql).isStarred("s1")).toBe(true);
    const { sql: empty } = recordingSql([]);
    expect(await createDb(empty).isStarred("s1")).toBe(false);
  });

  it("deleteDay keeps starred sessions", async () => {
    const { sql, calls } = recordingSql();
    await createDb(sql).deleteDay("2026-10-31");
    expect(calls[0].text).toContain("starred_sessions");
    expect(calls[0].text).toContain("not in");
  });

  it("deleteSession also removes the star", async () => {
    const { sql, calls } = recordingSql();
    await createDb(sql).deleteSession("s1");
    expect(calls.map((c) => c.text).join("\n")).toContain("delete from starred_sessions");
  });
});

describe("messagesOfDay", () => {
  it("selects one Athens day by parameter and maps rows", async () => {
    const { sql, calls } = recordingSql([
      { session_id: "s1", role: "user", text: "hi", category: null, created_at: "t1", starred: true },
    ]);
    const out = await createDb(sql).messagesOfDay("2026-10-31");
    expect(out).toEqual([{ sessionId: "s1", role: "user", text: "hi", category: null, createdAt: "t1", starred: true }]);
    expect(calls[0].values).toEqual(["2026-10-31"]);
    expect(calls[0].text).toContain("Europe/Athens");
  });
});
