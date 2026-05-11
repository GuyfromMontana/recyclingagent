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
  if (!provided || provided !== expected) {
    console.warn('Rejected webhook: missing or invalid x-vapi-secret');
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
