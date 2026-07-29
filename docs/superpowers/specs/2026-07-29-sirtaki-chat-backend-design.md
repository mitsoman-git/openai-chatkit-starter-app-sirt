# Sirtaki Chat Backend — Replace Agent Builder Dependency

**Status:** DRAFT — sections 1-2 walked through live and confirmed; sections 3-7 drafted from decisions already made in conversation, not yet walked through section-by-section. Review before approving.

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
