
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { requireVapiSecret, findToolCall } from '../../lib/vapi-auth.js';

// ============================================
// SAVE CALLBACK - Saves to callback_requests table
// Sends email + SMS notification to staff
// Posts to Google Sheet for tracking
// ============================================

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);
const resend = new Resend(process.env.RESEND_API_KEY);

// Google Sheet webhook URL
const GOOGLE_SHEET_WEBHOOK = process.env.GOOGLE_SHEET_WEBHOOK || 'YOUR_APPS_SCRIPT_URL_HERE';

// Twilio SMS config — comma-separated E.164 numbers in SMS_RECIPIENTS.
// Prefer a Messaging Service SID (MG...) so the A2P 10DLC campaign is
// applied automatically; fall back to TWILIO_FROM_NUMBER if not set.
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_MESSAGING_SERVICE_SID = process.env.TWILIO_MESSAGING_SERVICE_SID;
const TWILIO_FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;
const SMS_RECIPIENTS = (process.env.SMS_RECIPIENTS || '')
  .split(',')
  .map(n => n.trim())
  .filter(Boolean);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireVapiSecret(req, res)) return;

  try {
    console.log('📥 save-callback called:', JSON.stringify(req.body, null, 2));

    // schedule_callback is a legacy alias still attached in some configs;
    // both route here and we only honor the shared params.
    const toolCall = findToolCall(req, ['save_callback', 'schedule_callback']);
    const toolCallId = toolCall?.id;

    if (!toolCall) {
      console.error('❌ No tool call found');
      return res.status(400).json({ error: 'No tool call found' });
    }

    // Get arguments - handle both direct and nested formats
    const args = toolCall.function?.arguments || {};

    const caller_name = args.caller_name || args.customer_name || args.name || null;
    const raw_phone = args.caller_phone || args.customer_phone || args.phone || null;
    const material_description = args.material_description || args.material || args.message || null;
    const notes = args.notes || null;

    // Store bare 10 digits — get-caller-info matches returning callers on this.
    const caller_phone = normalizePhone(raw_phone);

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

    // Get formatted timestamp for notifications
    const timestamp = new Date().toLocaleString('en-US', { timeZone: 'America/Denver' });

    // Fire all three notification channels together. Each is individually
    // time-bounded and failure-tolerant; running them in parallel caps the
    // caller's dead air at one timeout (~2.5s) instead of the sum of three.
    await Promise.allSettled([
      sendEmail({ caller_name, caller_phone, material_description, notes, timestamp }),
      sendSms({ caller_name, caller_phone, material_description }),
      postToSheet({ caller_name, caller_phone, material_description, notes, timestamp }),
    ]);

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

async function sendEmail({ caller_name, caller_phone, material_description, notes, timestamp }) {
  // Caller fields are transcribed speech — escape them before HTML interpolation.
  const name = escapeHtml(caller_name);
  const phone = escapeHtml(caller_phone);
  const material = escapeHtml(material_description);
  const safeNotes = escapeHtml(notes);

  try {
    const emailResult = await Promise.race([
      resend.emails.send({
        from: 'Axmen Recycling <callbacks@axmen.com>',
        to: ['guy@axmen.com', 'caleb@axmenrecycling.com', 'jake@axmen.com'],
        subject: `📞 New Callback Request - ${caller_name || caller_phone}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626; border-bottom: 2px solid #dc2626; padding-bottom: 10px;">
              📞 New Callback Request
            </h2>

            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 10px; background: #f8f9fa; font-weight: bold; width: 140px;">Name:</td>
                <td style="padding: 10px; background: #f8f9fa;">${name || 'Not provided'}</td>
              </tr>
              <tr>
                <td style="padding: 10px; font-weight: bold;">Phone:</td>
                <td style="padding: 10px;">
                  <a href="tel:${phone}" style="color: #2563eb; font-size: 18px; font-weight: bold;">
                    ${phone}
                  </a>
                </td>
              </tr>
              <tr>
                <td style="padding: 10px; background: #f8f9fa; font-weight: bold;">Asking About:</td>
                <td style="padding: 10px; background: #f8f9fa;">${material || 'Not specified'}</td>
              </tr>
              ${safeNotes ? `
              <tr>
                <td style="padding: 10px; font-weight: bold;">Notes:</td>
                <td style="padding: 10px;">${safeNotes}</td>
              </tr>
              ` : ''}
              <tr>
                <td style="padding: 10px; background: #f8f9fa; font-weight: bold;">Time:</td>
                <td style="padding: 10px; background: #f8f9fa;">${timestamp}</td>
              </tr>
            </table>

            <p style="margin-top: 30px;">
              <a href="tel:${phone}"
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
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('resend timeout')), 2500))
    ]);

    console.log('✅ Email sent:', emailResult);
  } catch (emailError) {
    console.error('⚠️ Email failed (callback still saved):', emailError);
  }
}

async function sendSms({ caller_name, caller_phone, material_description }) {
  const twilioReady =
    TWILIO_ACCOUNT_SID &&
    TWILIO_AUTH_TOKEN &&
    (TWILIO_MESSAGING_SERVICE_SID || TWILIO_FROM_NUMBER) &&
    SMS_RECIPIENTS.length > 0;
  if (!twilioReady) {
    console.log('ℹ️ Twilio SMS not configured, skipping');
    return;
  }

  // Carrier-required STOP language so live traffic matches the A2P
  // campaign sample messages.
  const smsBody = `New Axmen callback: ${caller_name || 'Unknown'} (${caller_phone}) — ${material_description || 'no detail'}\nReply STOP to unsubscribe.`;
  const twilioAuth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
  const smsResults = await Promise.allSettled(
    SMS_RECIPIENTS.map(to => {
      const params = new URLSearchParams({ To: to, Body: smsBody });
      if (TWILIO_MESSAGING_SERVICE_SID) {
        params.set('MessagingServiceSid', TWILIO_MESSAGING_SERVICE_SID);
      } else {
        params.set('From', TWILIO_FROM_NUMBER);
      }
      return fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
        {
          method: 'POST',
          signal: AbortSignal.timeout(2500),
          headers: {
            'Authorization': `Basic ${twilioAuth}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          body: params
        }
      ).then(async r => {
        if (!r.ok) throw new Error(`Twilio ${r.status}: ${await r.text()}`);
        return r.json();
      });
    })
  );
  smsResults.forEach((result, i) => {
    if (result.status === 'fulfilled') {
      console.log(`✅ SMS sent to ${SMS_RECIPIENTS[i]}`);
    } else {
      console.error(`⚠️ SMS to ${SMS_RECIPIENTS[i]} failed:`, result.reason?.message || result.reason);
    }
  });
}

async function postToSheet({ caller_name, caller_phone, material_description, notes, timestamp }) {
  try {
    if (GOOGLE_SHEET_WEBHOOK && GOOGLE_SHEET_WEBHOOK !== 'YOUR_APPS_SCRIPT_URL_HERE') {
      const sheetResponse = await fetch(GOOGLE_SHEET_WEBHOOK, {
        method: 'POST',
        signal: AbortSignal.timeout(2500), // Apps Script webhooks can hang 10-30s; never let that drop the call
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: timestamp,
          name: caller_name || 'Not provided',
          phone: caller_phone,
          askingAbout: material_description || '',
          notes: notes || ''
        })
      });

      if (sheetResponse.ok) {
        console.log('✅ Google Sheet updated');
      } else {
        console.error('⚠️ Google Sheet update failed:', await sheetResponse.text());
      }
    } else {
      console.log('ℹ️ Google Sheet webhook not configured, skipping');
    }
  } catch (sheetError) {
    console.error('⚠️ Google Sheet failed (callback still saved):', sheetError);
  }
}

// Strip to digits, drop the country-code 1 from 11-digit numbers.
// Returns whatever digits remain for non-standard lengths — better to save
// an odd number than lose the lead.
function normalizePhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 11 && digits[0] === '1') return digits.slice(1);
  return digits;
}

function escapeHtml(value) {
  if (value == null) return value;
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Format phone number for natural voice readback
function formatPhoneForVoice(phone) {
  if (!phone) return 'your number';

  const digits = phone.replace(/\D/g, '');

  let d = digits;
  if (digits.length === 11 && digits[0] === '1') {
    d = digits.slice(1);
  }

  if (d.length === 10) {
    return d.split('').map(digit => {
      const words = ['o', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
      return words[parseInt(digit)];
    }).join(' ').replace(/(.{11,13}) (.{11,14}) /, '$1, $2, ');
  }

  return phone;
}
