import { loadClassifierPrompt, loadPrompt } from "./agents/loadPrompt";
import { FALLBACK_REPLY, containsCardNumber, isJailbreak, redactCardNumbers } from "./guardrails";
import type { Ask } from "./openai";
import { loadSiteStatus, statusLine } from "./liveStatus";
import { todayLine } from "./today";
import { buildMapsAllowList, fixMapsLinks } from "./mapsLinks";
import { extractBooking, freeTimesLine, loadFreeTimes } from "./availability";
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

const CLASSIFIER_HISTORY_TURNS = 6;

export async function classify(message: string, ask: Ask, history: Turn[] = []): Promise<Category> {
  try {
    const raw = await ask({
      instructions: loadClassifierPrompt(),
      input: [...history.slice(-CLASSIFIER_HISTORY_TURNS), { role: "user", text: message }],
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

  const safeHistory = history.map((t) => ({ ...t, text: redactCardNumbers(t.text) }));
  const [jailbreak, category] = await Promise.all([
    isJailbreak(message, ask),
    classify(message, ask, safeHistory),
  ]);
  if (jailbreak) return { reply: FALLBACK_REPLY, category: "blocked" };

  const status = statusLine(await loadSiteStatus());
  let times = "";
  if (category === "reserve") {
    const { party, date } = await extractBooking([...safeHistory, { role: "user", text: message }], ask, now);
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Athens" }).format(now ?? new Date());
    if (party >= 1 && party <= 10 && date >= today) {
      times = freeTimesLine(date, party, await loadFreeTimes(date, party));
    }
  }
  const reply = await ask({
    instructions: `${loadPrompt(category)}\n\n${todayLine(now)}${status ? `\n\n${status}` : ""}${times ? `\n\n${times}` : ""}`,
    input: [...safeHistory, { role: "user", text: message }],
    maxOutputTokens: 2048,
    timeoutMs: 18000,
  });
  return { reply: fixMapsLinks(reply, mapsAllowList()), category };
}

let mapsAllow: ReturnType<typeof buildMapsAllowList> | null = null;
function mapsAllowList() {
  if (!mapsAllow) mapsAllow = buildMapsAllowList(loadPrompt("get_information"), loadPrompt("reserve"), loadPrompt("meze"));
  return mapsAllow;
}
