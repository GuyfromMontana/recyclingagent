import { createClient } from '@supabase/supabase-js';
import { requireVapiSecret, findToolCall } from '../../lib/vapi-auth.js';

// ============================================
// GET CALLER INFO - Looks up returning callers
// Checks callback_requests for previous interactions
// ============================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireVapiSecret(req, res)) return;

  try {
    console.log('📥 get-caller-info called:', JSON.stringify(req.body, null, 2));

    const toolCall = findToolCall(req, ['get-caller-info', 'get_caller_info']);
    const toolCallId = toolCall?.id;

    if (!toolCall) {
      console.error('❌ No tool call found');
      return res.status(400).json({ error: 'No tool call found' });
    }

    // Get the phone number - try multiple sources
    const args = toolCall.function?.arguments || {};
    let phone = args.phone_number || args.caller_phone || args.phone;

    // Also try to get from the call object itself
    if (!phone && req.body.message?.call?.customer?.number) {
      phone = req.body.message.call.customer.number;
    }

    console.log('📞 Looking up phone:', phone);

    // Normalize to bare 10 digits — the format save-callback stores.
    // Digits-only also keeps the ilike pattern safe for PostgREST (commas/parens
    // in a raw phone string break the filter grammar).
    const normalizedPhone = normalizePhone(phone);

    // A short fragment would substring-match unrelated callers; treat as no phone.
    if (!normalizedPhone || normalizedPhone.length < 7) {
      console.log('❌ No usable phone number provided');
      return res.status(200).json({
        results: [{
          toolCallId: toolCallId,
          result: JSON.stringify({
            is_returning: false,
            caller_name: null,
            message: "No phone number available"
          })
        }]
      });
    }

    // Search for this phone in callback_requests. Substring match so legacy
    // rows stored as +1XXXXXXXXXX still hit.
    const { data, error } = await supabase
      .from('callback_requests')
      .select('caller_name, caller_phone, material_description, created_at')
      .ilike('caller_phone', `%${normalizedPhone}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('❌ Database error:', error);
      return res.status(200).json({
        results: [{
          toolCallId: toolCallId,
          result: JSON.stringify({
            is_returning: false,
            caller_name: null,
            message: "Database error"
          })
        }]
      });
    }

    console.log('📊 Query results:', data);

    if (data && data.length > 0 && data[0].caller_name) {
      const callerName = data[0].caller_name;
      const firstName = callerName.split(' ')[0]; // Get first name only

      console.log('✅ Found returning caller:', firstName);

      return res.status(200).json({
        results: [{
          toolCallId: toolCallId,
          result: JSON.stringify({
            is_returning: true,
            caller_name: firstName,
            full_name: callerName,
            phone_number: data[0].caller_phone || phone, // so the agent doesn't re-ask
            message: `Returning caller: ${firstName}`
          })
        }]
      });
    }

    // No match found - new caller
    console.log('👋 New caller - no previous record');
    return res.status(200).json({
      results: [{
        toolCallId: toolCallId,
        result: JSON.stringify({
          is_returning: false,
          caller_name: null,
          phone_number: phone, // number they're calling from, so the agent can confirm it
          message: "New caller"
        })
      }]
    });

  } catch (error) {
    console.error('💥 Error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
}

// Strip to digits, drop the country-code 1 from 11-digit numbers.
function normalizePhone(phone) {
  if (!phone) return '';
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 11 && digits[0] === '1') return digits.slice(1);
  return digits;
}
