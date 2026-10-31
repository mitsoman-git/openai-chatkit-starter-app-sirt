import { ERROR_REPLY, respond } from "./chat";
import { parseChatBody } from "./chatRequest";
import type { createDb } from "./db";
import type { Ask } from "./openai";

type Deps = { ask: Ask; db: ReturnType<typeof createDb> };

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

export function createPostHandler({ ask, db }: Deps) {
  return async (req: Request): Promise<Response> => {
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
      await db.logExchange({ sessionId, userText: message, replyText: reply, category });
    } catch (error) {
      console.error("logging failed", error);
    }
    return json({ reply });
  };
}
