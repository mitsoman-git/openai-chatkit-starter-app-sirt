import type { Turn } from "./types";

export type StorageLike = Pick<Storage, "getItem" | "setItem">;
export type StoredChat = { sessionId: string; turns: Turn[] };

const KEY = "sirtaki-chat";
const MAX_TURNS = 40;
const MAX_IDLE_MS = 3 * 60 * 60 * 1000;

function isTurn(t: unknown): t is Turn {
  const x = t as Turn;
  return !!x && (x.role === "user" || x.role === "assistant") && typeof x.text === "string";
}

export function saveChat(storage: StorageLike, chat: StoredChat, now: Date = new Date()): void {
  try {
    storage.setItem(
      KEY,
      JSON.stringify({ sessionId: chat.sessionId, turns: chat.turns.slice(-MAX_TURNS), savedAt: now.getTime() }),
    );
  } catch {
    // private mode / blocked storage: the chat just won't survive a page change
  }
}

export function loadChat(storage: StorageLike, now: Date = new Date()): StoredChat | null {
  try {
    const raw = storage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as { sessionId?: unknown; turns?: unknown; savedAt?: unknown };
    if (typeof data.sessionId !== "string" || !Array.isArray(data.turns) || !data.turns.every(isTurn)) return null;
    if (typeof data.savedAt !== "number" || now.getTime() - data.savedAt > MAX_IDLE_MS) return null;
    const turns = data.turns as Turn[];
    // a message whose answer never arrived (page changed mid-request) would look broken: drop it
    if (turns.at(-1)?.role === "user") turns.pop();
    return { sessionId: data.sessionId, turns };
  } catch {
    return null;
  }
}
