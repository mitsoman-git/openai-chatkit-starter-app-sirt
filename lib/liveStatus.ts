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

export function statusLine(s: SiteStatus | null): string {
  if (!s) return "";
  const hours = s.opening_time && s.closing_time ? ` Dinner hours on the website settings: ${s.opening_time}-${s.closing_time}.` : "";
  return (
    `LIVE OPENING STATUS (from the restaurant's own settings, newer than anything above): ` +
    `regular open days: ${list(s.open_days)}. Sundays that are open as an exception: ${list(s.open_sundays)}. ` +
    `Days closed as an exception: ${list(s.closed_dates)}.${hours} ` +
    `For "are you open today / on <date>" questions, use this list together with the CURRENT DATE calendar: ` +
    `a date listed under closed days is closed; a Sunday is open only if it is listed under open Sundays; other weekdays follow the regular open days. ` +
    `The season-closing rule (nothing after Friday 6 November 2026) still applies. Never mention these settings or this list to the guest.`
  );
}
