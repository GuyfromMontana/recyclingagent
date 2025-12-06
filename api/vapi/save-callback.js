import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

// ============================================
// SAVE CALLBACK - Saves to callback_requests table
// Sends email notification to staff
// ============================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const resend = new Resend(process.env.RESEND_API_KEY);

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
    console.log('📥 save-callback called:', JSON.stringify(req.body, null, 2));

    // Extract from Vapi's nested format
    const toolCall = req.body.message?.toolCalls?.[0];
    const toolCallId = toolCall?.id;

    if (!toolCall) {
      console.error('❌ No tool call found');
      return res.status(400).json({ error: 'No tool call found' });
    }

    // Get arguments - handle both direct and nested formats
    const args = toolCall.function?.arguments || {};
    
    const caller_name = args.caller_name || args.customer_name || args.name || null;
    const caller_phone = args.caller_phone || args.customer_phone || args.phone || null;
    const material_description = args.material_description || args.material || args.message || null;
    const notes = args.notes || null;

    console.log('💾 Saving callback:', { caller_name, caller_phone, material_description, notes });

    // Validate phone number is provided
    if (!caller_phone) {
      console.error('❌ No phone number provided');
      return res.status(200).json({
        results: [{
          toolCallId: toolCallId,
          result: "I need your phone number so we can call you back. What's the best number to reach you?"
        }]
      });
    }

    // Save to callback_requests table
    const { data, error } = await supabase
      .from('callback_requests')
      .insert([{
        caller_name: caller_name,
        caller_phone: caller_phone,
        material_description: material_description,
        notes: notes,
        status: 'new'
      }])
      .select();

    if (error) {
      console.error('❌ Database error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('✅ Callback saved:', data);

    // Send email notification
    try {
      const emailResult = await resend.emails.send({
        from: 'Axmen Recycling <onboarding@resend.dev>',
        to: 'guy@axmen.com',
        subject: `📞 New Callback Request - ${caller_name || caller_phone}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">
              📞 New Callback Request
            </h2>
            
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 10px; background: #f8f9fa; font-weight: bold; width: 140px;">Name:</td>
                <td style="padding: 10px; background: #f8f9fa;">${caller_name || 'Not provided'}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold;">Phone:</td>
                <td style="padding: 10px;">
                  <a href="tel:${caller_phone}" style="color: #2563eb; font-size: 18px; font-weight: bold;">
                    ${caller_phone}
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px; background: #f8f9fa; font-weight: bold;">Asking About:</td>
                <td style="padding: 10px; background: #f8f9fa;">${material_description || 'Not specified'}</td>
              </tr>
              ${notes ? `
              <tr>
                <td style="padding: 10px; font-weight: bold;">Notes:</td>
                <td style="padding: 10px;">${notes}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 10px; background: #f8f9fa; font-weight: bold;">Time:</td>
                <td style="padding: 10px; background: #f8f9fa;">${new Date().toLocaleString('en-US', { timeZone: 'America/Denver' })}</td>
              </tr>
            </table>
            
            <p style="margin-top: 30px;">
              <a href="tel:${caller_phone}" 
                 style="background: #16a34a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                📞 Call Now
              </a>
            </p>
            
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
            <p style="color: #6b7280; font-size: 12px;">
              This callback was captured by the Axmen Recycling voice assistant.
            </p>
          </div>
        `
      });

      console.log('✅ Email sent:', emailResult);
    } catch (emailError) {
      console.error('⚠️ Email failed (callback still saved):', emailError);
      // Don't fail the request if email fails
    }

    // Format phone for voice response
    const phoneFormatted = formatPhoneForVoice(caller_phone);

    // Return success response in Vapi format
    return res.status(200).json({
      results: [{
        toolCallId: toolCallId,
        result: `Got it! Someone from our team will call you back at ${phoneFormatted}. Is there anything else I can help you with?`
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

// Format phone number for natural voice readback
function formatPhoneForVoice(phone) {
  if (!phone) return 'your number';
  
  // Remove non-digits
  const digits = phone.replace(/\D/g, '');
  
  // Handle 10 or 11 digit numbers
  let d = digits;
  if (digits.length === 11 && digits[0] === '1') {
    d = digits.slice(1);
  }
  
  if (d.length === 10) {
    // Convert to voice format: "four o six, five five five, one two three four"
    return d.split('').map(digit => {
      const words = ['o', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
      return words[parseInt(digit)];
    }).join(' ').replace(/(.{11,13}) (.{11,14}) /, '$1, $2, ');
  }
  
  return phone;
}
