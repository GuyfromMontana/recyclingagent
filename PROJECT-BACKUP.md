# PROJECT-BACKUP — recyclingagent

Updated: 2026-06-12

## What this is

Axmen Recycling voice agent backends. Vapi assistant "AI Guy"
(`da4f423e-b699-48db-b5ab-e0a5945f95c7`) answers 406-543-1905 and the website
widget. This repo is webhooks only — **no frontend** (the broken React admin
was deleted 2026-06-12).

## Architecture

```
Caller → Vapi (ElevenLabs voice, Deepgram STT, gpt-4o-mini)
           │ tool calls (x-vapi-secret header, required)
           ├→ Vercel  recyclingagent.vercel.app
           │     api/vapi/get-caller-info  → Supabase callback_requests (returning-caller match)
           │     api/vapi/search-faqs      → recycle_knowledge (semantic RPC + keyword fallback)
           │     api/vapi/save-callback    → insert callback_requests, then email+SMS+Sheet in parallel
           │ end-of-call-report
           └→ Railway recyclingagent-production.up.railway.app
                 axmen-backend/main.py (FastAPI) → Zep memory (transcripts by phone #)
```

## File map

- `api/vapi/*.js` — the 3 tool endpoints (Node serverless, ESM)
- `lib/vapi-auth.js` — `requireVapiSecret` (timing-safe) + `findToolCall` (select by function name)
- `axmen-backend/` — Railway FastAPI end-of-call processor (fastapi, uvicorn, zep-cloud)
- `vercel.json` — explicit routes for the 3 endpoints, nothing else
- `docs/sms-consent-form.md` — Twilio A2P compliance record
- `AGENTS.md` — full operational map; read it first

## Key conventions

- `callback_requests.caller_phone` = bare 10 digits (normalized on write + lookup)
- Agent never quotes prices — pricing always → human callback
- Supabase project is **GuyAI** (`oaftnwtmnwsepfhxpuvm`), not MFC
- Insert before notify; notifications parallel + 2.5s-bounded each

## Deploy

- Push to `main` → Vercel (functions) + Railway (`axmen-backend/`)
- Env: `VAPI_SECRET` (sensitive — value not readable from `vercel env pull`),
  `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `OPENAI_API_KEY`,
  `RESEND_API_KEY`, `GOOGLE_SHEET_WEBHOOK`, Twilio vars (Vercel);
  `VAPI_SECRET` + `ZEP_API_KEY` (Railway, on the SERVICE card)

## Companion repo

`C:\Users\Guy\Projects\axmen-recycling` (branch `master`): system prompt +
patcher (`scripts/axmen_prompt_patch.py` — needs browser User-Agent, Cloudflare
blocks urllib's default), FAQ/pricing seeds, assistant snapshot
(`voice-agent/axmen_assistant.json` — re-export after any live config change).

## Status 2026-06-12

- Vercel: ✅ live, auth verified
- Vapi: ✅ 3 tools attached (schedule_callback orphan detached), voicemail typo fixed
- Railway: 🔴 502 — see AGENTS.md backlog (likely VAPI_SECRET missing on service card since May)
- Hours mismatch (prompt vs FAQ row): unresolved, needs Guy
