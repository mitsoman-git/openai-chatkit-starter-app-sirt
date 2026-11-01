// Live opening status from the website's own settings (the owner edits them in the desk).
// Fetched with a short timeout and cached; on any failure the agent simply keeps the prompt's rules.
const TTL_MS = 5 * 60 * 1000;

export type SiteStatus = {
  open_days?: string[];
  opening_time?: string | null;
  closing_time?: string | null;
  takeaway_close?: string | null;
  open_sundays?: string[];
  closed_dates?: string[];
};

let cache: { at: number; value: SiteStatus | null } | null = null;

export async function loadSiteStatus(fetchImpl: typeof fetch = fetch): Promise<SiteStatus | null> {
  const url = process.env.SITE_STATUS_URL;
  if (!url) return null;
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;
  let value: SiteStatus | null = null;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(2500) });
    if (res.ok) value = (await res.json()) as SiteStatus;
  } catch {
    value = cache?.value ?? null; // keep the last good answer if the website is slow
  }
  cache = { at: Date.now(), value };
  return value;
}

export function resetSiteStatusCache(): void {
  cache = null;
}

const list = (a?: string[]) => (a && a.length ? a.join(", ") : "none");

const DAY = 86_400_000;
const ms = (iso: string) => Date.parse(`${iso}T12:00:00Z`);
const isSunday = (t: number) => new Date(t).getUTCDay() === 0;

/** Collapse closed dates into ranges; a gap of only Sundays does not break a range (Sundays are closed anyway). */
export function closedRanges(dates: string[]): string[] {
  const sorted = [...dates].sort();
  const out: string[] = [];
  let start = "", prev = "";
  const flush = () => { if (start) out.push(start === prev ? start : `${start} to ${prev}`); };
  for (const d of sorted) {
    const gapOk = prev && (ms(d) - ms(prev) === DAY || (ms(d) - ms(prev) === 2 * DAY && isSunday(ms(prev) + DAY)));
    if (gapOk) prev = d;
    else { flush(); start = d; prev = d; }
  }
  flush();
  return out;
}

export function statusLine(s: SiteStatus | null, now: Date = new Date()): string {
  if (!s) return "";
  const today = now.toISOString().slice(0, 10);
  const openSundays = (s.open_sundays ?? []).filter((d) => d >= today);
  const closed = closedRanges((s.closed_dates ?? []).filter((d) => d >= today));
  const hours = s.opening_time && s.closing_time ? ` Dinner hours: ${s.opening_time}-${s.closing_time}.` : "";
  return (
    `LIVE OPENING STATUS (from the restaurant's own settings, newer than anything above): ` +
    `Sundays are closed unless listed here as open: ${list(openSundays)}. ` +
    `Days closed as an exception (ranges, Sundays inside a range are closed too): ${list(closed)}.${hours} ` +
    `For "are you open today / on <date>" questions, use this together with the CURRENT DATE calendar: ` +
    `a date inside a closed range is closed; a Sunday is open only if listed; every other day is open for dinner. ` +
    `The season-closing rule (nothing after Friday 6 November 2026) still applies to what you offer for bookings. Never mention these settings or this list to the guest.`
  );
}
