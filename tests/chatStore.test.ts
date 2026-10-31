import { describe, expect, it } from "vitest";
import { loadChat, saveChat, type StorageLike } from "../lib/chatStore";

function memoryStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = v;
    },
  };
}

const NOW = new Date("2026-10-31T12:00:00Z");

describe("chatStore", () => {
  it("restores what was saved, including the session id", () => {
    const s = memoryStorage();
    const turns = [
      { role: "user" as const, text: "hi" },
      { role: "assistant" as const, text: "hello" },
    ];
    saveChat(s, { sessionId: "sess-12345678", turns }, NOW);
    expect(loadChat(s, NOW)).toEqual({ sessionId: "sess-12345678", turns });
  });

  it("returns null when nothing is stored or the data is garbage", () => {
    expect(loadChat(memoryStorage(), NOW)).toBeNull();
    expect(loadChat(memoryStorage({ "sirtaki-chat": "{not json" }), NOW)).toBeNull();
    expect(loadChat(memoryStorage({ "sirtaki-chat": JSON.stringify({ sessionId: 5, turns: [] }) }), NOW)).toBeNull();
  });

  it("drops a trailing user turn that never got a reply", () => {
    const s = memoryStorage();
    saveChat(
      s,
      {
        sessionId: "sess-12345678",
        turns: [
          { role: "user", text: "a" },
          { role: "assistant", text: "b" },
          { role: "user", text: "c" },
        ],
      },
      NOW,
    );
    expect(loadChat(s, NOW)!.turns).toEqual([
      { role: "user", text: "a" },
      { role: "assistant", text: "b" },
    ]);
  });

  it("forgets conversations idle for more than 3 hours", () => {
    const s = memoryStorage();
    saveChat(s, { sessionId: "sess-12345678", turns: [{ role: "assistant", text: "x" }] }, NOW);
    expect(loadChat(s, new Date(NOW.getTime() + 2 * 3600_000))).not.toBeNull();
    expect(loadChat(s, new Date(NOW.getTime() + 4 * 3600_000))).toBeNull();
  });

  it("keeps only the last 40 turns", () => {
    const s = memoryStorage();
    const turns = Array.from({ length: 60 }, (_, i) => ({
      role: i % 2 === 0 ? ("user" as const) : ("assistant" as const),
      text: `m${i}`,
    }));
    saveChat(s, { sessionId: "sess-12345678", turns }, NOW);
    const out = loadChat(s, NOW)!;
    expect(out.turns).toHaveLength(40);
    expect(out.turns.at(-1)!.text).toBe("m59");
  });

  it("never throws when storage is unavailable", () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => saveChat(broken, { sessionId: "sess-12345678", turns: [] }, NOW)).not.toThrow();
    expect(loadChat(broken, NOW)).toBeNull();
  });
});
