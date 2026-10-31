import { describe, expect, it } from "vitest";
import { athensToday, isDay, isMonth, monthGrid, monthRange, shiftMonth } from "../lib/adminCalendar";

describe("adminCalendar", () => {
  it("validates month and day params", () => {
    expect(isMonth("2026-10")).toBe(true);
    expect(isMonth("2026-13")).toBe(false);
    expect(isMonth("x")).toBe(false);
    expect(isDay("2026-10-31")).toBe(true);
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("2026-10-3")).toBe(false);
  });

  it("shifts months across year boundaries", () => {
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2027-01", -1)).toBe("2026-12");
    expect(shiftMonth("2026-10", 0)).toBe("2026-10");
  });

  it("returns first and last day of a month", () => {
    expect(monthRange("2026-02")).toEqual({ from: "2026-02-01", to: "2026-02-28" });
    expect(monthRange("2028-02").to).toBe("2028-02-29");
  });

  it("builds Monday-first weeks padded with nulls", () => {
    const weeks = monthGrid("2026-10"); // 1 Oct 2026 is a Thursday
    expect(weeks[0]).toEqual([null, null, null, "2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04"]);
    expect(weeks.at(-1)!.filter(Boolean).at(-1)).toBe("2026-10-31");
    expect(weeks.every((w) => w.length === 7)).toBe(true);
  });

  it("formats today in Athens, not UTC", () => {
    expect(athensToday(new Date("2026-10-31T22:30:00Z"))).toBe("2026-11-01");
  });
});
