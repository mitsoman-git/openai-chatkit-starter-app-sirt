import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const src = readFileSync("docs/agent-builder-export.md", "utf8").split("\n");
const out = "lib/agents/prompts";
mkdirSync(out, { recursive: true });

function block(heading) {
  const start = src.findIndex((l) => l.startsWith(heading));
  if (start < 0) throw new Error(`heading not found: ${heading}`);
  const open = src.findIndex((l, i) => i > start && l === "~~~~text");
  if (open < 0) throw new Error(`no fenced block after: ${heading}`);
  const close = src.findIndex((l, i) => i > open && l === "~~~~");
  if (close < 0) throw new Error(`unclosed block after: ${heading}`);
  return src.slice(open + 1, close).join("\n");
}

const jobs = [
  ["### Classify Agent", "classifier"],
  ["### Meze Agent", "meze"],
  ["### Reservation Agent", "reservation"],
  ["### Sirtaki Assistant", "assistant"],
  ...[1, 2, 3, 4, 5, 6].map((n) => [`#### Extra assistant message ${n} `, `assistant-extra-${n}`]),
];

for (const [heading, name] of jobs) {
  const text = block(heading);
  writeFileSync(`${out}/${name}.md`, text);
  console.log(`${name}.md ${text.length} chars`);
}
