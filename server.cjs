require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 4000;

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.ADMIN_API_KEY
);

// Middleware
app.use(cors());
app.use(express.json());

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Authentication middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// ==========================================
// PUBLIC ENDPOINTS (No Authentication)
// ==========================================

// Health check
app.get('/', (req, res) => {
  res.json({ 
    status: 'ok', 
    message: 'Axmen Recycling Admin API',
    version: '1.0.0'
  });
});

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Sign in with Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        id: data.user.id, 
        email: data.user.email 
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: data.user.id,
        email: data.user.email,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// VAPI PRICING SEARCH ENDPOINT (Public - for voice agent)
app.get('/api/vapi/search-pricing', async (req, res) => {
  try {
    const searchTerm = req.query.material || '';
    
    if (!searchTerm) {
      return res.json({ 
        success: false, 
        message: "Please specify a material to search for" 
      });
    }

    const { data, error } = await supabase
      .from('material_pricing')
      .select('*')
      .ilike('question', `%${searchTerm}%`)
      .eq('active', true)
      .order('priority', { ascending: false })
      .limit(1);

    if (error) throw error;

    if (!data || data.length === 0) {
      return res.json({
        success: false,
        message: `I don't have pricing information for ${searchTerm}. Our staff can give you a quote if you bring it in.`
      });
    }

    const material = data[0];
    return res.json({
      success: true,
      material: material.question,
      price: material.answer_voice || material.answer_long,
      category: material.category
    });

  } catch (error) {
    console.error('Error searching pricing:', error);
    res.status(500).json({ 
      success: false, 
      message: "Error retrieving pricing information" 
    });
  }
});

// ==========================================
// PROTECTED ENDPOINTS (Require Authentication)
// ==========================================

// Get all material pricing
app.get('/api/pricing', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('material_pricing')
      .select('*')
      .order('priority', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching pricing:', error);
    res.status(500).json({ error: 'Failed to fetch pricing data' });
  }
});

// Get single material pricing
app.get('/api/pricing/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('material_pricing')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching pricing:', error);
    res.status(500).json({ error: 'Failed to fetch pricing data' });
  }
});

// Update material pricing
app.put('/api/pricing/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Add last_updated timestamp
    updates.last_updated = new Date().toISOString();

    const { data, error } = await supabase
      .from('material_pricing')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating pricing:', error);
    res.status(500).json({ error: 'Failed to update pricing data' });
  }
});

// Create new material pricing
app.post('/api/pricing', authenticateToken, async (req, res) => {
  try {
    const newMaterial = req.body;
    
    const { data, error } = await supabase
      .from('material_pricing')
      .insert([newMaterial])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating pricing:', error);
    res.status(500).json({ error: 'Failed to create pricing data' });
  }
});

// Delete material pricing
app.delete('/api/pricing/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('material_pricing')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    console.error('Error deleting pricing:', error);
    res.status(500).json({ error: 'Failed to delete pricing data' });
  }
});

// ==========================================
// KNOWLEDGE BASE ENDPOINTS
// ==========================================

// Get all knowledge base entries
app.get('/api/recycle-knowledge', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('recycle_knowledge')
      .select('*')
      .order('priority', { ascending: false });

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching knowledge:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge data' });
  }
});

// Get single knowledge entry
app.get('/api/recycle-knowledge/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('recycle_knowledge')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching knowledge:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge data' });
  }
});

// Update knowledge entry
app.put('/api/recycle-knowledge/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    // Add last_updated timestamp
    updates.last_updated = new Date().toISOString();

    const { data, error } = await supabase
      .from('recycle_knowledge')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating knowledge:', error);
    res.status(500).json({ error: 'Failed to update knowledge data' });
  }
});

// Create new knowledge entry
app.post('/api/recycle-knowledge', authenticateToken, async (req, res) => {
  try {
    const newEntry = req.body;
    
    const { data, error } = await supabase
      .from('recycle_knowledge')
      .insert([newEntry])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating knowledge:', error);
    res.status(500).json({ error: 'Failed to create knowledge data' });
  }
});

// Delete knowledge entry
app.delete('/api/recycle-knowledge/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { error } = await supabase
      .from('recycle_knowledge')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ message: 'Knowledge entry deleted successfully' });
  } catch (error) {
    console.error('Error deleting knowledge:', error);
    res.status(500).json({ error: 'Failed to delete knowledge data' });
  }
});

// ==========================================
// CALL LOGS / CONVERSATIONS ENDPOINTS
// ==========================================

// Get all conversations
app.get('/api/conversations', authenticateToken, async (req, res) => {
  try {
    const { status } = req.query;
    
    let query = supabase
      .from('conversations')
      .select('*')
      .order('start_time', { ascending: false });
    
    if (status && status !== 'all') {
      query = query.eq('resolution_status', status);
    }

    const { data, error } = await query;

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({ error: 'Failed to fetch conversations' });
  }
});

// Get single conversation with messages
app.get('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get conversation
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();

    if (convError) throw convError;

    // Get messages for this conversation
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });

    if (msgError) throw msgError;

    res.json({
      ...conversation,
      messages: messages || []
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({ error: 'Failed to fetch conversation details' });
  }
});

// Create new conversation (for Vapi to log calls)
app.post('/api/conversations', async (req, res) => {
  try {
    const newConversation = req.body;
    
    const { data, error } = await supabase
      .from('conversations')
      .insert([newConversation])
      .select()
      .single();

    if (error) throw error;
    res.status(201).json(data);
  } catch (error) {
    console.error('Error creating conversation:', error);
    res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Update conversation
app.put('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const { data, error } = await supabase
      .from('conversations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json(data);
  } catch (error) {
    console.error('Error updating conversation:', error);
    res.status(500).json({ error: 'Failed to update conversation' });
  }
});

// ==========================================
// START SERVER
// ==========================================

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});