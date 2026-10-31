import { createPostHandler } from "../../../lib/chatHandler";
import { createDb } from "../../../lib/db";
import { createAsk } from "../../../lib/openai";

export const runtime = "nodejs";
export const maxDuration = 30;

export const POST = createPostHandler({ ask: createAsk(), db: createDb() });
