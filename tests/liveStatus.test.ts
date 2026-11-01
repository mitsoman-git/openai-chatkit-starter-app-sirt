import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSiteStatus, resetSiteStatusCache, statusLine } from "../lib/liveStatus";

afterEach(() => {
  vi.unstubAllEnvs();
  resetSiteStatusCache();
});

describe("live site status", () => {
  it("is skipped when no URL is configured", async () => {
    vi.stubEnv("SITE_STATUS_URL", "");
    expect(await loadSiteStatus(vi.fn() as unknown as typeof fetch)).toBeNull();
  });

  it("fetches once and caches", async () => {
    vi.stubEnv("SITE_STATUS_URL", "https://example.test/s.json");
    const f = vi.fn(async () => new Response(JSON.stringify({ open_sundays: ["2026-11-01"] })));
    const a = await loadSiteStatus(f as unknown as typeof fetch);
    await loadSiteStatus(f as unknown as typeof fetch);
    expect(a?.open_sundays).toEqual(["2026-11-01"]);
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("returns null when the website is down", async () => {
    vi.stubEnv("SITE_STATUS_URL", "https://example.test/s.json");
    const f = vi.fn(async () => { throw new Error("timeout"); });
    expect(await loadSiteStatus(f as unknown as typeof fetch)).toBeNull();
  });

  it("describes open Sundays and closed ranges for the agent", () => {
    const now = new Date("2026-11-01T10:00:00Z");
    const t = statusLine({ open_sundays: ["2026-10-25", "2026-11-01"], closed_dates: ["2026-11-07", "2026-11-09", "2026-11-10", "2026-11-14", "2026-11-16"], opening_time: "17:00", closing_time: "23:00" }, now);
    expect(t).toContain("2026-11-01");
    expect(t).not.toContain("2026-10-25");
    expect(t).toContain("2026-11-07 to 2026-11-10");
    expect(t).toContain("2026-11-14 to 2026-11-16");
    expect(t).toContain("17:00-23:00");
    expect(statusLine(null)).toBe("");
  });
});
