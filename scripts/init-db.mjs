import { neon } from "@neondatabase/serverless";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set");
const sql = neon(process.env.DATABASE_URL);

await sql`create table if not exists messages (
  id bigserial primary key,
  session_id text not null,
  role text not null,
  text text not null,
  category text,
  created_at timestamptz not null default now()
)`;
await sql`create index if not exists messages_session_created_idx on messages (session_id, created_at)`;
console.log("messages table ready");
