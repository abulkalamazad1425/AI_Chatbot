// js/main.js
// ==========================================
// AI Chatbot Main Application (backend-enabled)
// ==========================================

// Check if user is logged in
document.addEventListener('DOMContentLoaded', async function() {
  if (!userManager.isLoggedIn()) {
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

  // Load conversations sidebar
  await refreshSidebar();

  // Load current conversation messages
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
  window.sidebarToggleBtn = document.getElementById('sidebarToggleBtn');
  window.sidebar = document.getElementById('sidebar');
  window.sidebarOverlay = document.getElementById('sidebarOverlay');
  window.newChatBtn = document.getElementById('newChatBtn');
  window.conversationList = document.getElementById('conversationList');
  window.conversationTitle = document.getElementById('conversationTitle');
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

// ==========================================
// Sidebar / Conversation list
// ==========================================

async function refreshSidebar() {
  try {
    const conversations = await userManager.getConversations();
    renderConversationList(conversations);
  } catch (err) {
    console.error('Failed to load conversations:', err);
  }
}

function renderConversationList(conversations) {
  if (!conversationList) return;
  conversationList.innerHTML = '';

  const activeId = String(userManager.getCurrentConversationId() || '');

  if (conversations.length === 0) {
    conversationList.innerHTML = '<div class="no-convos">No conversations yet</div>';
    return;
  }

  conversations.forEach(convo => {
    const item = document.createElement('div');
    item.className = 'convo-item' + (String(convo.id) === activeId ? ' active' : '');
    item.dataset.id = convo.id;

    const textDiv = document.createElement('div');
    textDiv.className = 'convo-item-text';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'convo-title';
    titleSpan.textContent = convo.title || 'New Conversation';

    const metaSpan = document.createElement('span');
    metaSpan.className = 'convo-meta';
    metaSpan.textContent = `${convo.messageCount} msg${convo.messageCount !== 1 ? 's' : ''}`;

    textDiv.appendChild(titleSpan);
    textDiv.appendChild(metaSpan);

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'convo-delete-btn';
    deleteBtn.title = 'Delete conversation';
    deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await handleDeleteConversation(convo.id);
    });

    item.appendChild(textDiv);
    item.appendChild(deleteBtn);

    item.addEventListener('click', () => handleSwitchConversation(convo.id));
    conversationList.appendChild(item);
  });
}

function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('show');
  sidebarToggleBtn.classList.add('active');
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('show');
  sidebarToggleBtn.classList.remove('active');
}

function toggleSidebar() {
  if (sidebar.classList.contains('open')) {
    closeSidebar();
  } else {
    openSidebar();
  }
}

// ==========================================
// New chat / switch conversation
// ==========================================

/** True if the current in-memory conversation has no user/ai messages yet */
function isCurrentConversationEmpty() {
  return conversationHistory.filter(m => m.role !== 'system').length === 0;
}

/** Delete the current conversation from the server if it has no messages */
async function deleteCurrentIfEmpty() {
  const currentId = userManager.getCurrentConversationId();
  if (currentId && isCurrentConversationEmpty()) {
    await userManager.deleteConversation(currentId);
  }
}
async function handleNewChat() {
  closeSidebar();
  // Clean up if the current conversation is still empty
  await deleteCurrentIfEmpty();
  // Clear the active id — conversation will be created on the first message
  userManager.setCurrentConversationId(null);

  conversationHistory = [
    { role: "system", content: "You are AI, a helpful and concise assistant. Use brief paragraphs and markdown when useful." }
  ];

  clearMessagesUI();
  updateConversationTitle('');
  updateStats(userManager.getCurrentUsername());
  await refreshSidebar();
  userInput.focus();
}

async function handleSwitchConversation(id) {
  closeSidebar();
  // Clean up current conversation if it's still empty
  await deleteCurrentIfEmpty();
  userManager.switchConversation(id);

  conversationHistory = [
    { role: "system", content: "You are AI, a helpful and concise assistant. Use brief paragraphs and markdown when useful." }
  ];

  await loadChatHistory(userManager.getCurrentUsername());
  await refreshSidebar();
  userInput.focus();
}

