import { createClient } from '@supabase/supabase-js';
import { requireVapiSecret } from '../../lib/vapi-auth.js';

// ============================================
// Handles Vapi's data format for pricing lookups
// ============================================

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!requireVapiSecret(req, res)) return;

  try {
    console.log('🚀 Starting main try block');
    
    // CRITICAL FIX: Handle Vapi's deeply nested data format
    let material;
    let toolCallId;
    
    console.log('📋 Checking fields:');
    
    // Vapi sends data in a deeply nested structure:
    // req.body.message.toolCalls[0].function.arguments.material
    if (req.body?.message?.toolCalls?.[0]?.function?.arguments?.material) {
      material = req.body.message.toolCalls[0].function.arguments.material;
      toolCallId = req.body.message.toolCalls[0].id; // EXTRACT THE TOOL CALL ID!
      console.log('  ✅ Found in message.toolCalls[0].function.arguments.material:', material);
      console.log('  ✅ Tool Call ID:', toolCallId);
    }
    
    // Fallback: check if arguments is a JSON string
    if (!material && req.body?.arguments) {
      console.log('  📋 Checking arguments field');
      try {
        const parsedArgs = typeof req.body.arguments === 'string' 
          ? JSON.parse(req.body.arguments) 
          : req.body.arguments;
        material = parsedArgs.material || parsedArgs.query || parsedArgs.question;
        console.log('  ✅ Found in arguments:', material);
      } catch (parseError) {
        console.log('  ❌ Failed to parse arguments:', parseError.message);
      }
    }
    
    // Fallback: direct field access
    if (!material) {
      material = req.body?.material || req.body?.query || req.body?.question;
      if (material) {
        console.log('  ✅ Found in direct field:', material);
      }
    }
    
    console.log('🎯 Final extracted material:', material);
    
    if (!material) {
      console.log('❌ No material found in request');
      console.log('   Body keys available:', Object.keys(req.body || {}));
      return res.status(400).json({ 
        error: 'No query provided',
        hint: 'Send material, query, or question field',
        received_body: req.body
      });
    }

    // Initialize Supabase
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );

    // SPECIAL TEST MODE - if material is "TEST_DATABASE", show all data
    if (material.toUpperCase() === 'TEST_DATABASE' || material.toUpperCase().includes('TEST')) {
      console.log('🧪 TEST MODE ACTIVATED - Fetching all database data...');
      
      const { data: allPricing, error: e1 } = await supabase
        .from('material_pricing')
        .select('*')
        .limit(5);
      
      const { data: allKnowledge, error: e2 } = await supabase
        .from('recycle_knowledge')
        .select('*')
        .limit(5);
      
      console.log('📊 Database Test Results:');
      console.log('  material_pricing rows:', allPricing?.length || 0);
      console.log('  recycle_knowledge rows:', allKnowledge?.length || 0);
      
      const testResponse = `Test mode: Found ${allPricing?.length || 0} pricing rows and ${allKnowledge?.length || 0} knowledge rows. Check Vercel logs for details.`;
      const response = {
        results: [{
          toolCallId: toolCallId,
          result: testResponse
        }]
      };
      console.log('  🚀 Sending test mode Vapi-formatted response');
      return res.status(200).json(response);
    }

    // Normalize and prepare search terms
    const query = material.toLowerCase().trim();
    console.log('📝 Normalized query:', query);
    
    const keywords = extractKeywords(query);
    console.log('🔑 Extracted keywords:', keywords);
    
    const normalized = normalizeQuestion(query);
    console.log('🔄 Normalized question:', normalized);

    console.log('🔍 Starting database searches...');

    // Strategy 1: Exact match in material_pricing
    console.log('  Strategy 1: Exact match in material_pricing');
    const { data: exactPricing, error: error1 } = await supabase
      .from('material_pricing')
      .select('*')
      .or(`question.ilike.%${query}%,intent.ilike.%${query}%`)
      .eq('active', true)
      .order('priority', { ascending: false })
      .limit(1);

    if (error1) console.log('  ❌ Error in strategy 1:', error1.message);
    if (exactPricing?.length > 0) {
      console.log('  ✅ FOUND in strategy 1');
      console.log('  Answer:', exactPricing[0].answer_voice);
      const response = {
        results: [{
          toolCallId: toolCallId,
          result: exactPricing[0].answer_voice
        }]
      };
      console.log('  🚀 Sending Vapi-formatted response:', JSON.stringify(response));
      return res.status(200).json(response);
    }
    console.log('  ⚠️ No results in strategy 1');

    // Strategy 2: Exact match in recycle_knowledge
    console.log('  Strategy 2: Exact match in recycle_knowledge');
    const { data: exactKnowledge, error: error2 } = await supabase
      .from('recycle_knowledge')
      .select('*')
      .or(`question.ilike.%${query}%,intent.ilike.%${query}%`)
      .eq('is_active', true)
      .order('priority', { ascending: false })
      .limit(1);

    if (error2) console.log('  ❌ Error in strategy 2:', error2.message);
    if (exactKnowledge?.length > 0) {
      console.log('  ✅ FOUND in strategy 2');
      console.log('  Answer:', exactKnowledge[0].answer_voice);
      const response = {
        results: [{
          toolCallId: toolCallId,
          result: exactKnowledge[0].answer_voice
        }]
      };
      console.log('  🚀 Sending Vapi-formatted response:', JSON.stringify(response));
      return res.status(200).json(response);
    }
    console.log('  ⚠️ No results in strategy 2');

    // Strategy 3: Keyword search in material_pricing
    if (keywords.length > 0) {
      console.log('  Strategy 3: Keyword search in material_pricing');
      const keywordConditions = keywords.map(k => 
        `question.ilike.%${k}%,answer_voice.ilike.%${k}%,intent.ilike.%${k}%`
      ).join(',');
      
      const { data: keywordPricing, error: error3 } = await supabase
        .from('material_pricing')
        .select('*')
        .or(keywordConditions)
        .eq('active', true)
        .order('priority', { ascending: false })
        .limit(1);

      if (error3) console.log('  ❌ Error in strategy 3:', error3.message);
      if (keywordPricing?.length > 0) {
        console.log('  ✅ FOUND in strategy 3');
        console.log('  Answer:', keywordPricing[0].answer_voice);
        const response = {
          results: [{
            toolCallId: toolCallId,
            result: keywordPricing[0].answer_voice
          }]
        };
        console.log('  🚀 Sending Vapi-formatted response:', JSON.stringify(response));
        return res.status(200).json(response);
      }
      console.log('  ⚠️ No results in strategy 3');
    }

    // Strategy 4: Keyword search in recycle_knowledge
    if (keywords.length > 0) {
      console.log('  Strategy 4: Keyword search in recycle_knowledge');
      const keywordConditions = keywords.map(k => 
        `question.ilike.%${k}%,answer_voice.ilike.%${k}%,intent.ilike.%${k}%`
      ).join(',');
      
      const { data: keywordKnowledge, error: error4 } = await supabase
        .from('recycle_knowledge')
        .select('*')
        .or(keywordConditions)
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .limit(1);

      if (error4) console.log('  ❌ Error in strategy 4:', error4.message);
      if (keywordKnowledge?.length > 0) {
        console.log('  ✅ FOUND in strategy 4');
        console.log('  Answer:', keywordKnowledge[0].answer_voice);
        const response = {
          results: [{
            toolCallId: toolCallId,
            result: keywordKnowledge[0].answer_voice
          }]
        };
        console.log('  🚀 Sending Vapi-formatted response:', JSON.stringify(response));
        return res.status(200).json(response);
      }
      console.log('  ⚠️ No results in strategy 4');
    }

    // Strategy 5: Normalized question search
    if (normalized !== query) {
      console.log('  Strategy 5: Normalized search');
      const { data: normalizedData, error: error5 } = await supabase
        .from('recycle_knowledge')
        .select('*')
        .or(`question.ilike.%${normalized}%,answer_voice.ilike.%${normalized}%`)
        .eq('is_active', true)
        .order('priority', { ascending: false })
        .limit(1);

      if (error5) console.log('  ❌ Error in strategy 5:', error5.message);
      if (normalizedData?.length > 0) {
        console.log('  ✅ FOUND in strategy 5');
        console.log('  Answer:', normalizedData[0].answer_voice);
        const response = {
          results: [{
            toolCallId: toolCallId,
            result: normalizedData[0].answer_voice
          }]
        };
        console.log('  🚀 Sending Vapi-formatted response:', JSON.stringify(response));
        return res.status(200).json(response);
      }
      console.log('  ⚠️ No results in strategy 5');
    }

    // No results found
    console.log('❌ NO RESULTS FOUND in any strategy');
    const fallbackAnswer = "I don't have specific information about that. Please call us at 406-543-1905 and our team will be happy to help you.";
    const response = {
      results: [{
        toolCallId: toolCallId,
        result: fallbackAnswer
      }]
    };
    console.log('  🚀 Sending fallback Vapi-formatted response:', JSON.stringify(response));
    return res.status(200).json(response);

  } catch (error) {
    console.error('💥 ERROR in try block:', error);
    console.error('💥 Error message:', error.message);
    console.error('💥 Error stack:', error.stack);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      type: error.name
    });
  }
}

// Helper function to extract keywords
function extractKeywords(text) {
  const stopWords = ['what', 'is', 'the', 'how', 'much', 'do', 'you', 'take', 'accept', 'can', 'i', 'we', 'does', 'are', 'for', 'of', 'a', 'an'];
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 2 && !stopWords.includes(word));
}

// Helper function to normalize questions
function normalizeQuestion(text) {
  return text
    .replace(/don'?t\s+(take|accept)/gi, 'not take')
    .replace(/can'?t\s+(take|accept)/gi, 'not take')
    .replace(/won'?t\s+(take|accept)/gi, 'not take')
    .replace(/do\s+not\s+(take|accept)/gi, 'not take')
    .toLowerCase();
}

