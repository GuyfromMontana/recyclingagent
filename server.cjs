require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 4000;

// JWT Secret - in production, use a secure random string
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';

// Supabase client with service role (bypasses RLS)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.ADMIN_API_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Middleware
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());

// ============================================
// AUTHENTICATION MIDDLEWARE
// ============================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// ============================================
// AUTHENTICATION ENDPOINTS
// ============================================

// Login endpoint
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Use Supabase Auth to sign in
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Create JWT token
    const token = jwt.sign(
      { 
        email: data.user.email,
        userId: data.user.id 
      },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ 
      token,
      user: {
        email: data.user.email,
        id: data.user.id
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// Verify token endpoint
app.get('/api/auth/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// ============================================
// PROTECTED API ENDPOINTS (require authentication)
// ============================================

// Material Pricing endpoints
app.get('/api/pricing', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('material_pricing')
      .select('*')
      .order('priority', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error fetching pricing:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pricing/search', authenticateToken, async (req, res) => {
  try {
    const { query } = req.query;
    const { data, error } = await supabase
      .from('material_pricing')
      .select('*')
      .or(`intent.ilike.%${query}%,question.ilike.%${query}%,answer_long.ilike.%${query}%`)
      .order('priority', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error searching pricing:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/pricing/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    updates.last_updated = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('material_pricing')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error updating pricing:', err);
    res.status(500).json({ error: err.message });
  }
});

// Knowledge Base endpoints
app.get('/api/recycle-knowledge', authenticateToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('recycle_knowledge')
      .select('*')
      .order('priority', { ascending: false });
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error fetching knowledge:', err);
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/recycle-knowledge/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    
    const { data, error } = await supabase
      .from('recycle_knowledge')
      .update(updates)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error('Error updating knowledge:', err);
    res.status(500).json({ error: err.message });
  }
});

// Call Logs endpoints
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
  } catch (err) {
    console.error('Error fetching conversations:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/conversations/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const { data: conversation, error: convError } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single();
    
    if (convError) throw convError;
    
    const { data: messages, error: msgError } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', id)
      .order('created_at', { ascending: true });
    
    if (msgError) throw msgError;
    
    res.json({ ...conversation, messages });
  } catch (err) {
    console.error('Error fetching conversation details:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================
// PUBLIC ENDPOINTS (no authentication required)
// ============================================

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    authenticated: false 
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🏭 Axmen Recycling Voice Agent API running on port ${PORT}!`);
  console.log(`🔒 Authentication enabled`);
  console.log(`📡 Endpoints available:`);
  console.log(`   POST   /api/auth/login`);
  console.log(`   GET    /api/auth/verify`);
  console.log(`   GET    /api/pricing`);
  console.log(`   GET    /api/pricing/search`);
  console.log(`   PUT    /api/pricing/:id`);
  console.log(`   GET    /api/recycle-knowledge`);
  console.log(`   PUT    /api/recycle-knowledge/:id`);
  console.log(`   GET    /api/conversations`);
  console.log(`   GET    /api/conversations/:id`);
  console.log(`   GET    /health`);
});