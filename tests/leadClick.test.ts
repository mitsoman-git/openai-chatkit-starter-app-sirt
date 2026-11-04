import { describe, expect, it, vi } from "vitest";
import { isoFromEnglishDate, parseLeadClick, reportLeadClick } from "../lib/leadClick";

const WA = "https://wa.me/306942662051?text=Hello%20Sirtaki!%20I%20would%20like%20to%20book%20a%20table%20for%2011%20people%20on%20Thursday%205%20November%202026%20at%2018%3A00";
const MAIL =
  "https://www.sirtaki-tavern.gr/contact?subject=Large%20party%20booking%20request&message=Hello%20Sirtaki%2C%0A%0AWe%20would%20like%20to%20book%20a%20table%20for%2011%20people%20on%20Thursday%205%20November%202026%20at%2018%3A00.%0A%0AThank%20you!#contact";

describe("parseLeadClick", () => {
  it("reads the WhatsApp group link", () => {
    expect(parseLeadClick(WA)).toEqual({ channel: "wa", party: 11, date: "2026-11-05", time: "18:00" });
  });
  it("reads the contact-page email link", () => {
    expect(parseLeadClick(MAIL)).toEqual({ channel: "email", party: 11, date: "2026-11-05", time: "18:00" });
  });
  it("reads the event link", () => {
    expect(parseLeadClick("https://wa.me/306942662051?text=I%20would%20like%20to%20plan%20an%20event%20for%2025%20people%20on%206%20November%202026%20at%2020%3A00")).toMatchObject({ party: 25, date: "2026-11-06", time: "20:00" });
  });
  it("ignores other links and plain WhatsApp contact", () => {
    expect(parseLeadClick("https://wa.me/306942662051")).toBeNull();
    expect(parseLeadClick("https://example.com/?text=for%2011%20people")).toBeNull();
    expect(parseLeadClick("not a url")).toBeNull();
  });
  it("keeps the party when the date is unreadable", () => {
    expect(parseLeadClick("https://wa.me/306942662051?text=table%20for%2012%20people")).toEqual({ channel: "wa", party: 12, date: "", time: "" });
  });
});

describe("isoFromEnglishDate", () => {
  it("handles junk", () => expect(isoFromEnglishDate("tomorrow")).toBe(""));
});

describe("reportLeadClick", () => {
  it("posts urlencoded and never throws", () => {
    const send = vi.fn().mockResolvedValue(new Response(null));
    reportLeadClick({ channel: "wa", party: 11, date: "2026-11-05", time: "18:00" }, "el", send as unknown as typeof fetch);
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][1].body).toBe("channel=wa&party=11&date=2026-11-05&time=18%3A00&lang=el&src=agent");
    expect(() => reportLeadClick({ channel: "wa", party: 1, date: "", time: "" }, "en", (() => { throw new Error("x"); }) as unknown as typeof fetch)).not.toThrow();
  });
});
