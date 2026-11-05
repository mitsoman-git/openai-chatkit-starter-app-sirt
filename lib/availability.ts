// Free dinner times for a date and party size, read from the website's own availability check
// (the same one the booking page uses). On any failure the agent simply keeps the prompt's rules.
import type { Ask } from "./openai";
import { todayLine } from "./today";
import type { Turn } from "./types";

export type Slots = Record<string, { full?: boolean; blocked?: boolean }>;

function availabilityUrl(): string | null {
  const own = process.env.SITE_AVAILABILITY_URL;
  if (own) return own;
  const status = process.env.SITE_STATUS_URL;
  if (!status) return null;
  try {
    return new URL("/reserve-availability.php", status).toString();
  } catch {
    return null;
  }
}

/** Times (HH:MM) that are neither full nor closed; null when the website could not be asked. */
export async function loadFreeTimes(
  date: string,
  party: number,
  fetchImpl: typeof fetch = fetch,
): Promise<string[] | null> {
  const base = availabilityUrl();
  if (!base) return null;
  try {
    const url = `${base}?date=${encodeURIComponent(date)}&party=${party}`;
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(2500) });
    if (!res.ok) return null;
    const data = (await res.json()) as { success?: boolean; slots?: Slots };
    if (!data.success || !data.slots) return null;
    return Object.entries(data.slots)
      .filter(([, s]) => !s.full && !s.blocked)
      .map(([t]) => t)
      .sort();
  } catch {
    return null;
  }
}

const SCHEMA = {
  type: "object",
  properties: { party: { type: "integer" }, date: { type: "string" } },
  required: ["party", "date"],
  additionalProperties: false,
};

/** Party size and date the guest has settled on so far (0 / "" when not yet known). */
export async function extractBooking(
  turns: Turn[],
  ask: Ask,
  now: Date = new Date(),
): Promise<{ party: number; date: string }> {
  try {
    const raw = await ask({
      instructions:
        `Read this restaurant booking chat. Return the number of guests (party) and the dinner date (date, as YYYY-MM-DD) ` +
        `the guest has settled on, or 0 and "" for whatever is not known yet. Resolve words like today, tomorrow or a weekday ` +
        `with this calendar. ${todayLine(now)}`,
      input: turns.slice(-8),
      maxOutputTokens: 256,
      timeoutMs: 4000,
      jsonSchema: { name: "booking", schema: SCHEMA },
    });
    const v = JSON.parse(raw) as { party?: unknown; date?: unknown };
    const party = Number.isInteger(v.party) ? (v.party as number) : 0;
    const date = typeof v.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v.date) ? v.date : "";
    return { party, date };
  } catch {
    return { party: 0, date: "" };
  }
}

export function freeTimesLine(date: string, party: number, free: string[] | null): string {
  if (free === null) return "";
  const head = `LIVE TABLE AVAILABILITY for ${date}, party of ${party} (from the restaurant's booking system, newer than anything above): `;
  if (free.length === 0) {
    return (
      head +
      `NO free times — that evening is fully booked. In STEP 3 do not ask for a time: say kindly that the day is fully booked, ` +
      `offer another day with the buttons line {{choices: Today | Tomorrow | Another date}} (translated), and mention WhatsApp (https://wa.me/306942662051) as a way to ask the team. Never mention this list to the guest.`
    );
  }
  return (
    head +
    `free times: ${free.join(", ")}. In STEP 3 offer ONLY these times, as tap buttons: pick up to 6 spread over the evening ` +
    `(about every 30 minutes) plus one "Other time" button, in the single line {{choices: 18:30 | 19:00 | ... | Other time}} (translated "Other time"). ` +
    `If the guest types a time that is not in the list, say it is not free and offer the nearest free ones. Never mention this list to the guest.`
  );
}
