import type { Metadata } from "next";
import { createDb } from "../../lib/db";
import { athensToday, isDay, isMonth, monthGrid, monthRange, shiftMonth } from "../../lib/adminCalendar";
import { deleteDayAction, deleteSessionAction } from "./actions";
import { ConfirmButton } from "./ConfirmButton";

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

const DELETE_BTN =
  "rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50";

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

const CATEGORIES = ["reserve", "meze", "get_information", "greeting", "blocked", "error"];
const MONTH_FMT = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

function href(params: { month: string; day?: string; cat?: string }) {
  const q = new URLSearchParams({ month: params.month });
  if (params.day) q.set("day", params.day);
  if (params.cat) q.set("cat", params.cat);
  return `/admin?${q.toString()}`;
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ session?: string; month?: string; day?: string; cat?: string }>;
}) {
  const sp = await searchParams;
  const session = sp.session;
  const db = createDb();

  if (session) {
    const messages = await db.getSession(session);
    return (
      <Shell>
        <div className="mb-4 flex items-center justify-between">
          <a href="/admin" className="text-sm font-medium text-sky-700 hover:underline">
            ← All conversations
          </a>
          <form action={deleteSessionAction}>
            <input type="hidden" name="sessionId" value={session} />
            <ConfirmButton message="Delete this conversation permanently?" className={DELETE_BTN}>
              Delete conversation
            </ConfirmButton>
          </form>
        </div>
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

  const today = athensToday();
  const month = isMonth(sp.month) ? sp.month : isDay(sp.day) ? sp.day.slice(0, 7) : today.slice(0, 7);
  const day = isDay(sp.day) && sp.day.startsWith(month) ? sp.day : undefined;
  const cat = sp.cat && CATEGORIES.includes(sp.cat) ? sp.cat : undefined;
  const range = day ? { from: day, to: day } : monthRange(month);

  const [sessions, counts] = await Promise.all([
    db.listSessions({ ...range, category: cat, limit: 200 }),
    db.daysWithActivity(month),
  ]);
  const monthTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  const deleteDayTarget = day ?? (month === today.slice(0, 7) ? today : undefined);

  return (
    <Shell>
      <div className="mb-5 rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <a href={href({ month: shiftMonth(month, -1), cat })} className="rounded-lg px-3 py-1 text-lg text-stone-600 hover:bg-stone-100" aria-label="Previous month">
            ‹
          </a>
          <div className="text-center">
            <div className="text-base font-semibold">{MONTH_FMT.format(new Date(`${month}-01T00:00:00Z`))}</div>
            <div className="text-xs text-stone-500">{monthTotal} conversations</div>
          </div>
          <a href={href({ month: shiftMonth(month, 1), cat })} className="rounded-lg px-3 py-1 text-lg text-stone-600 hover:bg-stone-100" aria-label="Next month">
            ›
          </a>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-stone-400">
          {WEEKDAYS.map((w) => (
            <div key={w}>{w}</div>
          ))}
        </div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {monthGrid(month)
            .flat()
            .map((d, i) => {
              if (!d) return <div key={`e${i}`} />;
              const n = counts[d] ?? 0;
              const selected = d === day;
              const base = "flex h-12 flex-col items-center justify-center rounded-lg text-sm";
              const tone = selected
                ? "bg-stone-900 text-white"
                : n > 0
                  ? "bg-sky-50 text-stone-900 hover:bg-sky-100"
                  : "text-stone-400";
              const ring = d === today && !selected ? " ring-1 ring-stone-400" : "";
              const inner = (
                <>
                  <span className="font-medium">{Number(d.slice(8))}</span>
                  {n > 0 && <span className={`text-[10px] ${selected ? "text-stone-200" : "text-sky-800"}`}>{n}</span>}
                </>
              );
              return n > 0 || selected ? (
                <a key={d} href={href({ month, day: selected ? undefined : d, cat })} className={`${base} ${tone}${ring}`}>
                  {inner}
                </a>
              ) : (
                <div key={d} className={`${base} ${tone}${ring}`}>
                  {inner}
                </div>
              );
            })}
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {[undefined, ...CATEGORIES].map((c) => (
          <a
            key={c ?? "all"}
            href={href({ month, day, cat: c })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              c === cat ? "bg-stone-900 text-white" : "bg-white text-stone-600 ring-1 ring-stone-200 hover:bg-stone-50"
            }`}
          >
            {c ? CATEGORY_LABEL[c] : "All"}
          </a>
        ))}
      </div>

      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-stone-500">
          {day ? `${fmtDay(`${day}T12:00:00Z`)} · ` : ""}
          {sessions.length === 0 ? "No conversations." : `${sessions.length} conversations`}
          {day && (
            <>
              {" · "}
              <a href={href({ month, cat })} className="font-medium text-sky-700 hover:underline">
                show whole month
              </a>
            </>
          )}
        </p>
        {deleteDayTarget && (counts[deleteDayTarget] ?? 0) > 0 && (
          <form action={deleteDayAction}>
            <input type="hidden" name="day" value={deleteDayTarget} />
            <ConfirmButton
              message={`Delete ALL messages of ${deleteDayTarget} permanently?`}
              className={DELETE_BTN}
            >
              {deleteDayTarget === today ? "Delete today\u2019s" : "Delete this day"}
            </ConfirmButton>
          </form>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {sessions.map((s) => (
          <li key={s.sessionId} className="flex items-stretch gap-2">
            <a
              href={`/admin?session=${encodeURIComponent(s.sessionId)}`}
              className="block min-w-0 flex-1 rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm transition hover:border-stone-300 hover:shadow"
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
            <form action={deleteSessionAction} className="flex">
              <input type="hidden" name="sessionId" value={s.sessionId} />
              <ConfirmButton message="Delete this conversation permanently?" className={`${DELETE_BTN} self-center`}>
                Delete
              </ConfirmButton>
            </form>
          </li>
        ))}
      </ul>
    </Shell>
  );
}
