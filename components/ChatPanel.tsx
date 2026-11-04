"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import { UI, langFromSearch, type Lang } from "@/lib/i18n";
import { tokenizeLine } from "@/lib/formatReply";
import { parseLeadClick, reportLeadClick } from "@/lib/leadClick";
import { loadChat, saveChat } from "@/lib/chatStore";
import type { Turn } from "@/lib/types";

// Links to the restaurant's own site (e.g. the prefilled contact form) open in the same tab, so the chat keeps its history.
function isSiteLink(href: string): boolean {
  try {
    return /(^|\.)sirtaki-tavern\.gr$/.test(new URL(href).hostname);
  } catch {
    return false;
  }
}

const EMOJI_ONLY = /^[\s\p{Extended_Pictographic}\uFE0F\u200D]*$/u;

type Token = ReturnType<typeof tokenizeLine>[number];

/** A line made only of an emoji and one link (e.g. "📱 [Send on WhatsApp](...)") is shown as a button. */
function buttonOf(tokens: Token[]): { emoji: string; link: Extract<Token, { type: "link" }> } | null {
  const links = tokens.filter((t) => t.type === "link");
  if (links.length !== 1) return null;
  const rest = tokens.filter((t) => t.type !== "link");
  if (!rest.every((t) => t.type === "text" && EMOJI_ONLY.test(t.text))) return null;
  const emoji = rest.map((t) => (t.type === "text" ? t.text.trim() : "")).join("");
  return { emoji, link: links[0] as Extract<Token, { type: "link" }> };
}

function ReplyText({ text, lang }: { text: string; lang: Lang }) {
  const lines = text.split("\n").map((line) => tokenizeLine(line));
  const buttons = lines.map(buttonOf);
  return (
    <>
      {lines.map((tokens, i) => {
        const btn = buttons[i];
        const spacer = i > 0 && !btn && !buttons[i - 1] ? <br /> : null;
        if (btn) {
          const wa = btn.link.href.startsWith("https://wa.me/");
          return (
            <a
              key={i}
              href={btn.link.href}
              target={isSiteLink(btn.link.href) ? "_top" : "_blank"}
              rel="noopener noreferrer"
              onClick={() => {
                const lead = parseLeadClick(btn.link.href);
                if (lead) reportLeadClick(lead, lang);
              }}
              className={`mt-4 flex min-h-11 w-64 max-w-full items-center justify-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold no-underline ${
                wa
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-slate-400 text-slate-800 dark:border-slate-500 dark:text-slate-100"
              }`}
            >
              {btn.emoji && <span aria-hidden="true">{btn.emoji}</span>}
              <span className="break-words">{btn.link.text}</span>
            </a>
          );
        }
        return (
          <Fragment key={i}>
            {spacer}
            {tokens.map((t, j) =>
              t.type === "bold" ? (
                <strong key={j}>{t.text}</strong>
              ) : t.type === "image" ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={j} src={t.src} alt={t.alt} className="my-2 block max-h-60 max-w-full rounded-lg object-cover" loading="lazy" />
              ) : t.type === "link" ? (
                <a
                  key={j}
                  href={t.href}
                  target={isSiteLink(t.href) ? "_top" : "_blank"}
                  rel="noopener noreferrer"
                  onClick={() => {
                    const lead = parseLeadClick(t.href);
                    if (lead) reportLeadClick(lead, lang);
                  }}
                  className="break-words underline underline-offset-2"
                >
                  {t.text}
                </a>
              ) : (
                <Fragment key={j}>{t.text}</Fragment>
              ),
            )}
          </Fragment>
        );
      })}
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
  const [lang, setLang] = useState<Lang>("en");
  const ui = UI[lang];

  // The chat lives in an iframe that reloads on every page of the site: keep the conversation for this tab.
  useEffect(() => {
    setLang(langFromSearch(window.location.search));
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
    let reply = ui.error;
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, history, sessionId }),
      });
      if (res.ok || res.status === 429) {
        const data = (await res.json()) as { reply?: string };
        if (data.reply) reply = data.reply;
      }
    } catch {
      reply = ui.error;
    }
    setTurns((current) => [...current, { role: "assistant", text: reply }]);
    setPending(false);
  }

  function newChat() {
    if (pending) return;
    setSessionId(crypto.randomUUID());
    setTurns([]);
    setInput("");
  }

  if (!hydrated) return <div className="h-full" />;

  const bubble = "max-w-[85%] rounded-2xl px-4 py-2 text-[15px] leading-relaxed";
  const assistantBubble = "self-start bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-100";
  const userBubble = "self-end bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900";

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        <div className="mx-auto flex max-w-3xl flex-col gap-3">
          <div className={`${bubble} ${assistantBubble}`}>{ui.greeting}</div>
          {turns.map((t, i) => (
            <div key={i} className={`${bubble} ${t.role === "user" ? userBubble : assistantBubble}`}>
              <ReplyText text={t.text} lang={lang} />
            </div>
          ))}
          {pending && (
            <div className={`${bubble} ${assistantBubble}`} aria-live="polite">
              …
            </div>
          )}
          {turns.length === 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {ui.starters.map((s) => (
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
        {turns.length > 0 && (
          <div className="mx-auto flex max-w-3xl justify-end pb-2">
            <button
              type="button"
              onClick={newChat}
              disabled={pending}
              className="text-xs text-slate-500 underline disabled:opacity-40 dark:text-slate-400"
            >
              {ui.newChat}
            </button>
          </div>
        )}
        <div className="mx-auto flex max-w-3xl gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={ui.placeholder}
            maxLength={1000}
            className="min-w-0 flex-1 rounded-full border border-slate-300 bg-transparent px-4 py-2 text-base text-slate-900 outline-none dark:border-slate-700 dark:text-slate-100"
          />
          <button
            type="submit"
            disabled={pending || input.trim() === ""}
            className="rounded-full bg-slate-900 px-5 py-2 text-sm font-medium text-white disabled:opacity-40 dark:bg-slate-100 dark:text-slate-900"
          >
            {ui.send}
          </button>
        </div>
      </form>
    </div>
  );
}
