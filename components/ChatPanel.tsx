"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { ERROR_REPLY, GREETING, PLACEHOLDER_INPUT, STARTER_PROMPTS } from "@/lib/config";
import { tokenizeLine } from "@/lib/formatReply";
import { loadChat, saveChat } from "@/lib/chatStore";
import type { Turn } from "@/lib/types";

function ReplyText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {tokenizeLine(line).map((t, j) =>
            t.type === "bold" ? (
              <strong key={j}>{t.text}</strong>
            ) : t.type === "link" ? (
              <a
                key={j}
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
                className="break-words underline underline-offset-2"
              >
                {t.text}
              </a>
            ) : (
              <Fragment key={j}>{t.text}</Fragment>
            ),
          )}
        </Fragment>
      ))}
    </>
  );
}

export function ChatPanel() {
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID());
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const [hydrated, setHydrated] = useState(false);

  // The chat lives in an iframe that reloads on every page of the site: keep the conversation for this tab.
  useEffect(() => {
    try {
      const saved = loadChat(window.sessionStorage);
      if (saved) {
        setSessionId(saved.sessionId);
        setTurns(saved.turns);
      }
    } catch {
      // storage blocked: start fresh
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      saveChat(window.sessionStorage, { sessionId, turns });
    } catch {
      // storage blocked
    }
  }, [hydrated, sessionId, turns]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, pending]);

  async function send(raw: string) {
    const message = raw.trim();
    if (!message || pending) return;
    const history = turns;
    setTurns([...history, { role: "user", text: message }]);
    setInput("");
    setPending(true);
    let reply = ERROR_REPLY;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, sessionId }),
      });
      if (res.ok) {
        const data = (await res.json()) as { reply?: string };
        if (data.reply) reply = data.reply;
      }
    } catch {
      reply = ERROR_REPLY;
    }
    setTurns((current) => [...current, { role: "assistant", text: reply }]);
    setPending(false);
  }

  const bubble = "max-w-[85%] rounded-2xl px-4 py-2 text-[15px] leading-relaxed";
  const assistantBubble = "self-start bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100";
  const userBubble = "self-end bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900";

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className={`${bubble} ${assistantBubble}`}>{GREETING}</div>
          {turns.map((t, i) => (
            <div key={i} className={`${bubble} ${t.role === "user" ? userBubble : assistantBubble}`}>
              <ReplyText text={t.text} />
            </div>
          ))}
          {pending && (
            <div className={`${bubble} ${assistantBubble}`} aria-live="polite">
              …
            </div>
          )}
          {turns.length === 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {STARTER_PROMPTS.map((s) => (
                <button
                  key={s.label}
                  type="button"
                  onClick={() => void send(s.prompt)}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
          <div ref={endRef} />
        </div>
      </div>
      <form
        className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
        onSubmit={(e) => {
          e.preventDefault();
          void send(input);
        }}
      >
        <div className="mx-auto flex max-w-3xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={PLACEHOLDER_INPUT}
            maxLength={1000}
            className="min-w-0 flex-1 rounded-full border border-slate-300 bg-transparent px-4 py-2 text-base text-slate-900 outline-none dark:border-slate-700 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={pending || input.trim() === ""}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
