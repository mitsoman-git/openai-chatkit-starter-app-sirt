import { describe, expect, it } from "vitest";
import { tokenizeLine } from "../lib/formatReply";

describe("tokenizeLine", () => {
  it("returns plain text as one token", () => {
    expect(tokenizeLine("Καλημέρα 😊")).toEqual([{ type: "text", text: "Καλημέρα 😊" }]);
  });

  it("parses bold", () => {
    expect(tokenizeLine("a **b** c")).toEqual([
      { type: "text", text: "a " },
      { type: "bold", text: "b" },
      { type: "text", text: " c" },
    ]);
  });

  it("parses markdown links", () => {
    expect(tokenizeLine("see [Directions](https://maps.google.com/x?a=1&b=2) now")).toEqual([
      { type: "text", text: "see " },
      { type: "link", text: "Directions", href: "https://maps.google.com/x?a=1&b=2" },
      { type: "text", text: " now" },
    ]);
  });

  it("parses tel links", () => {
    expect(tokenizeLine("[Call: +30 2897021221](tel:+302897021221)")).toEqual([
      { type: "link", text: "Call: +30 2897021221", href: "tel:+302897021221" },
    ]);
  });

  it("links bare https urls", () => {
    expect(tokenizeLine("go to https://wa.me/306942662051 today")).toEqual([
      { type: "text", text: "go to " },
      { type: "link", text: "https://wa.me/306942662051", href: "https://wa.me/306942662051" },
      { type: "text", text: " today" },
    ]);
  });

  it("never links a javascript: target", () => {
    const tokens = tokenizeLine("[click](javascript:alert(1))");
    expect(tokens.some((t) => t.type === "link")).toBe(false);
  });

  it("keeps html as text", () => {
    expect(tokenizeLine("<b>x</b>")).toEqual([{ type: "text", text: "<b>x</b>" }]);
  });
});
