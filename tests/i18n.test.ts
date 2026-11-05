import { describe, expect, it } from "vitest";
import { UI, langFromSearch } from "../lib/i18n";

describe("chat UI languages", () => {
  it("reads the lang query and falls back to English", () => {
    expect(langFromSearch("?lang=el")).toBe("el");
    expect(langFromSearch("?lang=de")).toBe("de");
    expect(langFromSearch("?lang=fr")).toBe("fr");
    expect(langFromSearch("")).toBe("en");
    expect(langFromSearch("?lang=xx")).toBe("en");
    expect(langFromSearch("?lang=EL")).toBe("en");
  });

  it("has starters (six, five in Greek: no dinner builder there) and all texts for every language", () => {
    for (const ui of Object.values(UI)) {
      expect(ui.starters).toHaveLength(ui === UI.el ? 5 : 6);
      for (const s of ui.starters) {
        expect(s.label.length).toBeGreaterThan(0);
        expect(s.prompt.length).toBeGreaterThan(0);
      }
      for (const k of ["greeting", "placeholder", "send", "newChat", "error"] as const) {
        expect(ui[k].length).toBeGreaterThan(0);
      }
    }
  });
});
