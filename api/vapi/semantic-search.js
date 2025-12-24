import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// ============================================
// SEMANTIC SEARCH WITH OPENAI EMBEDDINGS
// ============================================

export default async function handler(req, res) {
  console.log('========================================');
  console.log('🔍 SEMANTIC SEARCH API STARTED');
  console.log('Time:', new Date().toISOString());
  console.log('========================================');

  console.log('📨 Request Method:', req.method);
  console.log('📦 Request Body (raw):', JSON.stringify(req.body, null, 2));
  
  console.log('🔐 Environment Check:');
  console.log('  - SUPABASE_URL exists:', !!process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('  - SUPABASE_KEY exists:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  console.log('  - OPENAI_API_KEY exists:', !!process.env.OPENAI_API_KEY);

  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS request - sending 200');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    console.log('❌ Wrong method - expected POST, got:', req.method);
    return res.status(405).json({ 
      error: 'Method not allowed',
      received_method: req.method
    });
  }

  try {
    console.log('🚀 Starting semantic search');
    
    // EXTRACT QUESTION FROM VAPI'S FORMAT
    let question;
    let toolCallId;
    
    console.log('📋 Extracting question from Vapi format:');
    
    // Vapi sends data in: req.body.message.toolCalls[0].function.arguments.question
    if (req.body?.message?.toolCalls?.[0]?.function?.arguments?.question) {
      question = req.body.message.toolCalls[0].function.arguments.question;
      toolCallId = req.body.message.toolCalls[0].id;
      console.log('  ✅ Found in message.toolCalls[0].function.arguments.question:', question);
      console.log('  ✅ Tool Call ID:', toolCallId);
    }
    
    // Fallback: check if arguments is a JSON string
    if (!question && req.body?.arguments) {
      console.log('  📋 Checking arguments field');
      try {
        const parsedArgs = typeof req.body.arguments === 'string' 
          ? JSON.parse(req.body.arguments) 
          : req.body.arguments;
        question = parsedArgs.question || parsedArgs.query || parsedArgs.material;
        console.log('  ✅ Found in arguments:', question);
      } catch (parseError) {
        console.log('  ❌ Failed to parse arguments:', parseError.message);
      }
    }
    
    // Fallback: direct field access
    if (!question) {
      question = req.body?.question || req.body?.query || req.body?.material;
      if (question) {
        console.log('  ✅ Found in direct field:', question);
      }
    }
    
    console.log('🎯 Final extracted question:', question);
    
    if (!question) {
      console.log('❌ No question found in request');
      console.log('   Body keys available:', Object.keys(req.body || {}));
      return res.status(400).json({ 
        error: 'No question provided',
        hint: 'Send question, query, or material field',
        received_body: req.body
      });
    }

    // Initialize OpenAI
    console.log('🤖 Initializing OpenAI client...');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    console.log('✅ OpenAI client created');

    // Generate embedding for the question
    console.log('🧠 Generating embedding for question...');
    const embeddingResponse = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: question,
    });
    const questionEmbedding = embeddingResponse.data[0].embedding;
    console.log('✅ Embedding generated (length:', questionEmbedding.length, ')');

    // Initialize Supabase
    console.log('🔌 Initializing Supabase client...');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    console.log('✅ Supabase client created');

    // Call semantic search function
    console.log('🔍 Calling search_recycle_knowledge_semantic()...');
    const { data: searchResults, error: searchError } = await supabase
      .rpc('search_recycle_knowledge_semantic', { 
        query_embedding: questionEmbedding,
        match_threshold: 0.5,
        match_count: 3
      });

    if (searchError) {
      console.log('❌ Error calling semantic search:', searchError);
      throw searchError;
    }

    console.log('📊 Search Results:');
    console.log('  - Number of results:', searchResults?.length || 0);
    if (searchResults && searchResults.length > 0) {
      searchResults.forEach((result, index) => {
        console.log(`  - Result ${index + 1}:`);
        console.log(`    Question: ${result.question}`);
        console.log(`    Similarity: ${result.similarity}`);
        console.log(`    Category: ${result.category}`);
      });
    }

    // Return best match if found
    if (searchResults && searchResults.length > 0) {
      const bestMatch = searchResults[0];
      console.log('✅ FOUND MATCH with similarity:', bestMatch.similarity);
      console.log('  Answer:', bestMatch.answer_voice);
      
      const response = {
        results: [{
          toolCallId: toolCallId,
          result: bestMatch.answer_voice
        }]
      };
      console.log('🚀 Sending Vapi-formatted response');
      return res.status(200).json(response);
    }

    // No results found - fallback
    console.log('❌ NO SEMANTIC MATCHES FOUND');
    const fallbackAnswer = "I don't have specific information about that. Please call us at 406-543-1905 and our team will be happy to help you.";
    const response = {
      results: [{
        toolCallId: toolCallId,
        result: fallbackAnswer
      }]
    };
    console.log('🚀 Sending fallback Vapi-formatted response');
    return res.status(200).json(response);

  } catch (error) {
    console.error('💥 ERROR in semantic search:', error);
    console.error('💥 Error message:', error.message);
    console.error('💥 Error stack:', error.stack);
    
    // Return error in Vapi format if possible
    const errorResponse = {
      results: [{
        toolCallId: req.body?.message?.toolCalls?.[0]?.id,
        result: "I'm having trouble searching right now. Please call us at 406-543-1905."
      }]
    };
    return res.status(500).json(errorResponse);
  }
}
