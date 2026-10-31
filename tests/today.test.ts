import { describe, expect, it } from "vitest";
import { todayLine } from "../lib/today";
import { respond } from "../lib/chat";
import { loadPrompt } from "../lib/agents/loadPrompt";
import type { Ask, AskArgs } from "../lib/openai";

describe("todayLine", () => {
  it("states the weekday and date in Athens time", () => {
    const line = todayLine(new Date("2026-10-31T10:00:00Z"));
    expect(line).toContain("Saturday, 31 October 2026");
    expect(line).toContain("Europe/Athens");
  });

  it("uses the Athens calendar day, not the UTC one", () => {
    expect(todayLine(new Date("2026-10-31T22:30:00Z"))).toContain("Sunday, 1 November 2026");
  });

  it("tells the model to resolve relative dates and never claim it cannot know the date", () => {
    const line = todayLine(new Date("2026-10-31T10:00:00Z"));
    expect(line).toContain("tomorrow");
    expect(line).toMatch(/never say you (do not|don't|cannot|can't) know/i);
  });
});

describe("respond adds today's date to the main call only", () => {
  const scripted = () => {
    const calls: AskArgs[] = [];
    const ask: Ask = async (a) => {
      calls.push(a);
      if (a.jsonSchema?.name === "classification") return '{"classification":"reserve"}';
      if (a.jsonSchema?.name === "jailbreak_check") return '{"jailbreak":false,"confidence":0}';
      return "ok";
    };
    return { ask, calls };
  };

  it("appends the date line after the unchanged agent prompt", async () => {
    const { ask, calls } = scripted();
    const now = new Date("2026-10-31T10:00:00Z");
    await respond({ message: "table for 2 tomorrow", history: [], now }, ask);
    const main = calls.find((c) => !c.jsonSchema)!;
    expect(main.instructions.startsWith(loadPrompt("reserve"))).toBe(true);
    expect(main.instructions.endsWith(todayLine(now))).toBe(true);
  });

  it("leaves the classifier and the guard prompts without a date", async () => {
    const { ask, calls } = scripted();
    await respond({ message: "hi", history: [], now: new Date("2026-10-31T10:00:00Z") }, ask);
    for (const c of calls.filter((c) => c.jsonSchema)) {
      expect(c.instructions).not.toContain("Saturday, 31 October 2026");
    }
  });
});
