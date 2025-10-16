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
    material = material.replace(/number\s+1/i, '#1');
    material = material.replace(/number\s+one/i, '#1');
    material = material.replace(/number\s+2/i, '#2');
    material = material.replace(/number\s+two/i, '#2');

    // STEP 1: Search material_pricing table for questions
    const { data: pricingData } = await supabase
      .from('material_pricing')
      .select('*')
      .ilike('question', `%${material}%`)
      .limit(1);

    if (pricingData && pricingData.length > 0) {
      const response = pricingData[0].answer_voice || pricingData[0].answer_long;
      return res.status(200).json({ 
        success: true,
        result: response,
        data: pricingData[0],
        source: 'material_pricing'
      });
    }

    // STEP 2: Search recycle_knowledge table for questions
    const { data: knowledgeData } = await supabase
      .from('recycle_knowledge')
      .select('*')
      .ilike('question', `%${material}%`)
      .limit(1);

    if (knowledgeData && knowledgeData.length > 0) {
      const response = knowledgeData[0].answer_voice || knowledgeData[0].answer_long;
      return res.status(200).json({ 
        success: true,
        result: response,
        data: knowledgeData[0],
        source: 'recycle_knowledge'
      });
    }

    // STEP 3: Search recycling_materials by material_name (not question!)
    const { data: materialsData } = await supabase
      .from('recycling_materials')
      .select('*')
      .or(`material_name.ilike.%${material}%,description.ilike.%${material}%`)
      .eq('is_active', true)
      .limit(1);

    if (materialsData && materialsData.length > 0) {
      const mat = materialsData[0];
      // Build a response from the material data
      let response = `${mat.material_name}`;
      
      if (mat.current_price) {
        response += ` is currently priced at $${mat.current_price} per ${mat.price_unit || 'unit'}`;
      }
      
      if (mat.description) {
        response += `. ${mat.description}`;
      }

      return res.status(200).json({ 
        success: true,
        result: response,
        data: mat,
        source: 'recycling_materials'
      });
    }

    // STEP 4: Nothing found in any table
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
      result: 'An error occurred. Please call 406-543-1905.',
      error: error.message
    });
  }
}
