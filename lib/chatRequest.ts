import { MAX_HISTORY_TURNS, MAX_MESSAGE_CHARS } from "./chat";
import type { Turn } from "./types";

export type ChatBody = { message: string; history: Turn[]; sessionId: string };

const MAX_HISTORY_TEXT_CHARS = 4000;
const SESSION_ID = /^[A-Za-z0-9-]{8,64}$/;

type Parsed = { ok: true; value: ChatBody } | { ok: false; error: string };

export function parseChatBody(body: unknown): Parsed {
  if (typeof body !== "object" || body === null) return { ok: false, error: "Invalid request" };
  const { message, history, sessionId } = body as Record<string, unknown>;

  if (typeof message !== "string" || message.trim() === "") return { ok: false, error: "Message is required" };
  const text = message.trim();
  if (text.length > MAX_MESSAGE_CHARS) return { ok: false, error: "Message is too long" };

  if (typeof sessionId !== "string" || !SESSION_ID.test(sessionId)) {
    return { ok: false, error: "Invalid session" };
  }

  let turns: Turn[] = [];
  if (history !== undefined) {
    if (!Array.isArray(history)) return { ok: false, error: "Invalid history" };
    for (const item of history) {
      const t = item as { role?: unknown; text?: unknown };
      if ((t?.role !== "user" && t?.role !== "assistant") || typeof t.text !== "string") {
        return { ok: false, error: "Invalid history" };
      }
      turns.push({ role: t.role, text: t.text.slice(0, MAX_HISTORY_TEXT_CHARS) });
    }
    turns = turns.slice(-MAX_HISTORY_TURNS);
  }

  return { ok: true, value: { message: text, history: turns, sessionId } };
}
