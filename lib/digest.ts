export type DayMessage = {
  sessionId: string;
  role: "user" | "assistant";
  text: string;
  category: string | null;
  createdAt: string;
  starred: boolean;
};

const ADMIN_URL = "https://openai-chatkit-starter-app-sirt.vercel.app/admin";
const MAX_MESSAGE = 500;
const MAX_SHOWN = 12;
const NO_ANSWER = /\bI (?:don't|do not) have\b/i;

const CATEGORY_LABEL: Record<string, string> = {
  meze: "Meze",
  reserve: "Reservation",
  get_information: "Information",
  greeting: "Greeting",
  blocked: "Blocked",
  error: "Error",
};

type Convo = {
  id: string;
  messages: DayMessage[];
  starred: boolean;
  topic: string | null;
  reasons: string[];
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/Athens", hour: "2-digit", minute: "2-digit" });
const clip = (s: string, n = MAX_MESSAGE) => {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > n ? `${one.slice(0, n)}…` : one;
};
const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
const link = (id: string) => `${ADMIN_URL}?session=${encodeURIComponent(id)}`;
const label = (c: string | null) => (c ? (CATEGORY_LABEL[c] ?? c) : "");

function group(messages: DayMessage[]): Convo[] {
  const byId = new Map<string, Convo>();
  const out: Convo[] = [];
  for (const m of messages) {
    let c = byId.get(m.sessionId);
    if (!c) {
      c = { id: m.sessionId, messages: [], starred: m.starred, topic: null, reasons: [] };
      byId.set(m.sessionId, c);
      out.push(c);
    }
    c.messages.push(m);
    if (m.role === "assistant" && m.category && !["error", "blocked"].includes(m.category)) c.topic = m.category;
  }
  for (const c of out) {
    const assistant = c.messages.filter((m) => m.role === "assistant");
    if (c.starred) c.reasons.push("starred by you");
    if (assistant.some((m) => m.category === "error")) c.reasons.push("error");
    if (assistant.some((m) => m.category === "blocked")) c.reasons.push("blocked");
    if (assistant.some((m) => NO_ANSWER.test(m.text))) c.reasons.push("assistant had no answer");
    if (!c.topic) c.topic = assistant.find((m) => m.category)?.category ?? null;
  }
  return out;
}

const firstGuest = (c: Convo) => c.messages.find((m) => m.role === "user")?.text ?? c.messages[0].text;

function topicCounts(convos: Convo[]): [string, number][] {
  const counts = new Map<string, number>();
  for (const c of convos) {
    const k = label(c.topic) || "Other";
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

/** Summary email for one Athens day; `messages` ordered by conversation, then time. */
export function buildDigest(day: string, messages: DayMessage[]): { subject: string; text: string; html: string } {
  const convos = group(messages);
  const starred = convos.filter((c) => c.starred).length;
  const attention = convos.filter((c) => c.reasons.length > 0);
  const topics = topicCounts(convos);
  const subject = `Sirtaki chat · ${day} · ${convos.length} conversations${starred ? ` (${starred} starred)` : ""}`;
  const adminDay = `${ADMIN_URL}?month=${day.slice(0, 7)}&day=${day}`;
  const headline = `${convos.length} conversations · ${starred} starred · ${attention.length} need your attention`;

  // ---- plain text
  const t: string[] = [`Sirtaki chat · ${day}`, headline, `By topic: ${topics.map(([k, n]) => `${k}: ${n}`).join(" · ") || "-"}`, `Admin: ${adminDay}`, "", "NEEDS YOUR ATTENTION"];
  if (attention.length === 0) t.push("Nothing today.");
  for (const c of attention) {
    t.push(`${c.starred ? "★ " : ""}${time(c.messages[0].createdAt)} · ${c.reasons.join(", ")}`);
    for (const m of c.messages.slice(0, MAX_SHOWN)) t.push(`  ${m.role === "user" ? "Guest" : "Assistant"}: ${clip(m.text)}`);
    if (c.messages.length > MAX_SHOWN) t.push(`  … ${c.messages.length - MAX_SHOWN} more messages`);
    t.push(`  ${link(c.id)}`, "");
  }
  t.push("", "ALL CONVERSATIONS");
  for (const c of convos) {
    t.push(`${c.starred ? "★ " : ""}${time(c.messages[0].createdAt)} · ${label(c.topic) || "-"} · ${c.messages.length} msgs · "${clip(firstGuest(c), 90)}"`, `  ${link(c.id)}`);
  }

  // ---- html (tables + inline styles: the only thing mail apps render reliably)
  const pill = (txt: string, bg: string, fg: string) =>
    `<span style="display:inline-block;background:${bg};color:${fg};border-radius:10px;padding:1px 8px;font-size:12px;margin:0 4px 4px 0">${esc(txt)}</span>`;
  const bubble = (m: DayMessage) =>
    m.role === "user"
      ? `<div style="margin:4px 0 4px 40px;background:#1c1917;color:#ffffff;border-radius:12px;padding:8px 12px;font-size:14px">${esc(clip(m.text))}</div>`
      : `<div style="margin:4px 40px 4px 0;background:#f5f5f4;color:#1c1917;border:1px solid #e7e5e4;border-radius:12px;padding:8px 12px;font-size:14px">${esc(clip(m.text))}</div>`;

  const attentionHtml =
    attention.length === 0
      ? `<p style="color:#78716c;margin:0">Nothing today.</p>`
      : attention
          .map(
            (c) => `<div style="border:1px solid #e7e5e4;border-radius:12px;padding:12px;margin:0 0 12px 0;background:#ffffff">
<div style="margin-bottom:6px;font-size:13px;color:#57534e">${c.starred ? "★ " : ""}${time(c.messages[0].createdAt)} ${c.reasons.map((r) => pill(r, r === "starred by you" ? "#fef3c7" : "#fee2e2", r === "starred by you" ? "#92400e" : "#991b1b")).join("")}</div>
${c.messages.slice(0, MAX_SHOWN).map(bubble).join("")}${c.messages.length > MAX_SHOWN ? `<div style="font-size:12px;color:#78716c">… ${c.messages.length - MAX_SHOWN} more messages</div>` : ""}
<div style="margin-top:6px"><a href="${esc(link(c.id))}" style="color:#0369a1;font-size:13px">Open conversation</a></div></div>`,
          )
          .join("");

  const rows = convos
    .map(
      (c) => `<tr><td width="76" style="padding:6px 8px;border-top:1px solid #e7e5e4;white-space:nowrap;color:#57534e;font-size:13px;vertical-align:top">${c.starred ? "★ " : ""}${time(c.messages[0].createdAt)}</td>
<td style="padding:6px 8px;border-top:1px solid #e7e5e4;font-size:14px;vertical-align:top"><a href="${esc(link(c.id))}" style="color:#1c1917;text-decoration:none">${esc(clip(firstGuest(c), 90))}</a>
<div style="font-size:12px;color:#78716c">${esc(label(c.topic) || "-")} · ${c.messages.length} messages</div></td></tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f5f4f0">
<div style="max-width:640px;margin:0 auto;padding:16px;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif;color:#1c1917">
<h2 style="margin:0 0 4px 0;font-size:20px">Sirtaki chat · ${esc(day)}</h2>
<p style="margin:0 0 10px 0;color:#57534e;font-size:14px">${esc(headline)}</p>
<div style="margin-bottom:8px">${topics.map(([k, n]) => pill(`${k}: ${n}`, "#e0f2fe", "#075985")).join("")}</div>
<p style="margin:0 0 18px 0"><a href="${esc(adminDay)}" style="color:#0369a1;font-size:14px">Open this day in the admin page</a></p>
<h3 style="margin:0 0 8px 0;font-size:15px">Needs your attention</h3>${attentionHtml}
<h3 style="margin:18px 0 4px 0;font-size:15px">All conversations</h3>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#ffffff;border:1px solid #e7e5e4;border-radius:12px">${rows}</table>
</div></body></html>`;

  return { subject, text: t.join("\n"), html };
}
