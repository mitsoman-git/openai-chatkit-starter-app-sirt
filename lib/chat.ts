import { loadClassifierPrompt, loadPrompt } from "./agents/loadPrompt";
import { FALLBACK_REPLY, containsCardNumber, isJailbreak, redactCardNumbers } from "./guardrails";
import type { Ask } from "./openai";
import { todayLine } from "./today";
import type { Category, Turn } from "./types";

export const MAX_MESSAGE_CHARS = 1000;
export const MAX_HISTORY_TURNS = 20;
export const ERROR_REPLY =
  "I'm sorry, something went wrong on my end — please try again or reach us on WhatsApp.";

const CATEGORIES: Category[] = ["meze", "reserve", "get_information", "greeting"];

const CLASSIFICATION_SCHEMA = {
  type: "object",
  properties: { classification: { type: "string", enum: CATEGORIES } },
  required: ["classification"],
  additionalProperties: false,
};

export async function classify(message: string, ask: Ask): Promise<Category> {
  try {
    const raw = await ask({
      instructions: loadClassifierPrompt(),
      input: [{ role: "user", text: message }],
      maxOutputTokens: 2048,
      timeoutMs: 6000,
      jsonSchema: { name: "classification", schema: CLASSIFICATION_SCHEMA },
    });
    const value = (JSON.parse(raw) as { classification?: unknown }).classification;
    return CATEGORIES.find((c) => c === value) ?? "get_information";
  } catch {
    return "get_information";
  }
}

export async function respond(
  args: { message: string; history: Turn[]; now?: Date },
  ask: Ask,
): Promise<{ reply: string; category: Category | "blocked" }> {
  const { message, history, now } = args;
  if (containsCardNumber(message)) return { reply: FALLBACK_REPLY, category: "blocked" };

  const [jailbreak, category] = await Promise.all([isJailbreak(message, ask), classify(message, ask)]);
  if (jailbreak) return { reply: FALLBACK_REPLY, category: "blocked" };

  const reply = await ask({
    instructions: `${loadPrompt(category)}\n\n${todayLine(now)}`,
    input: [
      ...history.map((t) => ({ ...t, text: redactCardNumbers(t.text) })),
      { role: "user", text: message },
    ],
    maxOutputTokens: 2048,
    timeoutMs: 18000,
  });
  return { reply, category };
}
