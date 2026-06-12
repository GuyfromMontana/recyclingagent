# Project context

**Axmen Recycling Voice Agent** — AI phone + web receptionist for Axmen Recycling, Missoula. Character: "AI Guy" — sarcastic, self-deprecating, scrap-yard personality. Handles hours / location / material questions via FAQ search; routes pricing and unknown questions to human callback.

Vapi is the voice provider. There are **two backends**:

1. **Vercel** (this repo's `api/vapi/*.js`) — the 3 Vapi tool endpoints. Nothing else.
2. **Railway** (`axmen-backend/main.py`, FastAPI) — receives Vapi's assistant-level `end-of-call-report` and writes the transcript to Zep memory. That is its only job.

**There is no admin UI and no frontend.** The React admin app, `server.cjs` Express dev server, and the orphan endpoints (`save-message`, `search-pricing`, `semantic-search`, `test-database`) were deleted 2026-06-12 — the admin's production API never existed (it called `/api/auth/*` and `/api/pricing` routes that were only in the local Express server), so nothing was lost. Staff work the callback queue from the email/SMS/Google Sheet notifications. Knowledge-base edits happen in Supabase directly (or via the seed SQL in the companion repo).

This is the **app repo**. The companion repo is `axmen-recycling` (at `C:\Users\Guy\Projects\axmen-recycling\`) — that one holds prompts, the FAQ knowledge base seed, the pricing toolkit, the Vapi prompt-patcher script, and the assistant config snapshot. Coordinate edits across both.

## Stack
- **Tool endpoints:** Node serverless functions under `api/` on Vercel (`recyclingagent.vercel.app`)
- **End-of-call processor:** FastAPI on Railway at `recyclingagent-production.up.railway.app` (deps: fastapi, uvicorn, zep-cloud only)
- **Voice platform:** Vapi (assistant `da4f423e-b699-48db-b5ab-e0a5945f95c7`, org `0ced00ed-af56-4754-b3df-3765679fda1d`)
- **DB:** Supabase project **GuyAI** (`oaftnwtmnwsepfhxpuvm`) — NOT the MFC project. Tables: `recycle_knowledge`, `material_pricing`, `callback_requests`.
- **Voice:** ElevenLabs `eleven_turbo_v2_5` (`6F0d2ON2P4jTXAWS1ohx`, speed 1.1)
- **STT:** Deepgram nova-2 (conf 0.45)
- **LLM:** gpt-4o-mini

## Branches & deploy
- **Production branch is `main`** for this repo. (The companion `axmen-recycling` repo is on `master`.)
- Vercel deploys on push to `main`; Railway redeploys on push to `main` for `axmen-backend/`.

## Business facts (keep in sync with `recycle_knowledge` + prompt)
- Company: Axmen Recycling (dba of Montana Recycling Inc, EIN 37-2143634).
- Address: 9780 Summit Drive, Missoula, MT 59808.
- Phone: 406-543-1905.
- ⚠️ **Hours mismatch still UNRESOLVED (as of 2026-06-12):** the live prompt says "Mon-Fri 8-5, Sat 9-2" (and hardcodes that in an example call); `recycle_knowledge` hours row says "Tue-Sat 8 AM-4 PM"; the deleted admin UI said seasonal Tue-Sat hours. Two of three sources said Tue-Sat. Confirm with Guy, then fix the prompt (via the patcher) AND the FAQ row together.

## Tool routing (the real map)

All 3 routes go to Vercel, secret-gated:

| Tool | Function name | Endpoint |
|---|---|---|
| `2c4b8818-…` | `get-caller-info` | `recyclingagent.vercel.app/api/vapi/get-caller-info` |
| `db1b2144-…` | `search_faqs` | `recyclingagent.vercel.app/api/vapi/search-faqs` |
| `f7c62faf-…` | `save_callback` | `recyclingagent.vercel.app/api/vapi/save-callback` |

Assistant-level `server.url` (for `end-of-call-report`): `https://recyclingagent-production.up.railway.app`.

The half-built `schedule_callback` tool (`63b3996e-…`) was **detached from the assistant 2026-06-12**. The org-level tool object still exists in Vapi; delete it there if it's ever in the way. `save-callback.js` still accepts its function name as an alias just in case.

## Vapi auth — don't unwind

Every Vapi webhook requires the `x-vapi-secret` header. Without it, 401.

- 256-bit shared secret lives in `VAPI_SECRET` (Vercel prod + Railway prod) and is set on Vapi `assistant.server.secret` + all tools' `server.secret`.
- Verification helper: `lib/vapi-auth.js` → `requireVapiSecret(req)` (timing-safe compare). **Don't add a new Vapi-facing endpoint without applying it.**
- `lib/vapi-auth.js` also exports `findToolCall(req, names)` — selects this endpoint's tool call from Vapi's `toolCalls` array by function name instead of blindly taking `[0]`. Use it in any new endpoint.
- Railway `axmen-backend/main.py` requires `VAPI_SECRET` at startup and verifies on every webhook (`hmac.compare_digest`).
- Vercel server-side Supabase clients use `SUPABASE_SERVICE_ROLE_KEY` (anon key is the dev fallback only).
- Vapi endpoints have **no CORS preamble** — they're server-to-server, no browser; don't add it.

## Phone number convention (load-bearing)

`callback_requests.caller_phone` is stored as **bare 10 digits** (e.g. `4065431905`). `save-callback.js` normalizes on write (strips non-digits, drops a leading country-code 1); `get-caller-info.js` normalizes the lookup the same way and substring-matches so legacy `+1XXXXXXXXXX` rows still hit. Don't store formatted numbers.

Never interpolate raw caller input into a PostgREST `.or()` filter — commas/parens break the filter grammar (this bit the MFC build too). Digits-only or `extractKeywords`-sanitized values only.

## Pricing rule (load-bearing)

**The agent never quotes prices live. Always callback.** This is in the system prompt and is the reason `material_pricing` exists but isn't used by the assistant — it's seed data for the human callback. Pricing logic lives in the companion `axmen-recycling` repo:

- `pricing/axmen_formulas.json` — single `_default` key with tiers (0.75 / 0.60 / 0.55) applied to supplier (Binford) prices
- `pricing/axmen_excel.py` — generates the public pricing PDF via ReportLab

Don't add a pricing tool the agent can call. (`search-pricing.js` used to exist for this; it was deleted, intentionally.)

## save-callback behavior

1. Insert into `callback_requests` FIRST — notifications can never lose a lead.
2. Then email (Resend, from `callbacks@axmen.com` to Guy/Caleb/Jake), SMS (Twilio, A2P STOP language required), and Google Sheet post fire **in parallel via `Promise.allSettled`**, each bounded at 2.5s. Don't serialize them — that's caller dead air.
3. Caller-derived strings are HTML-escaped before the email template. Keep it that way.

## Prompt patcher

`scripts/axmen_prompt_patch.py` (in the companion `axmen-recycling` repo) reads `.env` (`VAPI_API_KEY` + `AXMEN_ASSISTANT_ID`), diffs `prompts/axmen-updated-system-prompt.md` against the live Vapi prompt, and PATCHes if different. This is the canonical update path — don't hand-edit the prompt in the Vapi dashboard without then mirroring back to the file, or the next patcher run reverts it.

The live prompt uses Jinja `{% if customer.number %}` to branch the phone vs. web greeting.

The assistant snapshot lives at `voice-agent/axmen_assistant.json` in the companion repo. Re-export it (GET `/assistant/{id}`) after any live config change — a stale snapshot already misled one review (`isServerUrlSecretSet: false` from Feb 2026 when auth had been live since May).

## Supabase tables

- `recycle_knowledge` — FAQ entries. Active flag is `is_active` (not `active`). Has `answer_voice`, `priority`, `tags`, embeddings for the `search_recycle_knowledge_semantic` RPC.
- `material_pricing` — same shape but active flag is `active` (not `is_active`). Schema asymmetry is real; don't try to "fix" it without confirming nothing reads both.
- `callback_requests` — written by `save-callback.js`, read by `get-caller-info.js` for returning-caller detection. Phone format: bare 10 digits (see above).
- `customer_messages` and `conversations` exist but nothing reads or writes them anymore (their endpoints were deleted). Candidates for dropping.

## Watch out

- **Two-repo coordination.** Prompt + knowledge seeds + pricing + patcher + snapshot live in `axmen-recycling`. Tool endpoints + end-of-call processor live here.
- **`is_active` vs `active` flag mismatch** between `recycle_knowledge` and `material_pricing`.
- **The Supabase project is GuyAI (`oaftnwtmnwsepfhxpuvm`)**, not MFC — an earlier version of this doc said MFC and that's wrong.

## Backlog (open as of 2026-06-12)

- **🔴 Railway is 502 ("Application failed to respond")** — discovered 2026-06-12, needs the Railway dashboard (no CLI/token on this machine). Likely crash-looping since the 2026-05-11 deploy added the `VAPI_SECRET` startup requirement: if that var was set at the project root instead of the SERVICE card (the classic Railway footgun), `main.py` raises at boot. Check the service's deploy logs for `ValueError: VAPI_SECRET environment variable is required`, set `VAPI_SECRET` + `ZEP_API_KEY` on the service card, redeploy. Symptom while down: calls work fine (tools are Vercel) but transcripts never reach Zep, so returning-caller memory silently stops accumulating.
- **Resolve the hours mismatch** (needs Guy: which hours are right?) — then patch prompt + FAQ row together.
- Audit + clean ~13 abandoned Vapi assistants in the org (8 MFC + 5 test).
- Optionally delete the detached `schedule_callback` tool object (`63b3996e-…`) at the Vapi org level.
- Optionally drop the unused `customer_messages` / `conversations` tables in Supabase.
- If an admin UI is ever wanted again, build it as real Vercel functions with Supabase Auth — don't resurrect the old Express/JWT pattern.

## Related memory

- `project_axmen_voice_agent.md` — same project, broader history.
- `project_voice_agent_stack.md` — platform decisions across Axmen / MFC / next-build.
- `feedback_voice_agent_debugging_workflow.md` + `feedback_voice_agent_asr_and_robustness.md` — hard-won lessons from the MFC Retell build, much of it applicable here.
