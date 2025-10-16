import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Helper function to extract important keywords
function extractKeywords(text) {
  // Common words to ignore
  const stopWords = ['is', 'are', 'the', 'a', 'an', 'you', 'your', 'do', 'does', 
                     'can', 'could', 'would', 'should', 'there', 'anything', 'something',
                     'i', 'me', 'my', 'we', 'us', 'what', 'how', 'when', 'where', 'why',
                     'have', 'has', 'had', 'for', 'of', 'to', 'in', 'on', 'at', 'that'];
  
  // Split into words and filter
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ') // Remove punctuation
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word));
  
  return words.join(' ');
}

// Helper function to normalize negative phrases
function normalizeQuestion(text) {
  let normalized = text.toLowerCase();
  
  // Normalize negative phrases
  normalized = normalized.replace(/don't|dont|do not/g, 'not');
  normalized = normalized.replace(/can't|cant|cannot/g, 'not');
  normalized = normalized.replace(/won't|wont|will not/g, 'not');
  normalized = normalized.replace(/isn't|isnt|is not/g, 'not');
  
  // Normalize common variations
  normalized = normalized.replace(/accept/g, 'take');
  normalized = normalized.replace(/business hours|open hours|hours of operation/g, 'hours');
  normalized = normalized.replace(/location|address|where.*located/g, 'located');
  normalized = normalized.replace(/phone.*number|contact.*number/g, 'phone');
  
  return normalized;
}

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

    // Normalize the search term
    material = material.replace(/number\s+1/i, '#1');
    material = material.replace(/number\s+one/i, '#1');
    material = material.replace(/number\s+2/i, '#2');
    material = material.replace(/number\s+two/i, '#2');

    // Extract keywords for better searching
    const keywords = extractKeywords(material);
    const normalized = normalizeQuestion(material);

    console.log('Original query:', material);
    console.log('Keywords:', keywords);
    console.log('Normalized:', normalized);

    // STRATEGY 1: Try exact question match first (most accurate)
    const { data: exactMatch } = await supabase
      .from('material_pricing')
      .select('*')
      .ilike('question', `%${material}%`)
      .limit(1);

    if (exactMatch && exactMatch.length > 0) {
      const response = exactMatch[0].answer_voice || exactMatch[0].answer_long;
      return res.status(200).json({ 
        success: true,
        result: response,
        data: exactMatch[0],
        source: 'material_pricing',
        match_type: 'exact'
      });
    }

    // STRATEGY 2: Search knowledge base with exact match
    const { data: exactKnowledge } = await supabase
      .from('recycle_knowledge')
      .select('*')
      .ilike('question', `%${material}%`)
      .eq('is_active', true)
      .limit(1);

    if (exactKnowledge && exactKnowledge.length > 0) {
      const response = exactKnowledge[0].answer_voice || exactKnowledge[0].answer_long;
      return res.status(200).json({ 
        success: true,
        result: response,
        data: exactKnowledge[0],
        source: 'recycle_knowledge',
        match_type: 'exact'
      });
    }

    // STRATEGY 3: Search with keywords across multiple fields (pricing)
    const { data: keywordPricing } = await supabase
      .from('material_pricing')
      .select('*')
      .or(`question.ilike.%${keywords}%,answer_voice.ilike.%${keywords}%,category.ilike.%${keywords}%`)
      .eq('active', true)
      .order('priority', { ascending: false })
      .limit(1);

    if (keywordPricing && keywordPricing.length > 0) {
      const response = keywordPricing[0].answer_voice || keywordPricing[0].answer_long;
      return res.status(200).json({ 
        success: true,
        result: response,
        data: keywordPricing[0],
        source: 'material_pricing',
        match_type: 'keyword'
      });
    }

    // STRATEGY 4: Search knowledge base with keywords
    const { data: keywordKnowledge } = await supabase
      .from('recycle_knowledge')
      .select('*')
      .or(`question.ilike.%${keywords}%,answer_voice.ilike.%${keywords}%,category.ilike.%${keywords}%`)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(1);

    if (keywordKnowledge && keywordKnowledge.length > 0) {
      const response = keywordKnowledge[0].answer_voice || keywordKnowledge[0].answer_long;
      return res.status(200).json({ 
        success: true,
        result: response,
        data: keywordKnowledge[0],
        source: 'recycle_knowledge',
        match_type: 'keyword'
      });
    }

    // STRATEGY 5: Try normalized search (handles "don't take" vs "can't take")
    const { data: normalizedData } = await supabase
      .from('recycle_knowledge')
      .select('*')
      .or(`question.ilike.%${normalized}%,answer_voice.ilike.%${normalized}%`)
      .eq('is_active', true)
      .limit(1);

    if (normalizedData && normalizedData.length > 0) {
      const response = normalizedData[0].answer_voice || normalizedData[0].answer_long;
      return res.status(200).json({ 
        success: true,
        result: response,
        data: normalizedData[0],
        source: 'recycle_knowledge',
        match_type: 'normalized'
      });
    }

    // STRATEGY 6: Search recycling_materials by material name
    const { data: materialsData } = await supabase
      .from('recycling_materials')
      .select('*')
      .or(`material_name.ilike.%${material}%,description.ilike.%${keywords}%,category.ilike.%${keywords}%`)
      .eq('is_active', true)
      .limit(1);

    if (materialsData && materialsData.length > 0) {
      const mat = materialsData[0];
      let response = `${mat.material_name}`;
      
      if (mat.current_price) {
        response += ` is currently priced at $${mat.current_price} per ${mat.price_unit || 'unit'}`;
      } else {
        response += ` - please call us for current pricing`;
      }
      
      if (mat.description) {
        response += `. ${mat.description}`;
      }

      return res.status(200).json({ 
        success: true,
        result: response,
        data: mat,
        source: 'recycling_materials',
        match_type: 'material'
      });
    }

    // Nothing found after all strategies
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

