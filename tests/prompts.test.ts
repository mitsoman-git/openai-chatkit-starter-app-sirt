import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadClassifierPrompt, loadPrompt } from "../lib/agents/loadPrompt";

const promptsDir = join(process.cwd(), "lib/agents/prompts");
const kbDir = join(process.cwd(), "lib/agents/kb");
const kbFiles = ["menu_2026_bilingual.md", "wines_sirtaki_2026.md", "wineries-2026.md", "hotels_distances_2026.md", "faq_2026.md"];

describe("prompt files", () => {
  it("contain no TypeScript string escapes", () => {
    const files = readdirSync(promptsDir).filter((f) => f.endsWith(".md"));
    expect(files.length).toBe(10);
    for (const f of files) {
      expect(readFileSync(join(promptsDir, f), "utf8"), f).not.toContain('\\"');
    }
  });
});

describe("loadPrompt", () => {
  it("classifier prompt starts and lists the categories", () => {
    const p = loadClassifierPrompt();
    expect(p.startsWith("You are an intent classifier for the Sirtaki Tavern Assistant.")).toBe(true);
    expect(p).toContain("meze, reserve, get_information, greeting");
  });

  it("meze prompt has no knowledge base", () => {
    const p = loadPrompt("meze");
    expect(p.startsWith("# Sirtaki Tavern AI Agent - MEZE ONLY Assistant")).toBe(true);
    expect(p).not.toContain("# KNOWLEDGE BASE");
  });

  it("reservation prompt has no knowledge base", () => {
    const p = loadPrompt("reserve");
    expect(p.startsWith("# Sirtaki Tavern AI Agent - Complete Assistant")).toBe(true);
    expect(p).not.toContain("# KNOWLEDGE BASE");
  });

  it("get_information and greeting share the assistant bundle in order", () => {
    const p = loadPrompt("get_information");
    expect(loadPrompt("greeting")).toBe(p);
    const markers = [
      "## IMPORTANT INFO TO KNOW",
      "## LOCATION & DIRECTIONS ASSISTANT",
      "## FAMILY STAFF INTRODUCTION",
      "## HOURS & CONTACT ASSISTANT",
      "# MENU - ROLE & PERSONALITY",
      "## 🍷 **SIRTAKI SOMMELIER AGENT**",
      "### EVENT PLANNING (10+ guests)",
      "# KNOWLEDGE BASE",
    ];
    let at = -1;
    for (const m of markers) {
      const i = p.indexOf(m, at + 1);
      expect(i, m).toBeGreaterThan(at);
      at = i;
    }
  });

  it("assistant bundle contains each knowledge base file in full", () => {
    const p = loadPrompt("get_information");
    for (const f of kbFiles) {
      expect(p, f).toContain(readFileSync(join(kbDir, f), "utf8"));
    }
  });
});

describe("reservation prompt date rules", () => {
  const p = loadPrompt("reserve");

  it("resolves relative dates from the CURRENT DATE calendar", () => {
    expect(p).toContain("CURRENT DATE");
    expect(p).toContain("**DATES**");
  });

  it("no longer forbids relative dates or hardcodes the year 2026", () => {
    expect(p).not.toContain("You are not allowed to write any value into");
    expect(p).not.toContain("hardcoded year **2026**");
    expect(p).not.toContain("typed an explicit day and month themselves");
  });

  it("still never lets a relative word into the link", () => {
    expect(p).toContain("never the word \"tonight\" or any other relative word");
  });
});

describe("hotel distances", () => {
  it("are in the assistant knowledge base with distance, walking time and a directions link", () => {
    for (const category of ["get_information", "greeting"] as const) {
      const p = loadPrompt(category);
      expect(p).toContain("Stella Island Resort");
      expect(p).toContain("1.4 km");
      expect(p).toContain("19 min");
      expect(p).toContain("https://www.sirtaki-tavern.gr/location/stella-island-resort-analipsi.html");
    }
  });

  it("are not added to the meze or reservation prompts", () => {
    expect(loadPrompt("meze")).not.toContain("Stella Island Resort");
    expect(loadPrompt("reserve")).not.toContain("Stella Island Resort");
  });
});

describe("website FAQ", () => {
  it("is in the assistant knowledge base, with the instruction to use it", () => {
    for (const category of ["get_information", "greeting"] as const) {
      const p = loadPrompt(category);
      expect(p).toContain("# Website FAQ");
      expect(p).toContain("Do you take reservations?");
      expect(p).toContain("WEBSITE FAQ");
    }
  });

  it("is not in the meze or reservation prompts", () => {
    expect(loadPrompt("meze")).not.toContain("# Website FAQ");
    expect(loadPrompt("reserve")).not.toContain("# Website FAQ");
  });
});
