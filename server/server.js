// server/server.js
// Express backend with JWT auth, MongoDB persistence, and Ollama (Llama3) chat proxying

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const path = require('path');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const MONGODB_URI = process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const DEFAULT_MODEL = process.env.DEFAULT_MODEL || 'llama3';

if (!MONGODB_URI) {
  console.warn('⚠️  MONGODB_URI is not set in .env — the server cannot start without MongoDB.');
}

if (!JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET is not set in .env — authentication will fail until you set it.');
}

console.log(`📡 Ollama configured at: ${OLLAMA_URL}`);

const userSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    passwordHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    lastLoginAt: { type: Date }
  },
  { versionKey: false }
);

const conversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, default: 'New Conversation' },
    messages: [
      {
        role: { type: String, required: true },
        content: { type: String, required: true },
        timestamp: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true, versionKey: false }
);

const User = mongoose.model('User', userSchema);
const Conversation = mongoose.model('Conversation', conversationSchema);

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function createToken(user) {
  return jwt.sign({ sub: user._id.toString(), username: user.username }, JWT_SECRET, { expiresIn: '7d' });
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'Missing auth token' });
  }

  try {
    req.auth = jwt.verify(token, JWT_SECRET);
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function seedDemoAccount() {
  const username = 'demo';
  const password = 'demo123';
  const existing = await User.findOne({ username });

  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash });
    await Conversation.create({ user: user._id, title: 'First Conversation' });
    console.log('✅ Demo account ready: demo / demo123');
  }
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'username must be at least 3 characters' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'password must be at least 4 characters' });
    }

    const existing = await User.findOne({ username });
    if (existing) {
      return res.status(409).json({ error: 'Username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash });
    await Conversation.create({ user: user._id, title: 'New Conversation' });

    const token = createToken(user);
    return res.status(201).json({ token, user: { id: user._id, username: user.username } });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const username = normalizeUsername(req.body.username);
    const password = String(req.body.password || '');

    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = createToken(user);
    return res.json({ token, user: { id: user._id, username: user.username } });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

// ==========================================
// Conversation Routes
// ==========================================

// List all conversations for current user (newest first)
app.get('/api/conversations', authRequired, async (req, res) => {
  try {
    const convos = await Conversation.find({ user: req.auth.sub })
      .select('_id title createdAt messages')
      .lean();

    const list = convos
      .map(c => ({
        id: c._id,
        title: c.title,
        messageCount: c.messages.length,
        lastMessage: c.messages.length > 0 ? c.messages[c.messages.length - 1].content.slice(0, 60) : '',
        createdAt: c.createdAt
      }))
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return res.json({ conversations: list });
  } catch (error) {
    console.error('Conversations list error:', error);
    return res.status(500).json({ error: 'Failed to list conversations' });
  }
});

// Create a new conversation
app.post('/api/conversations', authRequired, async (req, res) => {
  try {
    const title = String(req.body.title || 'New Conversation').slice(0, 100);
    const convo = await Conversation.create({ user: req.auth.sub, title });
    return res.status(201).json({ id: convo._id, title: convo.title, createdAt: convo.createdAt });
  } catch (error) {
    console.error('Create conversation error:', error);
    return res.status(500).json({ error: 'Failed to create conversation' });
  }
});

// Get messages for a specific conversation
app.get('/api/conversations/:id', authRequired, async (req, res) => {
  try {
    const convo = await Conversation.findOne({ _id: req.params.id, user: req.auth.sub }).lean();
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    return res.json({ messages: convo.messages, title: convo.title });
  } catch (error) {
    console.error('Get conversation error:', error);
    return res.status(500).json({ error: 'Failed to load conversation' });
  }
});

// Rename a conversation (auto-set title from first user message)
app.patch('/api/conversations/:id', authRequired, async (req, res) => {
  try {
    const title = String(req.body.title || 'New Conversation').slice(0, 100);
    const convo = await Conversation.findOneAndUpdate(
      { _id: req.params.id, user: req.auth.sub },
      { $set: { title } },
      { new: true }
    );
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });
    return res.json({ id: convo._id, title: convo.title });
  } catch (error) {
    console.error('Rename conversation error:', error);
    return res.status(500).json({ error: 'Failed to rename conversation' });
  }
});

// Add a message to a conversation
app.post('/api/conversations/:id/messages', authRequired, async (req, res) => {
  try {
    const { role, content } = req.body;
    if (!role || !content) return res.status(400).json({ error: 'role and content are required' });

    const convo = await Conversation.findOne({ _id: req.params.id, user: req.auth.sub });
    if (!convo) return res.status(404).json({ error: 'Conversation not found' });

    convo.messages.push({ role, content, timestamp: new Date() });

    // Auto-title from first user message
    if (convo.title === 'New Conversation' && role === 'user') {
      convo.title = content.slice(0, 50) + (content.length > 50 ? '…' : '');
    }

    await convo.save();
    return res.json({ success: true, title: convo.title });
  } catch (error) {
    console.error('Add message error:', error);
    return res.status(500).json({ error: 'Failed to save message' });
  }
});

// Clear messages in a conversation (keep the conversation)
app.delete('/api/conversations/:id/messages', authRequired, async (req, res) => {
  try {
    await Conversation.findOneAndUpdate(
      { _id: req.params.id, user: req.auth.sub },
      { $set: { messages: [], title: 'New Conversation' } }
    );
    return res.json({ success: true });
  } catch (error) {
    console.error('Clear messages error:', error);
    return res.status(500).json({ error: 'Failed to clear messages' });
  }
});

// Delete a whole conversation
app.delete('/api/conversations/:id', authRequired, async (req, res) => {
  try {
    await Conversation.findOneAndDelete({ _id: req.params.id, user: req.auth.sub });
    return res.json({ success: true });
  } catch (error) {
    console.error('Delete conversation error:', error);
    return res.status(500).json({ error: 'Failed to delete conversation' });
  }
});

// ==========================================
// Auth Routes (continued)
// ==========================================

app.get('/api/auth/me', authRequired, async (req, res) => {
  const user = await User.findById(req.auth.sub).select('_id username createdAt lastLoginAt');
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  return res.json({
    user: {
      id: user._id,
      username: user.username,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt
    }
  });
});

app.post('/api/chat', authRequired, async (req, res) => {
  try {
    const { model, messages, temperature, max_tokens } = req.body;
    const usedModel = model || DEFAULT_MODEL;

    const conversationMessages = (messages || []).filter(message => message.role !== 'system');
    const lastMessage = conversationMessages[conversationMessages.length - 1];

    if (!lastMessage) {
      return res.status(400).json({ error: 'messages are required' });
    }

    // Format messages for Ollama
    const ollamaMessages = conversationMessages.map(message => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content
    }));

    // Call Ollama API
    const response = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: usedModel,
        messages: ollamaMessages,
        stream: false,
        options: {
          temperature: typeof temperature === 'number' ? temperature : 0.7,
          num_predict: max_tokens || 1024
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Ollama error: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    const responseText = result.message?.content || result.response || '';

    return res.json({
      choices: [
        {
          message: {
            role: 'assistant',
            content: responseText
          }
        }
      ]
    });
  } catch (error) {
    console.error('Error calling Ollama:', error?.message || error);
    return res.status(500).json({ error: error.message || 'Ollama request failed. Ensure Ollama is running at ' + OLLAMA_URL });
  }
});

// Legacy /api/history routes removed — use /api/conversations/:id routes instead.

app.use('/', express.static(path.join(__dirname, '..')));

async function startServer() {
  if (!MONGODB_URI || !JWT_SECRET) {
    console.error('Missing required environment variables. Check server/.env.');
    process.exit(1);
  }

  await mongoose.connect(MONGODB_URI);
  await seedDemoAccount();

  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`\n🚀 Server listening on http://localhost:${port}`);
    console.log('✓ MongoDB connected');
    console.log('✓ JWT auth enabled');
    console.log(`✓ Ollama (${DEFAULT_MODEL}) configured`);
    console.log('\nDemo account: demo / demo123\n');
  });
}

startServer().catch(error => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
