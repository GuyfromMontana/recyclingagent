import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

export default async function handler(req, res) {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      success: false, 
      message: 'Method not allowed. Use POST.' 
    });
  }

  try {
    // Get the material from the request body
    const { material } = req.body;

    // Check if material was provided
    if (!material) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please specify a material to search for' 
      });
    }

    // Search for the material in the database
    const { data, error } = await supabase
      .from('material_pricing')
      .select('*')
      .ilike('name', `%${material}%`)
      .limit(1)
      .single();

    // Handle database errors
    if (error) {
      console.error('Supabase error:', error);
      return res.status(404).json({ 
        success: false, 
        message: `I don't have pricing information for ${material}. Please call our team at 406-543-1905.`,
        result: `I don't have pricing information for ${material}. Please call our team at 406-543-1905.`
      });
    }

    // Format the response for Vapi
    const response = `We pay $${data.price} per pound for ${data.name}. ${data.notes || ''}`.trim();

    return res.status(200).json({ 
      success: true,
      result: response,
      data: data
    });

  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'An error occurred. Please call 406-543-1905.',
      result: 'An error occurred. Please call 406-543-1905.'
    });
  }
}