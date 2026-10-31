import { describe, expect, it } from "vitest";
import { isAuthorized } from "../lib/adminAuth";

const basic = (user: string, pw: string) => "Basic " + btoa(`${user}:${pw}`);

describe("isAuthorized", () => {
  it("accepts the right password with any username", () => {
    expect(isAuthorized(basic("admin", "s3cret"), "s3cret")).toBe(true);
    expect(isAuthorized(basic("owner", "s3cret"), "s3cret")).toBe(true);
  });
  it("rejects a wrong password", () => {
    expect(isAuthorized(basic("admin", "nope"), "s3cret")).toBe(false);
  });
  it("rejects a missing header, wrong scheme and malformed base64", () => {
    expect(isAuthorized(null, "s3cret")).toBe(false);
    expect(isAuthorized("Bearer abc", "s3cret")).toBe(false);
    expect(isAuthorized("Basic !!!not-base64!!!", "s3cret")).toBe(false);
  });
  it("rejects everything when no password is configured", () => {
    expect(isAuthorized(basic("admin", ""), undefined)).toBe(false);
    expect(isAuthorized(basic("admin", ""), "")).toBe(false);
  });
  it("accepts a password containing a colon", () => {
    expect(isAuthorized(basic("admin", "a:b"), "a:b")).toBe(true);
  });
});
