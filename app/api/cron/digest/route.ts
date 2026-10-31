import { createDb } from "../../../../lib/db";
import { createDigestHandler } from "../../../../lib/digestHandler";

export const runtime = "nodejs";
export const maxDuration = 30;
export const dynamic = "force-dynamic";

export const GET = createDigestHandler({ db: createDb(), fetch, env: process.env });
