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
    let { material } = req.body;

    // Check if material was provided
    if (!material) {
      return res.status(400).json({ 
        success: false, 
        message: 'Please specify a material to search for' 
      });
    }

    // Normalize the search term to help with variations
    // Convert "number 1" or "number one" to "#1"
    material = material.replace(/number\s+1/i, '#1');
    material = material.replace(/number\s+one/i, '#1');
    material = material.replace(/number\s+2/i, '#2');
    material = material.replace(/number\s+two/i, '#2');

    // First, search for pricing information
    const { data: pricingData } = await supabase
      .from('material_pricing')
      .select('*')
      .ilike('question', `%${material}%`)
      .limit(1);

    // If we found pricing data, return it
    if (pricingData && pricingData.length > 0) {
      const response = pricingData[0].answer_voice || pricingData[0].answer_long || pricingData[0].answer;
      return res.status(200).json({ 
        success: true,
        result: response,
        data: pricingData[0]
      });
    }

    // If no pricing found, search the knowledge base (with underscore!)
    const { data: knowledgeData } = await supabase
      .from('recycle_knowledge')
      .select('*')
      .ilike('question', `%${material}%`)
      .limit(1);

    // If we found knowledge base data, return it
    if (knowledgeData && knowledgeData.length > 0) {
      const response = knowledgeData[0].answer_voice || knowledgeData[0].answer_long || knowledgeData[0].answer;
      return res.status(200).json({ 
        success: true,
        result: response,
        data: knowledgeData[0]
      });
    }

    // If nothing found, search recycling materials FAQ (with underscore!)
    const { data: materialsData } = await supabase
      .from('recycling_materials')
      .select('*')
      .ilike('question', `%${material}%`)
      .limit(1);

    // If we found materials FAQ data, return it
    if (materialsData && materialsData.length > 0) {
      const response = materialsData[0].answer_voice || materialsData[0].answer_long || materialsData[0].answer;
      return res.status(200).json({ 
        success: true,
        result: response,
        data: materialsData[0]
      });
    }

    // If nothing found in any table
    return res.status(404).json({ 
      success: false, 
      message: `I don't have information about ${material}. Please call our team at 406-543-1905.`,
      result: `I don't have information about ${material}. Please call our team at 406-543-1905.`
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