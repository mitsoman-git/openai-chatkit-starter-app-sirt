import type { DayMessage } from "./digest";
import { neon } from "@neondatabase/serverless";

type Row = Record<string, unknown>;

export type Sql = (strings: TemplateStringsArray, ...values: unknown[]) => Promise<Row[]>;

export type StoredMessage = {
  id: number;
  sessionId: string;
  role: "user" | "assistant";
  text: string;
  category: string | null;
  createdAt: string;
};

export type SessionSummary = {
  sessionId: string;
  firstText: string;
  messageCount: number;
  lastAt: string;
  starred: boolean;
};

let neonSql: Sql | undefined;

const lazyNeon: Sql = (strings, ...values) => {
  neonSql ??= neon(process.env.DATABASE_URL!) as unknown as Sql;
  return neonSql(strings, ...values);
};

let starTableReady = false;

export function createDb(sql: Sql = lazyNeon) {
  // The star table is created on first use so no manual SQL step is needed (only for the real connection).
  async function ensureStars() {
    if (sql !== lazyNeon || starTableReady) return;
    await sql`create table if not exists starred_sessions (
      session_id text primary key,
      starred_at timestamptz not null default now()
    )`;
    starTableReady = true;
  }

  return {
    async logExchange(e: { sessionId: string; userText: string; replyText: string; category: string }) {
      await sql`insert into messages (session_id, role, text, category) values (${e.sessionId}, ${"user"}, ${e.userText}, ${null})`;
      await sql`insert into messages (session_id, role, text, category) values (${e.sessionId}, ${"assistant"}, ${e.replyText}, ${e.category})`;
    },

    async listSessions(
      opts: { from?: string; to?: string; category?: string; starredOnly?: boolean; limit?: number } = {},
    ): Promise<SessionSummary[]> {
      const from = opts.from ?? null;
      const to = opts.to ?? null;
      const category = opts.category ?? null;
      const starredOnly = opts.starredOnly ? true : null;
      await ensureStars();
      const rows = await sql`
        select m.session_id,
               (array_agg(m.text order by m.created_at, m.id) filter (where m.role = 'user'))[1] as first_text,
               count(*) as message_count,
               max(m.created_at) as last_at,
               bool_or(s.session_id is not null) as starred
        from messages m
        left join starred_sessions s on s.session_id = m.session_id
        group by m.session_id
        having (${from}::date is null or (max(m.created_at) at time zone 'Europe/Athens')::date >= ${from}::date)
           and (${to}::date is null or (max(m.created_at) at time zone 'Europe/Athens')::date <= ${to}::date)
           and (${category}::text is null or bool_or(m.category = ${category}::text))
           and (${starredOnly}::boolean is not true or bool_or(s.session_id is not null))
        order by max(m.created_at) desc
        limit ${opts.limit ?? 100}`;
      return rows.map((r) => ({
        sessionId: String(r.session_id),
        firstText: String(r.first_text ?? ""),
        messageCount: Number(r.message_count),
        lastAt: String(r.last_at),
        starred: Boolean(r.starred),
      }));
    },

    async daysWithActivity(month: string): Promise<Record<string, number>> {
      const rows = await sql`
        select to_char((created_at at time zone 'Europe/Athens')::date, 'YYYY-MM-DD') as day,
               count(distinct session_id) as sessions
        from messages
        where to_char(created_at at time zone 'Europe/Athens', 'YYYY-MM') = ${month}
        group by 1`;
      return Object.fromEntries(rows.map((r) => [String(r.day), Number(r.sessions)]));
    },

    async deleteSession(sessionId: string): Promise<void> {
      await sql`delete from messages where session_id = ${sessionId}`;
      await ensureStars();
      await sql`delete from starred_sessions where session_id = ${sessionId}`;
    },

    // Starred conversations are kept: "delete the day" only removes the ones nobody marked as interesting.
    async deleteDay(day: string): Promise<void> {
      await ensureStars();
      await sql`
        delete from messages
        where (created_at at time zone 'Europe/Athens')::date = ${day}::date
          and session_id not in (select session_id from starred_sessions)`;
    },

    async messagesOfDay(day: string): Promise<DayMessage[]> {
      await ensureStars();
      const rows = await sql`
        select m.session_id, m.role, m.text, m.category, m.created_at,
               (s.session_id is not null) as starred,
               min(m.created_at) over (partition by m.session_id) as first_at
        from messages m
        left join starred_sessions s on s.session_id = m.session_id
        where (m.created_at at time zone 'Europe/Athens')::date = ${day}::date
        order by first_at, m.session_id, m.created_at, m.id`;
      return rows.map((r) => ({
        sessionId: String(r.session_id),
        role: r.role as DayMessage["role"],
        text: String(r.text),
        category: r.category == null ? null : String(r.category),
        createdAt: String(r.created_at),
        starred: Boolean(r.starred),
      }));
    },

    async toggleStar(sessionId: string): Promise<void> {
      await ensureStars();
      await sql`
        with removed as (delete from starred_sessions where session_id = ${sessionId} returning 1)
        insert into starred_sessions (session_id)
        select ${sessionId} where not exists (select 1 from removed)`;
    },

    async isStarred(sessionId: string): Promise<boolean> {
      await ensureStars();
      const rows = await sql`select session_id from starred_sessions where session_id = ${sessionId}`;
      return rows.length > 0;
    },

    async getSession(sessionId: string): Promise<StoredMessage[]> {
      const rows = await sql`
        select id, session_id, role, text, category, created_at
        from messages
        where session_id = ${sessionId}
        order by created_at, id`;
      return rows.map((r) => ({
        id: Number(r.id),
        sessionId: String(r.session_id),
        role: r.role as StoredMessage["role"],
        text: String(r.text),
        category: r.category == null ? null : String(r.category),
        createdAt: String(r.created_at),
      }));
    },
  };
}
