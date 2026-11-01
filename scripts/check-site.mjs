#!/usr/bin/env node
// Compares the live website with the agent's knowledge base: opening hours, takeaway hours,
// menu prices, links that no longer work, and website pages the agent knows nothing about.
// Usage: npm run check:site   (needs network; exit code 1 when something drifted)
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SITE = "https://www.sirtaki-tavern.gr";
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const AGENTS = join(ROOT, "lib/agents");
const read = (rel) => readFileSync(join(AGENTS, rel), "utf8");
const all = (dir) => readdirSync(join(AGENTS, dir)).filter((f) => f.endsWith(".md")).map((f) => read(`${dir}/${f}`)).join("\n");
const kb = all("kb"), prompts = all("prompts"), everything = kb + "\n" + prompts;

const problems = [], notes = [];
const get = async (path) => {
  const r = await fetch(path.startsWith("http") ? path : SITE + path, { headers: { "User-Agent": "Mozilla/5.0" }, redirect: "follow" });
  return { status: r.status, text: await r.text() };
};
const toText = (html) => {
  const m = html.match(/<main[\s\S]*?<\/main>/i);
  return (m ? m[0] : html)
    .replace(/<(script|style|svg|noscript|nav|header|footer)[\s\S]*?<\/\1>/gi, "")
    .replace(/<\/(p|div|li|h\d|tr|section)>/gi, "\n").replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/&#039;|&#39;/g, "'")
    .replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n");
};

// 1. Opening hours (contact page lists every day)
{
  const t = toText((await get("/contact")).text);
  const days = [...t.matchAll(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday):\s*(\d{1,2}:\d{2})\s*till\s*(\d{1,2}:\d{2})/g)];
  const slots = new Set(days.map((d) => `${d[2]}-${d[3]}`));
  if (!days.length) problems.push("Could not read the working hours from /contact");
  else {
    notes.push(`Website hours: ${[...slots].join(", ")} (${days.map((d) => d[1].slice(0, 3)).join(" ")})`);
    for (const s of slots) {
      const [a, b] = s.split("-");
      if (!new RegExp(`${a}\\s*(–|-|to)\\s*${b}`).test(prompts + kb)) problems.push(`Hours ${a}-${b} on the website are not written like that in the agent prompts/KB`);
    }
    if (days.some((d) => d[1] === "Sunday")) notes.push("The website lists Sunday as open; the agent says Sundays are closed except 1 Nov 2026 (intended? check the Sunday rule in assistant-extra-3.md)");
  }
}

// 2. Takeaway hours
{
  const t = toText((await get("/takeaway-analipsi.html")).text);
  const m = t.match(/Available Daily:\s*(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/);
  if (!m) problems.push("Could not read the takeaway hours from the takeaway page");
  else if (!new RegExp(`${m[1]}\\s*(–|-|to)\\s*${m[2]}`).test(kb + prompts)) problems.push(`Takeaway hours ${m[1]}-${m[2]} are not in the KB`);
  else notes.push(`Takeaway hours ${m[1]}-${m[2]} match`);
}

// 3. Menu and takeaway prices
{
  const kbPrices = new Set([...kb.matchAll(/(\d+(?:[.,]\d+)?)\s*€/g)].map((x) => x[1].replace(",", ".")));
  for (const page of ["/menu.html", "/takeaway-analipsi.html"]) {
    const t = toText((await get(page)).text);
    const items = [...t.matchAll(/^\s*(.+?)\s+(\d+(?:[.,]\d+)?)\s*€\s*$/gm)].map((x) => [x[1], x[2].replace(",", ".")]);
    const missing = items.filter(([, p]) => !kbPrices.has(p));
    if (!items.length) problems.push(`No prices found on ${page}`);
    for (const [n, p] of missing) problems.push(`${page}: "${n}" costs ${p}€ but that price is not in the KB`);
    notes.push(`${page}: ${items.length} items checked`);
  }
}

// 4. Links used by the agent must work
{
  const urls = new Set([...everything.matchAll(/https:\/\/www\.sirtaki-tavern\.gr\/[^\s)`"'\]]*/g)].map((m) => m[0].replace(/[.,;]+$/, "")));
  let bad = 0;
  for (const u of urls) {
    if (u.includes("[") || u.includes("{") || u.includes("reserve-agent.php") || u.endsWith(".pdf")) continue;
    try { let r = await get(u); if (r.status >= 500) { await new Promise((ok) => setTimeout(ok, 3000)); r = await get(u); } if (r.status >= 400) { problems.push(`Broken link (${r.status}): ${u}`); bad++; } } catch (e) { problems.push(`Link failed: ${u} (${e.message})`); }
  }
  notes.push(`${urls.size} website links checked, ${bad} broken`);
}

// 5. Website pages the agent does not know
{
  const xml = (await get("/sitemap.xml")).text;
  const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(SITE, "")).filter((p) => !/^\/(el|de|fr)\//.test(p) && !p.startsWith("/cellar/") && !/404/.test(p));
  const unknown = paths.filter((p) => { const slug = p.replace(/^\//, "").replace(/\/?(index\.html)?$/, ""); return slug && !everything.includes(slug); });
  for (const p of unknown) notes.push(`Page not mentioned in the KB or prompts: ${p}`);
}

console.log(notes.map((n) => "  · " + n).join("\n"));
if (problems.length) { console.log("\nDRIFT FOUND:\n" + problems.map((p) => "  ✗ " + p).join("\n")); process.exit(1); }
console.log("\nOK: the agent matches the website.");
