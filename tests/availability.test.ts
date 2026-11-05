import { afterEach, describe, expect, it, vi } from "vitest";
import { extractBooking, freeTimesLine, loadFreeTimes } from "../lib/availability";

afterEach(() => vi.unstubAllEnvs());

const slots = {
  "18:00": { full: false, blocked: false },
  "18:15": { full: true, blocked: false },
  "18:45": { full: false, blocked: true },
  "19:00": { full: false, blocked: false },
};

describe("free times", () => {
  it("keeps only slots that are neither full nor closed", async () => {
    vi.stubEnv("SITE_AVAILABILITY_URL", "https://example.test/a.php");
    const f = vi.fn(async (_u: string) => new Response(JSON.stringify({ success: true, slots })));
    expect(await loadFreeTimes("2026-11-06", 2, f as unknown as typeof fetch)).toEqual(["18:00", "19:00"]);
    expect(String(f.mock.calls[0][0])).toContain("date=2026-11-06&party=2");
  });

  it("derives the address from the status URL", async () => {
    vi.stubEnv("SITE_AVAILABILITY_URL", "");
    vi.stubEnv("SITE_STATUS_URL", "https://example.test/api/public-status.php");
    const f = vi.fn(async (_u: string) => new Response(JSON.stringify({ success: true, slots })));
    await loadFreeTimes("2026-11-06", 2, f as unknown as typeof fetch);
    expect(String(f.mock.calls[0][0])).toMatch(/^https:\/\/example\.test\/reserve-availability\.php\?/);
  });

  it("returns null when not configured or the website fails", async () => {
    vi.stubEnv("SITE_AVAILABILITY_URL", "");
    vi.stubEnv("SITE_STATUS_URL", "");
    expect(await loadFreeTimes("2026-11-06", 2, vi.fn() as unknown as typeof fetch)).toBeNull();
    vi.stubEnv("SITE_AVAILABILITY_URL", "https://example.test/a.php");
    const bad = vi.fn(async () => { throw new Error("timeout"); });
    expect(await loadFreeTimes("2026-11-06", 2, bad as unknown as typeof fetch)).toBeNull();
  });
});

describe("availability text for the agent", () => {
  it("lists the free times", () => {
    const t = freeTimesLine("2026-11-06", 2, ["18:00", "19:00"]);
    expect(t).toContain("18:00, 19:00");
    expect(t).toContain("Other time");
  });
  it("says the day is fully booked when nothing is free", () => {
    expect(freeTimesLine("2026-11-06", 2, [])).toContain("fully booked");
  });
  it("adds nothing when availability is unknown", () => {
    expect(freeTimesLine("2026-11-06", 2, null)).toBe("");
  });
});

describe("booking extraction", () => {
  it("reads party and date", async () => {
    const ask = vi.fn(async () => JSON.stringify({ party: 3, date: "2026-11-06" }));
    expect(await extractBooking([{ role: "user", text: "3 people tomorrow" }], ask)).toEqual({ party: 3, date: "2026-11-06" });
  });
  it("falls back to unknown on bad output", async () => {
    const ask = vi.fn(async () => "nope");
    expect(await extractBooking([{ role: "user", text: "hi" }], ask)).toEqual({ party: 0, date: "" });
  });
});
