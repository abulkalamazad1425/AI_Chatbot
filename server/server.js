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

const chatHistorySchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
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
const ChatHistory = mongoose.model('ChatHistory', chatHistorySchema);

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

async function ensureHistoryDocument(userId) {
  return ChatHistory.findOneAndUpdate(
    { user: userId },
    { $setOnInsert: { user: userId, messages: [] } },
    { upsert: true, new: true }
  );
}

async function seedDemoAccount() {
  const username = 'demo';
  const password = 'demo123';
  const existing = await User.findOne({ username });

  if (!existing) {
    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({ username, passwordHash });
    await ensureHistoryDocument(user._id);
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
    await ensureHistoryDocument(user._id);

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
    await ensureHistoryDocument(user._id);

    const token = createToken(user);
    return res.json({ token, user: { id: user._id, username: user.username } });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

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

app.get('/api/history', authRequired, async (req, res) => {
  try {
    const history = await ChatHistory.findOne({ user: req.auth.sub }).lean();
    return res.json({ messages: history?.messages || [] });
  } catch (error) {
    console.error('History fetch error:', error);
    return res.status(500).json({ error: 'Failed to load history' });
  }
});

app.post('/api/history/messages', authRequired, async (req, res) => {
  try {
    const { role, content } = req.body;

    if (!role || !content) {
      return res.status(400).json({ error: 'role and content are required' });
    }

    const history = await ensureHistoryDocument(req.auth.sub);
    history.messages.push({ role, content, timestamp: new Date() });
    await history.save();

    return res.json({ success: true });
  } catch (error) {
    console.error('History save error:', error);
    return res.status(500).json({ error: 'Failed to save history message' });
  }
});

app.delete('/api/history', authRequired, async (req, res) => {
  try {
    await ChatHistory.updateOne({ user: req.auth.sub }, { $set: { messages: [] } }, { upsert: true });
    return res.json({ success: true });
  } catch (error) {
    console.error('History clear error:', error);
    return res.status(500).json({ error: 'Failed to clear history' });
  }
});

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
