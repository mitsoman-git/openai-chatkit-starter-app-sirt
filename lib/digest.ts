export type DayMessage = {
  sessionId: string;
  role: "user" | "assistant";
  text: string;
  category: string | null;
  createdAt: string;
  starred: boolean;
};

const ADMIN_URL = "https://openai-chatkit-starter-app-sirt.vercel.app/admin";
const MAX_MESSAGE = 600;

const CATEGORY_LABEL: Record<string, string> = {
  meze: "Meze",
  reserve: "Reservation",
  get_information: "Information",
  greeting: "Greeting",
  blocked: "Blocked",
  error: "Error",
};

const time = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: "Europe/Athens", hour: "2-digit", minute: "2-digit" });

const clip = (s: string) => (s.length > MAX_MESSAGE ? `${s.slice(0, MAX_MESSAGE)}…` : s);

/** Plain-text email for one Athens day; `messages` must be ordered by conversation, then time. */
export function buildDigest(day: string, messages: DayMessage[]): { subject: string; text: string } {
  const sessions: DayMessage[][] = [];
  const index = new Map<string, DayMessage[]>();
  for (const m of messages) {
    let list = index.get(m.sessionId);
    if (!list) {
      list = [];
      index.set(m.sessionId, list);
      sessions.push(list);
    }
    list.push(m);
  }
  const starred = sessions.filter((s) => s[0].starred).length;
  const subject = `Sirtaki chat · ${day} · ${sessions.length} conversations${starred ? ` (${starred} starred)` : ""}`;
  const link = `${ADMIN_URL}?month=${day.slice(0, 7)}&day=${day}`;

  const lines = [`${sessions.length} conversations on ${day}${starred ? `, ${starred} starred` : ""}.`, `Admin: ${link}`, ""];
  sessions.forEach((s, i) => {
    lines.push(`${s[0].starred ? "★ " : ""}#${i + 1} · ${time(s[0].createdAt)} · ${s.length} messages`);
    for (const m of s) {
      const who = m.role === "user" ? "Guest" : `Assistant${m.category ? ` (${CATEGORY_LABEL[m.category] ?? m.category})` : ""}`;
      lines.push(`  ${time(m.createdAt)}  ${who}: ${clip(m.text).replace(/\n+/g, " ")}`);
    }
    lines.push("");
  });
  return { subject, text: lines.join("\n") };
}
