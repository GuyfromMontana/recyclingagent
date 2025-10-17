import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    console.log('📥 Received message request:', JSON.stringify(req.body));

    // Extract the tool call from Vapi's request
    const toolCall = req.body.message?.toolCalls?.[0];
    
    if (!toolCall) {
      console.error('❌ No tool call found in request');
      return res.status(400).json({ error: 'No tool call found' });
    }

    const { customer_name, customer_phone, message } = toolCall.function.arguments;

    console.log('💾 Saving message:', { customer_name, customer_phone, message });

    // Save to database
    const { data, error } = await supabase
      .from('customer_messages')
      .insert([
        {
          customer_name: customer_name || 'Unknown',
          customer_phone: customer_phone || 'Not provided',
          message: message || 'No message provided',
          status: 'new'
        }
      ])
      .select();

    if (error) {
      console.error('❌ Database error:', error);
      return res.status(500).json({ error: error.message });
    }

    console.log('✅ Message saved successfully:', data);

    // Return response in Vapi format
    return res.status(200).json({
      results: [
        {
          toolCallId: toolCall.id,
          result: "Thank you! I've recorded your message and someone from Axmen Recycling will call you back soon at " + customer_phone + "."
        }
      ]
    });

  } catch (error) {
    console.error('❌ Error saving message:', error);
    return res.status(500).json({ error: error.message });
  }
}