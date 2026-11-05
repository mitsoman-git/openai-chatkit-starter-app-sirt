import { describe, expect, it } from "vitest";
import { buildMapsAllowList, fixMapsLinks } from "../lib/mapsLinks";

const GOOD =
  "https://www.google.com/maps/dir/?api=1&origin=Stella%20Palace%20Hotel%2C%20Analipsi%2C%20Crete&destination=Sirtaki%20Restaurant%20Greek%20Tavern%2C%20Analipsi%2C%20Crete&travelmode=walking";
const PIN = "https://maps.app.goo.gl/abc123";
const allow = buildMapsAllowList(`walk: [Open in Google Maps](${GOOD})\nparking: [P1](${PIN})`);

describe("Google Maps links in replies", () => {
  it("keeps our own links unchanged", () => {
    const r = `Here are the [walking directions](${GOOD}). And [parking](${PIN}).`;
    expect(fixMapsLinks(r, allow)).toBe(r);
  });
  it("repairs a link with spaces from the hotel it names", () => {
    const bad = "https://www.google.com/maps/dir/?api=1&origin=Stella Palace Hotel, Analipsi, Crete&destination=Sirtaki Restaurant&travelmode=walking";
    expect(fixMapsLinks(`See [directions](${bad})`, allow)).toBe(`See [directions](${GOOD})`);
  });
  it("repairs a link written with &amp;", () => {
    expect(fixMapsLinks(`[x](${GOOD.replace(/&/g, "&amp;")})`, allow)).toBe(`[x](${GOOD})`);
  });
  it("repairs a path-style link that names the hotel", () => {
    expect(fixMapsLinks("[Stella Palace Hotel route](https://www.google.com/maps/dir/Stella+Palace+Hotel/Sirtaki)", allow)).toBe(`[Stella Palace Hotel route](${GOOD})`);
  });
  it("turns an unknown Maps link into plain text", () => {
    expect(fixMapsLinks("[Directions](https://www.google.com/maps/dir/Somewhere/Else)", allow)).toBe("Directions");
  });
  it("leaves other links alone", () => {
    const r = "[Menu](https://www.sirtaki-tavern.gr/menu.html) [WhatsApp](https://wa.me/306942662051)";
    expect(fixMapsLinks(r, allow)).toBe(r);
  });
});
