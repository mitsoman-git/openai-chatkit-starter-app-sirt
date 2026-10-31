import type { Metadata } from "next";
import { createDb } from "../../lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sirtaki chat log", robots: { index: false, follow: false } };

const TIME_ZONE = "Europe/Athens";
const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("en-GB", { timeZone: TIME_ZONE, day: "numeric", month: "short", year: "numeric" });
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-GB", { timeZone: TIME_ZONE, hour: "2-digit", minute: "2-digit" });

const CATEGORY_LABEL: Record<string, string> = {
  meze: "Meze",
  reserve: "Reservation",
  get_information: "Information",
  greeting: "Greeting",
  blocked: "Blocked",
  error: "Error",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <a href="/admin" className="text-lg font-semibold tracking-tight text-stone-900">
            Sirtaki · Chat conversations
          </a>
          <span className="text-xs text-stone-500">Times in Athens</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
    </div>
  );
}

function CategoryPill({ category }: { category: string | null }) {
  if (!category) return null;
  const tone =
    category === "blocked" || category === "error"
      ? "bg-red-100 text-red-800"
      : category === "reserve"
        ? "bg-amber-100 text-amber-900"
        : "bg-sky-100 text-sky-900";
  return (
    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>
      {CATEGORY_LABEL[category] ?? category}
    </span>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string }>;
}) {
  const { session } = await searchParams;
  const db = createDb();

  if (session) {
    const messages = await db.getSession(session);
    return (
      <Shell>
        <a href="/admin" className="mb-4 inline-block text-sm font-medium text-sky-700 hover:underline">
          ← All conversations
        </a>
        {messages.length > 0 && (
          <p className="mb-4 text-sm text-stone-500">
            {fmtDay(messages[0].createdAt)} · {messages.length} messages
          </p>
        )}
        <ul className="flex flex-col gap-3">
          {messages.map((m) => (
            <li key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-sm ${
                  m.role === "user"
                    ? "bg-stone-900 text-white"
                    : "border border-stone-200 bg-white text-stone-900"
                }`}
              >
                {m.text}
              </div>
              <div className="mt-1 flex items-center gap-2 text-[11px] text-stone-500">
                <span>{m.role === "user" ? "Guest" : "Assistant"}</span>
                <CategoryPill category={m.category} />
                <span>{fmtTime(m.createdAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      </Shell>
    );
  }

  const sessions = await db.listSessions(100);
  return (
    <Shell>
      <p className="mb-4 text-sm text-stone-500">
        {sessions.length === 0 ? "No conversations yet." : `Latest ${sessions.length} conversations`}
      </p>
      <ul className="flex flex-col gap-2">
        {sessions.map((s) => (
          <li key={s.sessionId}>
            <a
              href={`/admin?session=${encodeURIComponent(s.sessionId)}`}
              className="block rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm transition hover:border-stone-300 hover:shadow"
            >
              <div className="line-clamp-2 text-sm font-medium text-stone-900">{s.firstText || "(no text)"}</div>
              <div className="mt-1.5 flex items-center gap-2 text-xs text-stone-500">
                <span className="rounded-full bg-stone-100 px-2 py-0.5 font-medium text-stone-700">
                  {s.messageCount} messages
                </span>
                <span>
                  {fmtDay(s.lastAt)} · {fmtTime(s.lastAt)}
                </span>
              </div>
            </a>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
