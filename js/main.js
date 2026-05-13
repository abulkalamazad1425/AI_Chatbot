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
  window.atMentionPopup = document.getElementById('atMentionPopup');
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
    titleSpan.title = 'Double-click to rename';

    const metaSpan = document.createElement('span');
    metaSpan.className = 'convo-meta';
    metaSpan.textContent = `${convo.messageCount} msg${convo.messageCount !== 1 ? 's' : ''}`;

    textDiv.appendChild(titleSpan);
    textDiv.appendChild(metaSpan);

    // Rename button (pencil icon)
    const renameBtn = document.createElement('button');
    renameBtn.className = 'convo-rename-btn';
    renameBtn.title = 'Rename conversation';
    renameBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    renameBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      startInlineRename(item, titleSpan, convo.id, convo.title || 'New Conversation');
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'convo-delete-btn';
    deleteBtn.title = 'Delete conversation';
    deleteBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
    deleteBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      await handleDeleteConversation(convo.id);
    });

    // Double-click on title text to rename
    titleSpan.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      startInlineRename(item, titleSpan, convo.id, convo.title || 'New Conversation');
    });

    item.appendChild(textDiv);
    item.appendChild(renameBtn);
    item.appendChild(deleteBtn);

    item.addEventListener('click', () => handleSwitchConversation(convo.id));
    conversationList.appendChild(item);
  });
}

// ==========================================
// Inline rename
// ==========================================

function startInlineRename(item, titleSpan, convoId, currentTitle) {
  // Prevent interaction with the convo-item during rename
  item.style.pointerEvents = 'none';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'convo-rename-input';
  input.value = currentTitle;
  input.maxLength = 80;

  // Replace title span with input
  titleSpan.replaceWith(input);
  input.focus();
  input.select();

  async function commitRename() {
    const newTitle = input.value.trim() || currentTitle;
    try {
      await userManager.renameConversation(convoId, newTitle);
      const activeId = String(userManager.getCurrentConversationId());
      if (String(convoId) === activeId) {
        updateConversationTitle(newTitle);
      }
    } catch (err) {
      console.error('Rename failed:', err);
    }
    await refreshSidebar();
  }

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
    if (e.key === 'Escape') { refreshSidebar(); } // cancel
  });
  input.addEventListener('blur', commitRename);
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

async function handleNewChat() {
  closeSidebar();
  // Create a brand-new conversation on the server
  try {
    await userManager.createConversation('New Conversation');
  } catch (err) {
    console.error('Failed to create conversation:', err);
    return;
  }

  // Reset in-memory history
  conversationHistory = [
    { role: "system", content: "You are AI, a helpful and concise assistant. Use brief paragraphs and markdown when useful." }
  ];

  // Clear chat UI
  clearMessagesUI();
  updateConversationTitle('New Conversation');
  updateStats(userManager.getCurrentUsername());

  // Refresh sidebar to show the new entry
  await refreshSidebar();
  userInput.focus();
}

async function handleSwitchConversation(id) {
  closeSidebar();
  userManager.switchConversation(id);

  // Reset in-memory history
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

  // Chat input — unified keydown handler (handles both normal send and @ mention nav)
  userInput.addEventListener('keydown', handleInputKeydown);
  sendBtn.addEventListener('click', () => { closeAtMentionPopup(); sendMessage(); });

  // @ mention trigger
  userInput.addEventListener('input', handleAtMentionInput);

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-menu')) {
      userDropdown.classList.remove('show');
      userMenuBtn.classList.remove('active');
    }
    if (!e.target.closest('#atMentionPopup') && !e.target.closest('#userInput')) {
      closeAtMentionPopup();
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

// ==========================================
// @ Mention — inject previous conversation context
// ==========================================

const atMentionState = {
  open: false,
  query: '',
  atIndex: -1,
  highlightIndex: 0,
  conversations: []
};

/** Called on every input event — detect `@` and manage popup */
async function handleAtMentionInput() {
  const val = userInput.value;
  const cursor = userInput.selectionStart;

  // Find last `@` before cursor
  const textBeforeCursor = val.slice(0, cursor);
  const lastAt = textBeforeCursor.lastIndexOf('@');

  if (lastAt === -1) { closeAtMentionPopup(); return; }

  // Make sure there's no space between `@` and cursor (user still typing the mention)
  const segment = textBeforeCursor.slice(lastAt + 1);
  if (/\s/.test(segment)) { closeAtMentionPopup(); return; }

  atMentionState.atIndex = lastAt;
  atMentionState.query = segment.toLowerCase();

  // Load conversations list (cache per keystroke batch)
  let all;
  try {
    all = await userManager.getConversations();
  } catch (e) { closeAtMentionPopup(); return; }

  // Exclude the active conversation from the list
  const activeId = String(userManager.getCurrentConversationId());
  const filtered = all.filter(c => {
    if (String(c.id) === activeId) return false;
    if (!atMentionState.query) return true;
    return (c.title || '').toLowerCase().includes(atMentionState.query);
  });

  if (filtered.length === 0) { closeAtMentionPopup(); return; }

  atMentionState.conversations = filtered;
  atMentionState.highlightIndex = 0;
  atMentionState.open = true;
  renderAtMentionPopup();
}

/** Unified keyboard handler for the chat input */
function handleInputKeydown(e) {
  if (atMentionState.open) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      atMentionState.highlightIndex = (atMentionState.highlightIndex + 1) % atMentionState.conversations.length;
      renderAtMentionPopup();
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      atMentionState.highlightIndex = (atMentionState.highlightIndex - 1 + atMentionState.conversations.length) % atMentionState.conversations.length;
      renderAtMentionPopup();
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      selectAtMention(atMentionState.highlightIndex);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      closeAtMentionPopup();
      return;
    }
    // Any other key: let the input update, then re-filter via 'input' event
    return;
  }

  // Normal mode: Enter = send
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
  if (e.key === 'Escape') closeAtMentionPopup();
}

