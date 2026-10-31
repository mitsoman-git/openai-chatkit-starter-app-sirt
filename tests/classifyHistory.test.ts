import { describe, expect, it } from "vitest";
import { classify, respond } from "../lib/chat";
import type { Ask, AskArgs } from "../lib/openai";
import type { Turn } from "../lib/types";

const history: Turn[] = [
  { role: "user", text: "I would like a table for 2" },
  { role: "assistant", text: "What date would you like?" },
];

function scripted() {
  const calls: AskArgs[] = [];
  const ask: Ask = async (a) => {
    calls.push(a);
    if (a.jsonSchema?.name === "classification") return '{"classification":"reserve"}';
    if (a.jsonSchema?.name === "jailbreak_check") return '{"jailbreak":false,"confidence":0}';
    return "ok";
  };
  return { ask, calls };
}

describe("classifier sees the conversation", () => {
  it("classify sends the history followed by the latest message", async () => {
    const { ask, calls } = scripted();
    await classify("tomorrow", ask, history);
    expect(calls[0].input).toEqual([...history, { role: "user", text: "tomorrow" }]);
  });

  it("classify keeps only the last 6 turns of history", async () => {
    const { ask, calls } = scripted();
    const long: Turn[] = Array.from({ length: 10 }, (_, i) => ({
      role: i % 2 ? "assistant" : "user",
      text: `t${i}`,
    }));
    await classify("yes", ask, long);
    expect(calls[0].input).toHaveLength(7);
    expect(calls[0].input[0].text).toBe("t4");
  });

  it("respond passes the history to the classifier", async () => {
    const { ask, calls } = scripted();
    await respond({ message: "tomorrow", history }, ask);
    const c = calls.find((x) => x.jsonSchema?.name === "classification")!;
    expect(c.input).toEqual([...history, { role: "user", text: "tomorrow" }]);
  });

  it("respond removes card numbers from the history sent to the classifier", async () => {
    const { ask, calls } = scripted();
    await respond(
      { message: "ok", history: [{ role: "user", text: "card 4111 1111 1111 1111" }] },
      ask,
    );
    const c = calls.find((x) => x.jsonSchema?.name === "classification")!;
    expect(JSON.stringify(c.input)).not.toContain("4111");
  });
});
