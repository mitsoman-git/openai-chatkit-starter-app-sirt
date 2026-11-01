import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Category } from "../types";

const cache = new Map<string, string>();

function read(rel: string): string {
  let text = cache.get(rel);
  if (text === undefined) {
    text = readFileSync(join(process.cwd(), "lib/agents", rel), "utf8");
    cache.set(rel, text);
  }
  return text;
}

const KB_FILES = ["menu_2026_bilingual.md", "wines_sirtaki_2026.md", "wineries-2026.md", "hotels_distances_2026.md", "faq_2026.md", "drinks_2026.md", "specials_2026.md", "story_2026.md", "takeaway_2026.md", "area_2026.md", "contact_2026.md", "events_2026.md"];

const KB_INTRO =
  "# KNOWLEDGE BASE\nThis section is the knowledge base. Wherever these instructions say to search the knowledge base, use the text below and nothing else.";

function assistantBundle(): string {
  const parts = [read("prompts/assistant.md")];
  for (let n = 1; n <= 6; n++) parts.push(read(`prompts/assistant-extra-${n}.md`));
  parts.push(KB_INTRO, ...KB_FILES.map((f) => read(`kb/${f}`)));
  return parts.join("\n\n");
}

export function loadClassifierPrompt(): string {
  return read("prompts/classifier.md");
}

const LINK_RULE =
  "\n\n# LINKS\nNever write a bare URL in a reply. Every link must be a markdown link with short, friendly text, e.g. [Order takeaway online](https://...), [Message us on WhatsApp](https://wa.me/...). This applies to every website, WhatsApp, Instagram and Facebook link.\n\nLINK LANGUAGE: our website exists in English, Greek (/el/), German (/de/) and French (/fr/). When the guest writes in German or French, put /de/ or /fr/ after sirtaki-tavern.gr in links to pages of our website (for example https://www.sirtaki-tavern.gr/de/menu.html), for the menu, specials, story, location and hotel pages, faq, takeaway, reserve, events, contact, gallery and blog. When the guest writes in Greek, use /el/ only for the home page, menu, black-angus-cuts, wines, story, gallery, location, faq, takeaway and reserve; the Greek specials, blog and events pages exist only in English, so keep those without /el/. Never change links to wa.me, Google Maps, the booking page reserve-agent.php, PDFs or images.";

export function loadPrompt(category: Category): string {
  return loadBasePrompt(category) + LINK_RULE;
}

function loadBasePrompt(category: Category): string {
  switch (category) {
    case "meze":
      return read("prompts/meze.md");
    case "reserve":
      return read("prompts/reservation.md");
    case "get_information":
    case "greeting":
      return assistantBundle();
  }
}