function renderAtMentionPopup() {
  const popup = atMentionPopup;
  popup.innerHTML = '';

  atMentionState.conversations.forEach((convo, i) => {
    const item = document.createElement('div');
    item.className = 'at-mention-item' + (i === atMentionState.highlightIndex ? ' highlighted' : '');

    const icon = document.createElement('span');
    icon.className = 'at-mention-icon';
    icon.textContent = '💬';

    const info = document.createElement('div');
    info.className = 'at-mention-info';

    const title = document.createElement('span');
    title.className = 'at-mention-title';
    title.textContent = convo.title || 'New Conversation';

    const meta = document.createElement('span');
    meta.className = 'at-mention-meta';
    meta.textContent = `${convo.messageCount} message${convo.messageCount !== 1 ? 's' : ''}`;

    info.appendChild(title);
    info.appendChild(meta);
    item.appendChild(icon);
    item.appendChild(info);

    item.addEventListener('mousedown', (e) => {
      e.preventDefault(); // prevent blur on input
      selectAtMention(i);
    });

    popup.appendChild(item);
  });

  // Position popup above the input box
  const inputRect = userInput.getBoundingClientRect();
  popup.style.left = inputRect.left + 'px';
  popup.style.bottom = (window.innerHeight - inputRect.top + 6) + 'px';
  popup.style.width = Math.min(inputRect.width, 360) + 'px';
  popup.classList.add('open');
}

function closeAtMentionPopup() {
  atMentionState.open = false;
  atMentionState.conversations = [];
  if (atMentionPopup) atMentionPopup.classList.remove('open');
}

/** User selected a conversation from the @ popup — inject its messages as context */
async function selectAtMention(index) {
  const convo = atMentionState.conversations[index];
  if (!convo) return;

  // Snapshot atIndex BEFORE closing (closeAtMentionPopup clears state)
  const atIndex = atMentionState.atIndex;
  const cursorPos = userInput.selectionStart;

  closeAtMentionPopup();

  // Remove the @query text from the input (everything from @ to current cursor)
  const before = userInput.value.slice(0, atIndex);
  const after  = userInput.value.slice(cursorPos);
  userInput.value = before + after;
  // Place cursor right after where @ was
  userInput.setSelectionRange(atIndex, atIndex);
  userInput.focus();

  // Load that conversation's messages
  let messages;
  try {
    messages = await userManager.getConversationMessages(convo.id);
  } catch (e) {
    addMessage(`❌ Could not load context from "${convo.title}": ${e.message}`, 'ai');
    return;
  }

  const nonSystemMessages = messages.filter(m => m.role !== 'system');
  if (nonSystemMessages.length === 0) {
    addMessage(`ℹ️ "${convo.title}" has no messages to inject.`, 'ai');
    return;
  }

  // Build a readable summary of the conversation
  const summary = nonSystemMessages
    .map(m => `[${m.role === 'user' ? 'User' : 'Assistant'}]: ${m.content}`)
    .join('\n\n');

  // Inject as system context BEFORE the most recent user messages
  // Find the insertion point: after the base system prompt (index 0)
  const contextMsg = {
    role: 'system',
    content: `[Referenced conversation: "${convo.title}"]\n\n${summary}\n\n[End of referenced conversation. Use the above as background context for the next question.]`
  };

  // Insert right after the base system prompt (position 1)
  conversationHistory.splice(1, 0, contextMsg);

  // Show a visual tag in the chat
  const tag = document.createElement('div');
  tag.className = 'context-inject-tag';
  tag.innerHTML = `<span class="context-inject-icon">📎</span> Context injected from <strong>${convo.title}</strong> <span class="context-inject-count">(${nonSystemMessages.length} messages)</span>`;
  messagesDiv.appendChild(tag);
  setTimeout(() => messagesDiv.scrollTo({ top: messagesDiv.scrollHeight, behavior: 'smooth' }), 50);
}

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
