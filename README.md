# Axmen Recycling Voice Agent

AI phone + web receptionist ("AI Guy") for Axmen Recycling, Missoula MT.
Vapi is the voice platform; this repo holds the two backends behind it.

## What's here

| Path | Runs on | Job |
|---|---|---|
| `api/vapi/*.js` | Vercel (`recyclingagent.vercel.app`) | The 3 Vapi tool endpoints: `get-caller-info`, `search-faqs`, `save-callback` |
| `axmen-backend/main.py` | Railway (`recyclingagent-production.up.railway.app`) | Receives Vapi's `end-of-call-report`, writes transcripts to Zep memory |
| `lib/vapi-auth.js` | shared | `x-vapi-secret` verification + tool-call selection helpers |

There is no frontend. The former React admin UI was removed 2026-06-12 —
staff work the callback queue from the email/SMS/Google Sheet notifications
that `save-callback` sends.

The companion repo (`C:\Users\Guy\Projects\axmen-recycling`) holds the system
prompt, prompt-patcher script, FAQ/pricing seed data, and the Vapi assistant
snapshot.

## How a call works

1. Caller dials 406-543-1905 (or opens the web widget).
2. Assistant calls `get-caller-info` with the caller's number → greeted by name if they've called before (matched against `callback_requests` in Supabase).
3. Material/hours/location questions → `search-faqs` (semantic search over `recycle_knowledge` with keyword fallback).
4. Pricing or anything unknown → `save-callback`: row in `callback_requests`, then email + SMS + Google Sheet notifications fire in parallel.
5. Call ends → Vapi posts the transcript to the Railway service → Zep memory.

**The agent never quotes prices.** Pricing always routes to a human callback.

## Deploy

Push to `main`. Vercel deploys the functions; Railway redeploys `axmen-backend/`.

All webhooks require the `x-vapi-secret` header (set in Vercel + Railway env
and on the Vapi assistant/tools). See `AGENTS.md` for the full operational map.
