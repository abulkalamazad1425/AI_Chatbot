// js/main.js
// ==========================================
// AI Chatbot Main Application (backend-enabled)
// ==========================================

// Check if user is logged in
document.addEventListener('DOMContentLoaded', async function() {
  if (!userManager.isLoggedIn()) {
    // Redirect to login if not authenticated
    window.location.href = 'login.html';
    return;
  }

  await initializeApp();
});

// Initialize the application
async function initializeApp() {
  const currentUser = userManager.getCurrentUsername();
  
  // Setup UI elements
  setupUIElements();
  
  // Display user information
  displayUserInfo(currentUser);
  
  // Load user's chat history (server if available)
  await loadChatHistory(currentUser);
  
  // Setup event listeners
  setupEventListeners();
  
  // Focus input
  userInput.focus();
}

// Setup UI elements
function setupUIElements() {
  window.messagesDiv = document.getElementById('messages');
  window.userInput = document.getElementById('userInput');
  window.sendBtn = document.getElementById('sendBtn');
  window.themeToggle = document.getElementById('themeToggle');
  window.userMenuBtn = document.getElementById('userMenuBtn');
  window.userDropdown = document.getElementById('userDropdown');
  window.logoutBtn = document.getElementById('logoutBtn');
  window.clearHistoryBtn = document.getElementById('clearHistoryBtn');
  window.userDisplay = document.getElementById('userDisplay');
  window.statsText = document.getElementById('statsText');
}

// Display user information
function displayUserInfo(username) {
  document.getElementById('userInfo').textContent = `👤 Logged in as: ${username}`;
  document.getElementById('userDisplay').textContent = username.charAt(0).toUpperCase() + username.slice(1);
  updateStats(username);
}

// Update user statistics
function updateStats(username) {
  const totalMessages = conversationHistory.filter(msg => msg.role !== 'system').length;
  document.getElementById('statsText').textContent = `${totalMessages} messages`;
}

// Load chat history from the backend
async function loadChatHistory(username) {
  // Clear existing messages (except initial greeting)
  const messages = messagesDiv.querySelectorAll('.message');
  messages.forEach(msg => {
    if (!msg.textContent.includes('How can I assist you')) {
      msg.remove();
    }
  });

  // Initialize conversation history with system message
  conversationHistory = [
    { role: "system", content: "You are AI, a helpful and concise assistant. Use brief paragraphs and markdown when useful." }
  ];

  const history = await userManager.getChatHistoryServer();

  // Load all previous messages
  if (history.length > 0) {
    history.forEach(msg => {
      // Add to display
      addMessage(msg.content, msg.role);
      // Add to conversation history (skip system message)
      if (msg.role !== 'system') {
        conversationHistory.push({ role: msg.role, content: msg.content });
      }
    });
  }

  updateStats(username);
}

// Setup event listeners
function setupEventListeners() {
  // Theme toggle
  initTheme();
  themeToggle.addEventListener('click', toggleTheme);

  // User menu
  userMenuBtn.addEventListener('click', toggleUserMenu);
  logoutBtn.addEventListener('click', handleLogout);
  clearHistoryBtn.addEventListener('click', handleClearHistory);

  // Chat input
  userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
  sendBtn.addEventListener('click', sendMessage);

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu')) {
      userDropdown.classList.remove('show');
      userMenuBtn.classList.remove('active');
    }
  });
}

// Toggle user menu dropdown
function toggleUserMenu() {
  userDropdown.classList.toggle('show');
  userMenuBtn.classList.toggle('active');
}

// Handle logout
function handleLogout() {
  if (confirm('Are you sure you want to logout?')) {
    userManager.logout();
    window.location.href = 'login.html';
  }
}

// Handle clear history
async function handleClearHistory() {
  if (confirm('This will delete all your chat history. Are you sure?')) {
    const username = userManager.getCurrentUsername();
    await userManager.clearChatHistoryServer();

    conversationHistory = [
      { role: "system", content: "You are AI, a helpful and concise assistant. Use brief paragraphs and markdown when useful." }
    ];
    
    // Clear UI
    await loadChatHistory(username);
    updateStats(username);
    
    // Show notification
    addMessage('✨ Chat history cleared! Start a new conversation.', 'ai');
  }
}

