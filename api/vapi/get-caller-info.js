import { createClient } from '@supabase/supabase-js';

// ============================================
// GET CALLER INFO - Looks up returning callers
// Checks callback_requests for previous interactions
// ============================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📥 get-caller-info called:', JSON.stringify(req.body, null, 2));

    // Extract from Vapi's nested format
    const toolCall = req.body.message?.toolCalls?.[0];
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

    if (!phone) {
      console.log('❌ No phone number provided');
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

    // Normalize phone number - remove all non-digits, then handle +1
    const normalizedPhone = phone.replace(/\D/g, '').replace(/^1/, '');
    
    // Search for this phone in callback_requests
    // Try multiple formats to match
    const { data, error } = await supabase
      .from('callback_requests')
      .select('caller_name, caller_phone, material_description, created_at')
      .or(`caller_phone.ilike.%${normalizedPhone}%,caller_phone.ilike.%${phone}%`)
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
