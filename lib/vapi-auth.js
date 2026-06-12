import { timingSafeEqual } from 'node:crypto';

// Verifies the x-vapi-secret header on incoming Vapi webhooks.
// Vapi sends the assistant- or tool-level `server.secret` as this header.
// Returns true if the request is authorized; otherwise writes a 401 to res
// and returns false (caller should `return` immediately).
//
// Canonical pattern from VapiAI/example-webhook-handler:src/utils/auth.js

export function requireVapiSecret(req, res) {
  const expected = process.env.VAPI_SECRET;
  if (!expected) {
    console.error('VAPI_SECRET env var not set; refusing request');
    res.status(500).json({ error: 'Server misconfigured: VAPI_SECRET unset' });
    return false;
  }
  const provided = req.headers['x-vapi-secret'];
  if (!provided || !safeEqual(provided, expected)) {
    console.warn('Rejected webhook: missing or invalid x-vapi-secret');
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

function safeEqual(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

// Vapi sends a toolCalls array; pick the call this endpoint owns rather than
// blindly taking [0], so a batched request can't hand us another tool's call.
// `names` lists the function names that route here (e.g. save_callback and
// its schedule_callback alias). Falls back to [0] for unnamed/legacy payloads.
export function findToolCall(req, names) {
  const toolCalls = req.body?.message?.toolCalls || [];
  return toolCalls.find(tc => names.includes(tc.function?.name)) || toolCalls[0] || null;
}