// ==========================================
// Theme Management
// ==========================================

function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  document.documentElement.setAttribute('data-theme', savedTheme);
}

function toggleTheme() {
  const currentTheme = document.documentElement.getAttribute('data-theme');
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', newTheme);
  localStorage.setItem('theme', newTheme);
}

// ==========================================
// Conversation Management
// ==========================================

let conversationHistory = [
  { role: "system", content: "You are AI, a helpful and concise assistant. Use brief paragraphs and markdown when useful." }
];

// Add message to UI
function addMessage(content, role) {
  const msgDiv = document.createElement('div');
  msgDiv.className = `message ${role}`;
  
  if (role === 'typing') {
    msgDiv.className = 'message ai typing';
    msgDiv.innerHTML = '<span class="typing-dots"></span>';
  } else {
    // Enhanced markdown rendering for perfect readability
    let formatted = content
      // Headers (### Title)
      .replace(/###\s+(.+?)(?:\n|$)/g, '<strong style="display: block; font-size: 1.1em; margin: 12px 0 8px 0; color: var(--text-primary);">$1</strong>')
      // Bold (**text**)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic (*text*)
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Code blocks (```code```)
      .replace(/```([\s\S]+?)```/g, '<code style="display: block; background: var(--input-bg); padding: 12px; border-radius: 8px; margin: 8px 0; font-family: monospace; font-size: 0.9em; overflow-x: auto;">$1</code>')
      // Inline code (`code`)
      .replace(/`([^`]+)`/g, '<code style="background: var(--input-bg); padding: 2px 6px; border-radius: 4px; font-family: monospace; font-size: 0.9em;">$1</code>')
      // Bullet points (- item or * item)
      .replace(/^[\-\*]\s+(.+)$/gm, '<div style="margin-left: 16px; padding-left: 8px; border-left: 2px solid var(--accent); margin: 6px 0;">• $1</div>')
      // Numbered lists (1. item)
      .replace(/^\d+\.\s+(.+)$/gm, '<div style="margin-left: 16px; padding-left: 8px; margin: 6px 0;">$1</div>')
      // Line breaks
      .replace(/\n\n/g, '<br><br>')
      .replace(/\n/g, '<br>');
    
    msgDiv.innerHTML = formatted;
  }
  
  messagesDiv.appendChild(msgDiv);
  
  // Smooth scroll to bottom
  setTimeout(() => {
    messagesDiv.scrollTo({
      top: messagesDiv.scrollHeight,
      behavior: 'smooth'
    });
  }, 50);
}

// Call LLM API
async function callLLM() {
  sendBtn.disabled = true;
  addMessage("", "typing");

  try {
    if (!userManager.backendEnabled) {
      throw new Error('Backend mode is required for this project.');
    }

    const backendUrl = API_CONFIG.backendUrl || '/api';
    const resp = await fetch(`${backendUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userManager.getAuthToken()}`
      },
      body: JSON.stringify({ messages: conversationHistory, temperature: 0.7, max_tokens: 1024 })
    });

    if (!resp.ok) {
      const errText = await resp.text();
      throw new Error(`Backend Error ${resp.status}: ${errText}`);
    }

    const data = await resp.json();
    document.querySelector('.message.typing')?.remove();

    if (data.choices?.[0]?.message?.content) {
      const reply = data.choices[0].message.content.trim();
      addMessage(reply, 'ai');
      conversationHistory.push({ role: 'assistant', content: reply });
      
      await userManager.saveChatMessageServer('assistant', reply);
      updateStats(userManager.getCurrentUsername());
    } else {
      addMessage('Empty response. Check console.', 'ai');
    }
  } catch (err) {
    document.querySelector('.message.typing')?.remove();
    addMessage('❌ Error: ' + err.message, 'ai');
    console.error(err);
  }
  sendBtn.disabled = false;
  userInput.focus();
}

// Send message
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  addMessage(text, 'user');
  conversationHistory.push({ role: 'user', content: text });
  
  await userManager.saveChatMessageServer('user', text);
  updateStats(userManager.getCurrentUsername());
  
  userInput.value = '';
  await callLLM();
}
