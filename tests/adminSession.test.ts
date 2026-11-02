import { describe, expect, it } from "vitest";
import { createSessionToken, passwordMatches, safeNext, verifySessionToken, SESSION_MAX_AGE } from "../lib/adminSession";

describe("admin session token", () => {
  it("accepts a fresh token for the same password", async () => {
    const t = await createSessionToken("s3cret", 1000);
    expect(await verifySessionToken(t, "s3cret", 1001)).toBe(true);
  });
  it("rejects a different password, tampering, expiry and missing values", async () => {
    const t = await createSessionToken("s3cret", 1000);
    expect(await verifySessionToken(t, "other", 1001)).toBe(false);
    expect(await verifySessionToken(t.replace(/^\d+/, "99999999999"), "s3cret", 1001)).toBe(false);
    expect(await verifySessionToken(t, "s3cret", 1000 + SESSION_MAX_AGE + 1)).toBe(false);
    expect(await verifySessionToken(undefined, "s3cret")).toBe(false);
    expect(await verifySessionToken(t, undefined)).toBe(false);
    expect(await verifySessionToken("garbage", "s3cret")).toBe(false);
  });
});

describe("passwordMatches / safeNext", () => {
  it("compares passwords", () => {
    expect(passwordMatches("a", "a")).toBe(true);
    expect(passwordMatches("a", "b")).toBe(false);
    expect(passwordMatches("", "")).toBe(false);
    expect(passwordMatches("a", undefined)).toBe(false);
  });
  it("only allows redirects inside /admin", () => {
    expect(safeNext("/admin?month=2026-10")).toBe("/admin?month=2026-10");
    expect(safeNext("//evil.com")).toBe("/admin");
    expect(safeNext("https://evil.com")).toBe("/admin");
    expect(safeNext("/administrator")).toBe("/admin");
    expect(safeNext("/admin/login")).toBe("/admin");
    expect(safeNext("")).toBe("/admin");
  });
});
