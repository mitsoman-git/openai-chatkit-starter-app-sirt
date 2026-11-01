import { ERROR_REPLY, respond } from "./chat";
import { parseChatBody } from "./chatRequest";
import { redactCardNumbers } from "./guardrails";
import type { createDb } from "./db";
import type { Ask } from "./openai";

type Deps = { ask: Ask; db: ReturnType<typeof createDb> };

// Per visitor IP (x-forwarded-for is set by Vercel's edge): protects the three OpenAI calls behind each message.
const RATE_RULES = [
  { max: 12, windowSec: 60 },
  { max: 60, windowSec: 3600 },
];
export const RATE_LIMITED_REPLY = "You're sending messages very quickly — please wait a moment and try again.";

function clientIp(req: Request): string {
  const first = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return first || req.headers.get("x-real-ip") || "unknown";
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function createPostHandler({ ask, db }: Deps) {
  return async (req: Request): Promise<Response> => {
    try {
      if (await db.rateLimited(`chat:${clientIp(req)}`, RATE_RULES)) {
        return json({ error: RATE_LIMITED_REPLY, reply: RATE_LIMITED_REPLY }, 429);
      }
    } catch (error) {
      console.error("rate limit check failed", error); // fail open: never block a guest over our own bookkeeping
    }

    let raw: unknown;
    try {
      raw = await req.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    const parsed = parseChatBody(raw);
    if (!parsed.ok) return json({ error: parsed.error }, 400);
    const { message, history, sessionId } = parsed.value;

    let reply: string;
    let category: string;
    try {
      ({ reply, category } = await respond({ message, history }, ask));
    } catch (error) {
      console.error("chat failed", error);
      reply = ERROR_REPLY;
      category = "error";
    }

    try {
      await db.logExchange({ sessionId, userText: redactCardNumbers(message), replyText: reply, category });
    } catch (error) {
      console.error("logging failed", error);
    }
    return json({ reply });
  };
}
