import { athensToday, isDay } from "./adminCalendar";
import { buildDigest, type DayMessage } from "./digest";

type Deps = {
  db: { messagesOfDay(day: string): Promise<DayMessage[]> };
  fetch: typeof fetch;
  env: Record<string, string | undefined>;
  now?: () => Date;
};

const DEFAULT_MAIL_URL = "https://www.sirtaki-tavern.gr/wifi/chat-digest.php";

/** The conversations to report when the cron runs: Athens day of (now - 3h), so a run at 23:00-01:00 Athens still gets that evening. */
export function digestDay(now: Date): string {
  return athensToday(new Date(now.getTime() - 3 * 3600_000));
}

export function createDigestHandler({ db, fetch: doFetch, env, now = () => new Date() }: Deps) {
  return async function GET(req: Request): Promise<Response> {
    const secret = env.CRON_SECRET;
    if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
      return new Response("Unauthorized", { status: 401 });
    }
    const asked = new URL(req.url).searchParams.get("day");
    if (asked !== null && !isDay(asked)) return new Response("Bad day", { status: 400 });
    const day = asked ?? digestDay(now());

    const { subject, text } = buildDigest(day, await db.messagesOfDay(day));
    const res = await doFetch(env.DIGEST_URL || DEFAULT_MAIL_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Digest-Token": secret },
      body: JSON.stringify({ subject, text }),
    });
    if (!res.ok) return Response.json({ ok: false, day, mailStatus: res.status }, { status: 502 });
    return Response.json({ ok: true, day, subject });
  };
}
