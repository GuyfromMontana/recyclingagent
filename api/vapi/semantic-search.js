import { createClient } from '@supabase/supabase-js';

// ============================================
// SIMPLIFIED FAQ SEARCH - Uses recycle_knowledge table
// No pricing info - redirects pricing questions to callback
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
    console.log('🔍 search-faqs called:', JSON.stringify(req.body, null, 2));

    // Extract from Vapi's nested format
    const toolCall = req.body.message?.toolCalls?.[0];
    const toolCallId = toolCall?.id;
    
    // Get the question from various possible locations
    let question = toolCall?.function?.arguments?.question 
      || toolCall?.function?.arguments?.query
      || toolCall?.function?.arguments?.material
      || req.body?.question 
      || req.body?.query;

    console.log('📝 Question:', question);
    console.log('🔑 Tool Call ID:', toolCallId);

    if (!question) {
      console.log('❌ No question provided');
      return res.status(400).json({ 
        error: 'No question provided',
        received: req.body 
      });
    }

    const query = question.toLowerCase().trim();
    const keywords = extractKeywords(query);
    console.log('🔑 Keywords:', keywords);

    // Strategy 1: Search by keywords in question field
    let result = null;

    if (keywords.length > 0) {
      // Build OR conditions for each keyword
      const conditions = keywords.map(k => `question.ilike.%${k}%`).join(',');
      
      const { data, error } = await supabase
        .from('recycle_knowledge')
        .select('*')
        .or(conditions)
        .eq('is_active', true)
        .limit(5);

      if (error) {
        console.error('❌ Query error:', error);
      } else if (data && data.length > 0) {
        // Score results by keyword match count
        const scored = data.map(row => {
          let score = 0;
          const rowText = (row.question + ' ' + (row.tags?.join(' ') || '')).toLowerCase();
          keywords.forEach(k => {
            if (rowText.includes(k)) score++;
          });
          return { ...row, score };
        }).sort((a, b) => b.score - a.score);

        result = scored[0];
        console.log('✅ Found match:', result.question, 'Score:', result.score);
      }
    }

    // Strategy 2: Check tags array if no match yet
    if (!result && keywords.length > 0) {
      const { data, error } = await supabase
        .from('recycle_knowledge')
        .select('*')
        .eq('is_active', true);

      if (!error && data) {
        for (const row of data) {
          if (row.tags && Array.isArray(row.tags)) {
            const matchCount = keywords.filter(k => 
              row.tags.some(rk => rk.toLowerCase().includes(k) || k.includes(rk.toLowerCase()))
            ).length;
            
            if (matchCount > 0) {
              if (!result || matchCount > result.matchCount) {
                result = { ...row, matchCount };
              }
            }
          }
        }
        if (result) {
          console.log('✅ Found via tags array:', result.question);
        }
      }
    }

    // Build response
    let answer;
    
    if (result) {
      answer = result.answer_voice;
      console.log('📤 Returning answer:', answer);
    } else {
      // No match found - offer to take a message
      answer = "I don't have specific information about that. Let me take your information and have someone from our team call you back. What's your name?";
      console.log('⚠️ No match found, offering callback');
    }

    // Return in Vapi format
    return res.status(200).json({
      results: [{
        toolCallId: toolCallId,
        result: answer
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

// Extract meaningful keywords from the question
function extractKeywords(text) {
  const stopWords = [
    'what', 'is', 'the', 'how', 'much', 'do', 'you', 'take', 'accept', 
    'can', 'i', 'we', 'does', 'are', 'for', 'of', 'a', 'an', 'and',
    'your', 'my', 'there', 'where', 'when', 'will', 'would', 'could',
    'have', 'has', 'had', 'be', 'been', 'being', 'at', 'on', 'in',
    'to', 'from', 'with', 'about', 'get', 'got', 'guy', 'guys'
  ];
  
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word));
}
