# Sirtaki Chat Backend — Replace Agent Builder Dependency

**Status:** REVISED 2026-10-31 after exporting the live workflow (`docs/agent-builder-export.md`). Section 10 lists what changed versus the 2026-07-29 draft and overrides any older line it contradicts.

## 1. Why

OpenAI is shutting down Agent Builder (the visual canvas hosting our classifier + 4 specialized agents as a hosted workflow) on **2026-11-30**. The current repo (`openai-chatkit-starter-app-sirt`, forked from OpenAI's ChatKit starter) has no real backend logic of its own — `app/api/create-session/route.ts` just exchanges a `workflow_id` for a ChatKit `client_secret`, and the `<openai-chatkit>` web component in the browser does everything else by talking directly to the OpenAI-hosted workflow. When Agent Builder shuts down, this breaks entirely.

## 2. Goals / Non-goals

**Goals:**
- Replace the Agent Builder dependency with our own logic, running entirely inside this same Next.js/TypeScript repo (no Python, no new hosting service beyond what Vercel already provides).
- Reuse the 6 already-written system prompts (classifier, meze agent, reservation agent, general assistant's 7 blocks, menu agent) as-is.
- Let the owner keep reviewing customer conversations after the migration (previously done via Agent Builder's built-in logs).
- Keep the same customer-facing embed (`sirtaki-tavern.gr/ai/` iframe → same Vercel deployment).

**Non-goals (for this iteration):**
- No streaming ("typing" effect) — full response only, per owner's choice.
- No vector store / file search for the knowledge base — KB content (menu, wineries, wines) is small enough to inline directly in system prompts.
- No admin editing UI for the knowledge base — updates still happen by editing files in the repo (owner's explicit choice, same workflow as today).

## 3. Architecture

```
Customer browser (iframe on sirtaki-tavern.gr/ai/)
        │
        ▼
Custom chat widget (React component, this repo)
        │  POST /api/chat  { message, history }
        ▼
Next.js API route (Node.js serverless function, Vercel)
        │
        ├─ 1. Call OpenAI with classifier_agent_instructions → get category
        │      (meze / reserve / get_information / greeting)
        ├─ 2. Call OpenAI again with the matching specialized system prompt
        │      + conversation history + the new message
        ├─ 3. Store the exchange in Postgres (Neon, via Vercel integration)
        ▼
Full response text back to the widget (no streaming)
```

Two sequential OpenAI calls per customer message (classify, then respond), both on GPT-5.4 mini.

## 4. Components

**New files:**
- `app/api/chat/route.ts` — the orchestration endpoint described above (Node.js runtime, not edge, since it needs to read the bundled prompt files).
- `lib/agents/` — the 6 prompt files copied into the repo (from the Mac "Knowledge Base" folder) as plain `.md`, loaded at request time.
- `lib/agents/loadPrompt.ts` — small helper that reads and caches the right prompt file(s) for a given category (the `get_information` category concatenates the general assistant's 7 blocks + the menu KB content).
- `components/ChatPanel.tsx` — replaces `ChatKitPanel.tsx`. A simple message list + input box + send button, styled to match the existing card/theme look (reuses `useColorScheme`).
- `lib/db.ts` — Postgres client + a `conversations` / `messages` table for logging.
- `app/admin/page.tsx` — password-protected page listing conversations (simple shared-secret via env var, not a full auth system — appropriate for one owner checking logs occasionally).

**Removed:**
- `components/ChatKitPanel.tsx`, `app/api/create-session/route.ts`, the `@openai/chatkit-react` dependency, the `chatkit.js` `<Script>` tag in `app/layout.tsx`, `NEXT_PUBLIC_CHATKIT_WORKFLOW_ID`.

**Kept as-is:**
- `app/App.tsx` (just swaps which panel component it renders), `hooks/useColorScheme.ts`, `app/globals.css`, Tailwind setup.

## 5. Data flow (one customer message)

1. Widget sends `{ message, history }` (history = prior turns in this browser session, kept client-side — no server session store needed beyond the logging DB).
2. API route calls OpenAI (Responses API) with `classifier_agent_instructions.md` as the system prompt + the latest user message only (classification doesn't need full history). Reads back one of the 4 category strings.
3. API route picks the matching prompt bundle and calls OpenAI again with that system prompt + full conversation history + new message.
4. API route writes `{ session_id, role: user, text }` and `{ session_id, role: assistant, text, category }` rows to Postgres.
5. Returns `{ reply: string }` to the widget; widget appends it to the visible thread and to the history it will resend next turn.

## 6. Model & hosting notes

- **Model:** GPT-5.4 mini for both calls (owner's choice — better instruction-following than nano for our multi-rule prompts, still cheap).
- **API:** OpenAI Responses API (the modern, actively-supported path — not the deprecating Assistants API), called via plain `fetch`, matching the existing code style in this repo rather than adding the `openai` npm package as a new dependency.
- **Hosting:** stays on Vercel, same project, same `sirtaki-tavern.gr/ai/` iframe embed.
- **⚠️ Known risk, accepted for now:** Vercel's Hobby plan Terms of Service prohibit commercial use, and this is a commercial restaurant's customer-facing tool. Vercel could suspend the project if flagged. Owner has chosen to stay on Hobby for now and revisit (upgrade to Pro, $20/mo) if it becomes a problem — flagging again here so it isn't forgotten.
- **⚠️ Function timeout:** Vercel Hobby serverless functions have a short execution limit (historically ~10s). Two sequential mini-model calls should normally fit, but this is worth watching once real traffic/long prompts are in play — Pro plan raises this ceiling.

## 7. Error handling

- If the classifier call fails (network/API error): fall back to `get_information` category rather than failing the whole request — worst case, a meze question gets a slightly generic answer instead of no answer.
- If the main response call fails: return a friendly fallback ("I'm sorry, something went wrong on my end — please try again or reach us on WhatsApp") consistent with the tone already established in the prompts' own "WHAT TO DO IF YOU DON'T KNOW" sections.
- If Postgres logging fails: log the error server-side but do NOT block or fail the customer-facing response — logging is best-effort, never a reason to break the chat.

## 8. Testing approach

Given the size of this project (one small team, one owner reviewing), full automated test suites would be over-engineering. Planned approach:
- A handful of scripted example conversations (reused from the ones already baked into the classifier and agent prompt files as "CORRECT classification" examples) run manually against the deployed preview URL before merging, to sanity-check routing.
- Manual check of the admin log page showing a real conversation end-to-end.
- No unit-test framework introduced for this iteration — revisit if the codebase grows.

## 9. Open items before implementation

- Copy the 6 prompt files from the Mac "Knowledge Base" folder into `lib/agents/` in this repo (need the menu KB, wineries, and wines files too, for the `get_information` bundle).
- Confirm exact wording/branding for the `/admin` page and its shared-secret env var name.
- Decide the widget's visual styling details (colors, avatar, etc.) — can follow the existing app's dark/light theme conventions already in place.

## 10. Revisions after the Agent Builder export (2026-10-31)

The export in `docs/agent-builder-export.md` is the source of truth for current behavior. Findings and decisions:

1. **Graph.** Start → Guardrails → Classify Agent → If/else → Meze Agent / Reservation Agent / Sirtaki Assistant (for both `get_information` and `greeting`). Guardrail fail → static fallback reply. Else → classifier result (never reached: the schema enum has 4 values).
2. **Model.** Today every node runs `gpt-4o-mini` (temperature 1, top P 1, max 2048 tokens; fallback 10000). Model id is read from env `OPENAI_MODEL`; default is the owner's chosen GPT-5.4 mini id. The implementation must not send `temperature`/`top_p` (not accepted by the GPT-5 family). The exact model id is verified against `GET /v1/models` before the first deploy.
3. **File search is dropped.** The vector store held only `menu_2026_bilingual.md` (23 KB), `wineries-2026.md` (20 KB), `wines_sirtaki_2026.md` (15 KB); only the Sirtaki Assistant node had the File search tool. These three files (copied from `AI Agent/Knowledge Base/menu 2026/`) are appended inline under a `# KNOWLEDGE BASE` heading in the Sirtaki Assistant system prompt. Meze and Reservation agents never had the tool and get no KB. Prompts that say "search the knowledge base" are kept verbatim; the KB heading carries one sentence saying the knowledge base is the section below.
4. **Six extra assistant messages.** In the `get_information` and `greeting` branches the workflow inserts six assistant-role messages (Location & Directions, Family Staff, Hours & Contact, Menu, Sommelier, Event Planning) before the run. They are moved into the Sirtaki Assistant system prompt, in the same order, each under its original `Extra assistant message N` title. This is a deliberate, small behavior change (system instead of assistant role); the routing/answers check in section 8 covers it.
5. **Guardrails are kept, lighter.** (a) PII: block messages containing a Luhn-valid 13-19 digit card number (the only configured entity relevant to guests; US bank/passport/SSN entities are dropped). (b) Jailbreak: one small `gpt-4.1-mini`-class call run in parallel with the classifier, returning `{jailbreak: boolean, confidence: number}`; fail when `jailbreak` is true and `confidence >= 0.7`. On failure the reply is the static fallback text from the export's fallback agent examples (no model call). If the jailbreak call itself errors, the message is allowed through.
6. **Calls per message.** Classifier + jailbreak check in parallel, then one response call. Still two sequential steps.
7. **Logging.** One table `messages(id, session_id, role, text, category, created_at)`; `/admin` groups by `session_id`. Replaces the `conversations`/`messages` pair.
8. **Admin auth.** HTTP Basic auth in `middleware.ts` for `/admin`, password from env `ADMIN_PASSWORD`.
9. **Testing.** Section 8 is replaced: Vitest (dev dependency) for the pure logic with an injected `fetch`, plus an opt-in live routing check (`LIVE=1`) that runs the classifier examples from the prompt against the real model.
10. **Request limits.** `/api/chat` accepts a message of at most 1000 characters and the last 20 history turns; anything else is rejected with 400 or truncated as stated in the plan.
11. **Stale facts noticed in the prompts (not fixed here).** The hours block mentions "Sunday Open Exception 27 September 2026" and the Meze/Reservation prompts hardcode the year 2026. They are copied verbatim; the owner updates them in `lib/agents/prompts/` afterwards.
