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
};

let neonSql: Sql | undefined;

const lazyNeon: Sql = (strings, ...values) => {
  neonSql ??= neon(process.env.DATABASE_URL!) as unknown as Sql;
  return neonSql(strings, ...values);
};

export function createDb(sql: Sql = lazyNeon) {
  return {
    async logExchange(e: { sessionId: string; userText: string; replyText: string; category: string }) {
      await sql`insert into messages (session_id, role, text, category) values (${e.sessionId}, ${"user"}, ${e.userText}, ${null})`;
      await sql`insert into messages (session_id, role, text, category) values (${e.sessionId}, ${"assistant"}, ${e.replyText}, ${e.category})`;
    },

    async listSessions(limit = 100): Promise<SessionSummary[]> {
      const rows = await sql`
        select session_id,
               (array_agg(text order by created_at, id) filter (where role = 'user'))[1] as first_text,
               count(*) as message_count,
               max(created_at) as last_at
        from messages
        group by session_id
        order by max(created_at) desc
        limit ${limit}`;
      return rows.map((r) => ({
        sessionId: String(r.session_id),
        firstText: String(r.first_text ?? ""),
        messageCount: Number(r.message_count),
        lastAt: String(r.last_at),
      }));
    },

    async deleteSession(sessionId: string): Promise<void> {
      await sql`delete from messages where session_id = ${sessionId}`;
    },

    async deleteToday(): Promise<void> {
      await sql`
        delete from messages
        where (created_at at time zone 'Europe/Athens')::date = (now() at time zone 'Europe/Athens')::date`;
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
