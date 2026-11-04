// Group-booking buttons in the chat (WhatsApp / email-via-contact-page): recognise them on click so the
// site can notify the owner's Sirtaki Desk, exactly like the large-party window on the reservation page.

export const CLICK_URL = "https://www.sirtaki-tavern.gr/reserve-click.php";

export type LeadClick = { channel: "wa" | "email"; party: number; date: string; time: string };

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

/** "Thursday 5 November 2026" -> "2026-11-05" ("" when it cannot be read). */
export function isoFromEnglishDate(text: string): string {
  const m = /(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/.exec(text);
  if (!m) return "";
  const month = MONTHS.indexOf(m[2].toLowerCase()) + 1;
  const day = Number(m[1]);
  if (!month || day < 1 || day > 31) return "";
  return `${m[3]}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseLeadClick(href: string): LeadClick | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  let channel: "wa" | "email";
  let text: string;
  if (url.hostname === "wa.me") {
    channel = "wa";
    text = url.searchParams.get("text") ?? "";
  } else if (/(^|\.)sirtaki-tavern\.gr$/.test(url.hostname) && /^\/contact/.test(url.pathname)) {
    channel = "email";
    text = url.searchParams.get("message") ?? "";
  } else {
    return null;
  }
  const party = /for\s+(\d{1,2})\s+(?:people|persons|guests)/i.exec(text);
  if (!party) return null;
  const when = /\bon\s+(.+?)\s+at\s+([01]?\d|2[0-3]):([0-5]\d)/i.exec(text);
  return {
    channel,
    party: Number(party[1]),
    date: when ? isoFromEnglishDate(when[1]) : "",
    time: when ? `${when[2].padStart(2, "0")}:${when[3]}` : "",
  };
}

/** Fire-and-forget: never blocks or breaks the guest's click. */
export function reportLeadClick(lead: LeadClick, lang: string, send: typeof fetch = fetch): void {
  try {
    const body = new URLSearchParams({ channel: lead.channel, party: String(lead.party), date: lead.date, time: lead.time, lang, src: "agent" });
    void send(CLICK_URL, {
      method: "POST",
      mode: "no-cors",
      keepalive: true,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    }).catch(() => {});
  } catch {
    /* ignore */
  }
}