async function handleDeleteConversation(id) {
  if (!confirm('Delete this conversation? This cannot be undone.')) return;

  const wasActive = String(userManager.getCurrentConversationId()) === String(id);
  await userManager.deleteConversation(id);

  if (wasActive) {
    // After deletion, ensure a conversation exists
    userManager.setCurrentConversationId(null);
    conversationHistory = [
      { role: "system", content: "You are AI, a helpful and concise assistant. Use brief paragraphs and markdown when useful." }
    ];
    clearMessagesUI();
    updateConversationTitle('');
    await refreshSidebar();

    // Auto-load newest remaining conversation (if any)
    const remaining = await userManager.getConversations();
    if (remaining.length > 0) {
      await handleSwitchConversation(remaining[0].id);
    } else {
      // No conversations left — create a fresh one
      await handleNewChat();
    }
  } else {
    await refreshSidebar();
  }
}

// ==========================================
// Chat loading
// ==========================================

async function loadChatHistory(username) {
  clearMessagesUI();

  conversationHistory = [
    { role: "system", content: "You are AI, a helpful and concise assistant. Use brief paragraphs and markdown when useful." }
  ];

  const history = await userManager.getChatHistoryServer();

  if (history.length > 0) {
    history.forEach(msg => {
      addMessage(msg.content, msg.role);
      if (msg.role !== 'system') {
        conversationHistory.push({ role: msg.role, content: msg.content });
      }
    });

    // Show the conversation title in header
    const conversations = await userManager.getConversations();
    const activeId = String(userManager.getCurrentConversationId());
    const active = conversations.find(c => String(c.id) === activeId);
    if (active) updateConversationTitle(active.title);
  }

  updateStats(username);
}

function clearMessagesUI() {
  // Remove all messages except the initial welcome message
  const messages = messagesDiv.querySelectorAll('.message');
  messages.forEach(msg => {
    if (!msg.textContent.includes('Welcome to AI Assistant')) {
      msg.remove();
    }
  });
  // If welcome message was removed earlier, re-add it
  if (messagesDiv.querySelectorAll('.message').length === 0) {
    const welcome = document.createElement('div');
    welcome.className = 'message ai';
    welcome.innerHTML = '<strong>👋 Welcome to AI Assistant!</strong><br><br>I\'m powered by <strong>Llama3</strong>, an advanced language model running locally on Ollama. Start typing to begin our conversation!';
    messagesDiv.appendChild(welcome);
  }
}

function updateConversationTitle(title) {
  if (conversationTitle) {
    conversationTitle.textContent = title || '';
  }
}

// ==========================================
// Event listeners
// ==========================================

function setupEventListeners() {
  // Theme toggle
  initTheme();
  themeToggle.addEventListener('click', toggleTheme);

  // Sidebar toggle
  sidebarToggleBtn.addEventListener('click', toggleSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);

  // New chat button
  newChatBtn.addEventListener('click', handleNewChat);

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

// Handle clear history (clears messages of current conversation)
async function handleClearHistory() {
  if (confirm('This will delete all messages in the current conversation. Are you sure?')) {
    const username = userManager.getCurrentUsername();
    await userManager.clearChatHistoryServer();

    conversationHistory = [
      { role: "system", content: "You are AI, a helpful and concise assistant. Use brief paragraphs and markdown when useful." }
    ];

    clearMessagesUI();
    updateConversationTitle('New Conversation');
    updateStats(username);
    await refreshSidebar();

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

      const newTitle = await userManager.saveChatMessageServer('assistant', reply);
      if (newTitle) {
        updateConversationTitle(newTitle);
        await refreshSidebar();
      }
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

  // Save user message; server may auto-title the conversation from it
  const newTitle = await userManager.saveChatMessageServer('user', text);
  if (newTitle) {
    updateConversationTitle(newTitle);
    await refreshSidebar();
  }
  updateStats(userManager.getCurrentUsername());

  userInput.value = '';
  await callLLM();
}
