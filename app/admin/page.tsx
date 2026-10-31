import type { Metadata } from "next";
import { createDb } from "../../lib/db";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Sirtaki chat log", robots: { index: false, follow: false } };

const fmt = (iso: string) => new Date(iso).toLocaleString("en-GB", { timeZone: "Europe/Athens" });

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
      <main className="mx-auto max-w-3xl p-4 text-slate-900 dark:text-slate-100">
        <a href="/admin" className="text-sm underline">
          ← All conversations
        </a>
        <h1 className="my-3 text-lg font-semibold">Conversation</h1>
        <ul className="flex flex-col gap-3">
          {messages.map((m) => (
            <li key={m.id} className="rounded-lg border border-slate-300 p-3 dark:border-slate-700">
              <div className="mb-1 text-xs text-slate-500">
                {m.role}
                {m.category ? ` · ${m.category}` : ""} · {fmt(m.createdAt)}
              </div>
              <div className="whitespace-pre-wrap break-words text-sm">{m.text}</div>
            </li>
          ))}
        </ul>
      </main>
    );
  }

  const sessions = await db.listSessions(100);
  return (
    <main className="mx-auto max-w-3xl p-4 text-slate-900 dark:text-slate-100">
      <h1 className="mb-3 text-lg font-semibold">Chat conversations</h1>
      {sessions.length === 0 && <p className="text-sm text-slate-500">No conversations yet.</p>}
      <ul className="flex flex-col gap-2">
        {sessions.map((s) => (
          <li key={s.sessionId}>
            <a
              href={`/admin?session=${encodeURIComponent(s.sessionId)}`}
              className="block rounded-lg border border-slate-300 p-3 dark:border-slate-700"
            >
              <div className="truncate text-sm">{s.firstText}</div>
              <div className="mt-1 text-xs text-slate-500">
                {s.messageCount} messages · {fmt(s.lastAt)}
              </div>
            </a>
          </li>
        ))}
      </ul>
    </main>
  );
}
