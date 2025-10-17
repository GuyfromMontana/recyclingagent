import { createClient } from '@supabase/supabase-js';

// TEST ENDPOINT - Just fetch some data to see if connection works
export default async function handler(req, res) {
  console.log('========================================');
  console.log('🧪 DATABASE CONNECTION TEST');
  console.log('========================================');

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    console.log('🔌 Creating Supabase client...');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
    console.log('✅ Client created');

    // Test 1: Fetch ALL rows from material_pricing (no filters)
    console.log('\n📊 TEST 1: Fetching ALL from material_pricing...');
    const { data: allPricing, error: error1, count: count1 } = await supabase
      .from('material_pricing')
      .select('*', { count: 'exact' });
    
    console.log('  Result:', {
      rowCount: allPricing?.length || 0,
      totalCount: count1,
      hasError: !!error1,
      errorMessage: error1?.message || 'none',
      firstRow: allPricing?.[0] || 'no data'
    });

    // Test 2: Fetch ALL rows from recycle_knowledge
    console.log('\n📊 TEST 2: Fetching ALL from recycle_knowledge...');
    const { data: allKnowledge, error: error2 } = await supabase
      .from('recycle_knowledge')
      .select('*');
    
    console.log('  Result:', {
      rowCount: allKnowledge?.length || 0,
      hasError: !!error2,
      errorMessage: error2?.message || 'none',
      firstRow: allKnowledge?.[0] || 'no data'
    });

    // Test 3: Fetch ALL rows from recycling_materials
    console.log('\n📊 TEST 3: Fetching ALL from recycling_materials...');
    const { data: allMaterials, error: error3 } = await supabase
      .from('recycling_materials')
      .select('*');
    
    console.log('  Result:', {
      rowCount: allMaterials?.length || 0,
      hasError: !!error3,
      errorMessage: error3?.message || 'none',
      firstRow: allMaterials?.[0] || 'no data'
    });

    // Test 4: Simple search for "aluminum"
    console.log('\n🔍 TEST 4: Searching for "aluminum" in material_pricing...');
    const { data: searchTest, error: error4 } = await supabase
      .from('material_pricing')
      .select('*')
      .ilike('question', '%aluminum%');
    
    console.log('  Result:', {
      rowCount: searchTest?.length || 0,
      hasError: !!error4,
      errorMessage: error4?.message || 'none',
      rows: searchTest || 'no data'
    });

    // Return summary
    return res.status(200).json({
      success: true,
      tests: {
        material_pricing: {
          total_rows: allPricing?.length || 0,
          error: error1?.message || null,
          sample: allPricing?.[0] || null
        },
        recycle_knowledge: {
          total_rows: allKnowledge?.length || 0,
          error: error2?.message || null,
          sample: allKnowledge?.[0] || null
        },
        recycling_materials: {
          total_rows: allMaterials?.length || 0,
          error: error3?.message || null,
          sample: allMaterials?.[0] || null
        },
        aluminum_search: {
          matches: searchTest?.length || 0,
          error: error4?.message || null,
          results: searchTest || null
        }
      }
    });

  } catch (error) {
    console.error('💥 ERROR:', error);
    return res.status(500).json({ 
      error: error.message,
      stack: error.stack
    });
  }
}
