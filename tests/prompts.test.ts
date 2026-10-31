import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadClassifierPrompt, loadPrompt } from "../lib/agents/loadPrompt";

const promptsDir = join(process.cwd(), "lib/agents/prompts");
const kbDir = join(process.cwd(), "lib/agents/kb");
const kbFiles = ["menu_2026_bilingual.md", "wines_sirtaki_2026.md", "wineries-2026.md"];

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
