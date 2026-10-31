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

const KB_FILES = ["menu_2026_bilingual.md", "wines_sirtaki_2026.md", "wineries-2026.md", "hotels_distances_2026.md"];

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

export function loadPrompt(category: Category): string {
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
