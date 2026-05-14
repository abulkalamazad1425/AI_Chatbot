// js/main.js — ChatGPT-like UI with cross-session @ context injection

document.addEventListener('DOMContentLoaded', async function () {
  if (!userManager.isLoggedIn()) {
    window.location.href = 'login.html';
    return;
  }
  await initializeApp();
});

// ─── Globals ────────────────────────────────────────────────────────────────
let conversationHistory = [
  { role: 'system', content: 'You are a helpful, concise AI assistant. Use markdown when useful.' }
];
let injectedContextIds = [];   // [{id, title}]
let allConversations = [];     // cache for @ mention lookup
let mentionQuery = '';
let mentionActive = false;

// ─── DOM refs ────────────────────────────────────────────────────────────────
let messagesDiv, userInput, sendBtn, emptyState,
    sidebar, sidebarOverlay, sidebarToggleBtn, newChatBtn, conversationList,
    sidebarUserPanel, sidebarMenuBtn, sidebarDropdown, sidebarUsername, userAvatarSmall,
    clearHistoryBtn, themeToggle, themeToggleBtn, themeLabel, logoutBtn,
    contextChipsBar, mentionDropdown, mentionList;

// ─── Init ─────────────────────────────────────────────────────────────────────
async function initializeApp() {
  messagesDiv        = document.getElementById('messages');
  userInput          = document.getElementById('userInput');
  sendBtn            = document.getElementById('sendBtn');
  emptyState         = document.getElementById('emptyState');
  sidebar            = document.getElementById('sidebar');
  sidebarOverlay     = document.getElementById('sidebarOverlay');
  sidebarToggleBtn   = document.getElementById('sidebarToggleBtn');
  newChatBtn         = document.getElementById('newChatBtn');
  conversationList   = document.getElementById('conversationList');
  sidebarUserPanel   = document.getElementById('sidebarUserPanel');
  sidebarMenuBtn     = document.getElementById('sidebarMenuBtn');
  sidebarDropdown    = document.getElementById('sidebarDropdown');
  sidebarUsername    = document.getElementById('sidebarUsername');
  userAvatarSmall    = document.getElementById('userAvatarSmall');
  clearHistoryBtn    = document.getElementById('clearHistoryBtn');
  themeToggle        = document.getElementById('themeToggle');
  themeToggleBtn     = document.getElementById('themeToggleBtn');
  themeLabel         = document.getElementById('themeLabel');
  logoutBtn          = document.getElementById('logoutBtn');
  contextChipsBar    = document.getElementById('contextChipsBar');
  mentionDropdown    = document.getElementById('mentionDropdown');
  mentionList        = document.getElementById('mentionList');

  initTheme();
  setUserDisplay();
  await refreshSidebar();
  await loadChatHistory();
  setupEventListeners();
  userInput.focus();
}

// ─── Theme ────────────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  if (themeLabel) {
    themeLabel.textContent = theme === 'dark' ? 'Light mode' : 'Dark mode';
  }
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ─── User Display ────────────────────────────────────────────────────────────
function setUserDisplay() {
  const username = userManager.getCurrentUsername() || 'User';
  if (sidebarUsername) sidebarUsername.textContent = username.charAt(0).toUpperCase() + username.slice(1);
  if (userAvatarSmall) userAvatarSmall.textContent = username.charAt(0).toUpperCase();
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────
function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('show');
}

function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('show');
}

function toggleSidebar() {
  sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
}

// ─── Conversation List ────────────────────────────────────────────────────────
async function refreshSidebar() {
  try {
    allConversations = await userManager.getConversations();
    renderConversationList(allConversations);
  } catch (e) {
    console.error('Sidebar load failed:', e);
  }
}

function renderConversationList(convos) {
  if (!conversationList) return;
  conversationList.innerHTML = '';
  const activeId = String(userManager.getCurrentConversationId() || '');

  if (!convos.length) {
    conversationList.innerHTML = '<div class="no-convos">No conversations yet</div>';
    return;
  }

  convos.forEach(c => {
    const item = document.createElement('div');
    item.className = 'convo-item' + (String(c.id) === activeId ? ' active' : '');
    item.dataset.id = c.id;

    const textDiv = document.createElement('div');
    textDiv.className = 'convo-item-text';

    const titleSpan = document.createElement('span');
    titleSpan.className = 'convo-title';
    titleSpan.textContent = c.title || 'New Conversation';

    const metaSpan = document.createElement('span');
    metaSpan.className = 'convo-meta';
    metaSpan.textContent = `${c.messageCount} msg${c.messageCount !== 1 ? 's' : ''}`;

    textDiv.appendChild(titleSpan);
    textDiv.appendChild(metaSpan);

    const delBtn = document.createElement('button');
    delBtn.className = 'convo-delete-btn';
    delBtn.title = 'Delete';
    delBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>`;
    delBtn.addEventListener('click', e => { e.stopPropagation(); handleDeleteConversation(c.id); });

    item.appendChild(textDiv);
    item.appendChild(delBtn);
    item.addEventListener('click', () => handleSwitchConversation(c.id));
    conversationList.appendChild(item);
  });
}

// ─── New Chat / Switch / Delete ───────────────────────────────────────────────
async function handleNewChat() {
  closeSidebar();
  try {
    await userManager.createConversation('New Conversation');
  } catch (e) { console.error(e); return; }
  resetConversation();
  showEmptyState(true);
  await refreshSidebar();
  userInput.focus();
}

async function handleSwitchConversation(id) {
  closeSidebar();
  userManager.switchConversation(id);
  resetConversation();
  await loadChatHistory();
  await refreshSidebar();
  userInput.focus();
}

async function handleDeleteConversation(id) {
  if (!confirm('Delete this conversation? This cannot be undone.')) return;
  const wasActive = String(userManager.getCurrentConversationId()) === String(id);
  await userManager.deleteConversation(id);
  if (wasActive) {
    resetConversation();
    showEmptyState(true);
    await refreshSidebar();
    const remaining = await userManager.getConversations();
    if (remaining.length > 0) await handleSwitchConversation(remaining[0].id);
    else await handleNewChat();
  } else {
    await refreshSidebar();
  }
}

function resetConversation() {
  conversationHistory = [
    { role: 'system', content: 'You are a helpful, concise AI assistant. Use markdown when useful.' }
  ];
  injectedContextIds = [];
  renderChips();
}

// ─── Load Chat History ────────────────────────────────────────────────────────
async function loadChatHistory() {
  clearMessagesUI();
  conversationHistory = [
    { role: 'system', content: 'You are a helpful, concise AI assistant. Use markdown when useful.' }
  ];

  const history = await userManager.getChatHistoryServer();
  if (history.length > 0) {
    showEmptyState(false);
    history.forEach(msg => {
      if (msg.role !== 'system') {
        addMessage(msg.content, msg.role);
        conversationHistory.push({ role: msg.role, content: msg.content });
      }
    });
  } else {
    showEmptyState(true);
  }
}

function clearMessagesUI() {
  const rows = messagesDiv.querySelectorAll('.msg-row');
  rows.forEach(r => r.remove());
}

function showEmptyState(show) {
  if (!emptyState) return;
  emptyState.style.display = show ? 'flex' : 'none';
}

// ─── Add Message (avatar-row style) ──────────────────────────────────────────
function addMessage(content, role) {
  if (emptyState) emptyState.style.display = 'none';

  const row = document.createElement('div');
  row.className = `msg-row ${role === 'user' ? 'user-row' : 'ai-row'}`;

  const avatar = document.createElement('div');
  avatar.className = `msg-avatar ${role === 'user' ? 'user-avatar' : 'ai-avatar'}`;
  if (role === 'user') {
    avatar.textContent = (userManager.getCurrentUsername() || 'U').charAt(0).toUpperCase();
  } else {
    avatar.innerHTML = `<svg width="16" height="16" viewBox="0 0 41 41" fill="currentColor"><path d="M37.532 16.87a9.963 9.963 0 0 0-.856-8.184 10.078 10.078 0 0 0-10.855-4.835A9.964 9.964 0 0 0 18.306.5a10.079 10.079 0 0 0-9.614 6.977 9.967 9.967 0 0 0-6.664 4.834 10.08 10.08 0 0 0 1.24 11.817 9.965 9.965 0 0 0 .856 8.185 10.079 10.079 0 0 0 10.855 4.835 9.965 9.965 0 0 0 7.516 3.35 10.078 10.078 0 0 0 9.617-6.981 9.967 9.967 0 0 0 6.663-4.834 10.079 10.079 0 0 0-1.243-11.813z"/></svg>`;
  }

  const contentDiv = document.createElement('div');
  contentDiv.className = 'msg-content';

  if (role === 'typing') {
    row.className = 'msg-row ai-row';
    contentDiv.innerHTML = `<div class="typing-indicator"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span></div>`;
    row.dataset.typing = 'true';
  } else {
    contentDiv.innerHTML = renderMarkdown(content);
  }

  row.appendChild(avatar);
  row.appendChild(contentDiv);
  messagesDiv.appendChild(row);

  setTimeout(() => {
    const wrapper = document.getElementById('messagesWrapper');
    if (wrapper) wrapper.scrollTop = wrapper.scrollHeight;
  }, 50);

  return row;
}

// ─── Markdown Renderer ────────────────────────────────────────────────────────
function renderMarkdown(text) {
  let html = text
    // Code blocks
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="lang-${lang}">${escHtml(code.trim())}</code></pre>`)
    // Inline code
    .replace(/`([^`\n]+)`/g, (_, c) => `<code>${escHtml(c)}</code>`)
    // Headings
    .replace(/^### (.+)$/gm, '<strong style="display:block;font-size:1.05em;margin:12px 0 6px">$1</strong>')
    .replace(/^## (.+)$/gm, '<strong style="display:block;font-size:1.1em;margin:14px 0 6px">$1</strong>')
    .replace(/^# (.+)$/gm, '<strong style="display:block;font-size:1.2em;margin:16px 0 8px">$1</strong>')
    // Bold / italic
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Unordered lists
    .replace(/^[\-\*] (.+)$/gm, '<li>$1</li>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs / line breaks
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');

  // Wrap loose <li> in <ul>
  html = html.replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>');
  return `<p>${html}</p>`;
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ─── @ Mention Logic ──────────────────────────────────────────────────────────
function handleInputChange() {
  const val = userInput.value;
  const atIdx = val.lastIndexOf('@');

  if (atIdx !== -1) {
    const afterAt = val.slice(atIdx + 1);
    // Only trigger if @ is at end or followed by non-space text
    if (!afterAt.includes(' ') || afterAt.trim() === '') {
      mentionQuery = afterAt.toLowerCase();
      mentionActive = true;
      showMentionDropdown(mentionQuery);
      return;
    }
  }

  if (mentionActive) hideMentionDropdown();
}

function showMentionDropdown(query) {
  const filtered = allConversations.filter(c =>
    c.title && c.title.toLowerCase().includes(query) &&
    !injectedContextIds.find(x => x.id === c.id)
  );

  mentionList.innerHTML = '';

  if (!filtered.length) {
    mentionList.innerHTML = '<div class="mention-empty">No matching conversations</div>';
  } else {
    filtered.slice(0, 8).forEach(c => {
      const item = document.createElement('div');
      item.className = 'mention-item';
      item.innerHTML = `
        <div class="mention-item-icon">💬</div>
        <div class="mention-item-text">
          <span class="mention-item-title">${escHtml(c.title)}</span>
          <span class="mention-item-meta">${c.messageCount} messages</span>
        </div>`;
      item.addEventListener('click', () => selectMention(c));
      mentionList.appendChild(item);
    });
  }

  mentionDropdown.classList.add('visible');
}

function hideMentionDropdown() {
  mentionActive = false;
  mentionDropdown.classList.remove('visible');
  mentionList.innerHTML = '';
}

async function selectMention(convo) {
  // Remove the @query from the textarea
  const val = userInput.value;
  const atIdx = val.lastIndexOf('@');
  userInput.value = val.slice(0, atIdx);
  hideMentionDropdown();

  // Check not already added
  if (injectedContextIds.find(x => x.id === convo.id)) return;

  injectedContextIds.push({ id: convo.id, title: convo.title });
  renderChips();
  userInput.focus();
}

// ─── Context Chips ────────────────────────────────────────────────────────────
function renderChips() {
  contextChipsBar.innerHTML = '';
  if (!injectedContextIds.length) return;

  injectedContextIds.forEach(ctx => {
    const chip = document.createElement('div');
    chip.className = 'context-chip';
    chip.innerHTML = `
      <span class="chip-icon">📎</span>
      <span>${escHtml(ctx.title)}</span>
      <button class="chip-remove" title="Remove context" data-id="${ctx.id}">✕</button>`;
    chip.querySelector('.chip-remove').addEventListener('click', () => removeChip(ctx.id));
    contextChipsBar.appendChild(chip);
  });
}

function removeChip(id) {
  injectedContextIds = injectedContextIds.filter(x => x.id !== id);
  renderChips();
}

// ─── Fetch context messages from another session ──────────────────────────────
async function fetchContextMessages(conversationId) {
  try {
    const data = await userManager.apiRequest(`/conversations/${conversationId}`, { method: 'GET' });
    // Return all user/assistant messages, cap at last 20
    const msgs = (data.messages || []).filter(m => m.role === 'user' || m.role === 'assistant');
    return { title: data.title || 'Past Conversation', messages: msgs.slice(-20) };
  } catch (e) {
    console.warn('Failed to fetch context for', conversationId, e);
    return { title: '', messages: [] };
  }
}

// ─── Send Message ─────────────────────────────────────────────────────────────
async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;

  userInput.value = '';
  autoResizeTextarea();
  updateSendBtn();

  addMessage(text, 'user');
  conversationHistory.push({ role: 'user', content: text });

  // Save user message
  const newTitle = await userManager.saveChatMessageServer('user', text);
  if (newTitle) await refreshSidebar();

  await callLLM();
}

// ─── Call LLM ─────────────────────────────────────────────────────────────────
async function callLLM() {
  sendBtn.disabled = true;
  const typingRow = addMessage('', 'typing');

  try {
    // 1. Base system prompt
    const messages = [
      { role: 'system', content: 'You are a helpful, concise AI assistant. Use markdown when useful.' }
    ];

    // 2. Inject context from other sessions if requested
    if (injectedContextIds.length > 0) {
      for (const ctx of injectedContextIds) {
        const { title, messages: ctxMsgs } = await fetchContextMessages(ctx.id);
        if (ctxMsgs.length > 0) {
          // Add a separator/header to mark context transition
          messages.push({ 
            role: 'system', 
            content: `--- START OF CONTEXT FROM CONVERSATION: "${title}" ---` 
          });
          
          // Add the actual message turns
          ctxMsgs.forEach(m => {
            messages.push({ role: m.role, content: m.content });
          });

          messages.push({ 
            role: 'system', 
            content: `--- END OF CONTEXT FROM CONVERSATION: "${title}" ---` 
          });
        }
      }
    }

    // 3. Add all user/assistant messages from THIS session
    // (excluding the initial system message already handled)
    conversationHistory.forEach((msg, idx) => {
      if (idx > 0) { // Skip the default system message at [0]
        messages.push({ role: msg.role, content: msg.content });
      }
    });

    const backendUrl = API_CONFIG.backendUrl || '/api';
    const resp = await fetch(`${backendUrl}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userManager.getAuthToken()}`
      },
      body: JSON.stringify({ messages, temperature: 0.7, max_tokens: 2048 })
    });

    typingRow.remove();

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Server error ${resp.status}: ${err}`);
    }

    const data = await resp.json();
    const reply = data.choices?.[0]?.message?.content?.trim();

    if (reply) {
      addMessage(reply, 'ai');
      conversationHistory.push({ role: 'assistant', content: reply });
      const t = await userManager.saveChatMessageServer('assistant', reply);
      if (t) await refreshSidebar();
    } else {
      addMessage('⚠️ Empty response from model.', 'ai');
    }
  } catch (err) {
    typingRow && typingRow.remove && typingRow.remove();
    document.querySelectorAll('[data-typing]').forEach(e => e.remove());
    addMessage(`❌ Error: ${err.message}`, 'ai');
    console.error(err);
  }

  sendBtn.disabled = false;
  userInput.focus();
  updateSendBtn();
}

// ─── Event Listeners ──────────────────────────────────────────────────────────
function setupEventListeners() {
  // Textarea auto-resize + send button state
  userInput.addEventListener('input', () => {
    autoResizeTextarea();
    updateSendBtn();
    handleInputChange();
  });

  // Send on Enter (not Shift+Enter)
  userInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendMessage();
    }
    if (e.key === 'Escape') hideMentionDropdown();
  });

  sendBtn.addEventListener('click', sendMessage);

  // Sidebar
  sidebarToggleBtn.addEventListener('click', toggleSidebar);
  sidebarOverlay.addEventListener('click', closeSidebar);
  newChatBtn.addEventListener('click', handleNewChat);

  // User panel dropdown
  sidebarMenuBtn.addEventListener('click', e => {
    e.stopPropagation();
    sidebarDropdown.classList.toggle('show');
  });

  document.addEventListener('click', e => {
    if (!e.target.closest('.sidebar-bottom')) {
      sidebarDropdown.classList.remove('show');
    }
    if (!e.target.closest('.input-inner')) {
      hideMentionDropdown();
    }
  });

  // Theme toggles (topbar + dropdown)
  themeToggle.addEventListener('click', toggleTheme);
  themeToggleBtn.addEventListener('click', () => { toggleTheme(); sidebarDropdown.classList.remove('show'); });

  // Clear history
  clearHistoryBtn.addEventListener('click', handleClearHistory);

  // Logout
  logoutBtn.addEventListener('click', handleLogout);

  // Suggestion cards
  document.querySelectorAll('.suggestion-card').forEach(card => {
    card.addEventListener('click', () => {
      userInput.value = card.dataset.text;
      autoResizeTextarea();
      updateSendBtn();
      userInput.focus();
    });
  });
}

// ─── Textarea Auto Resize ─────────────────────────────────────────────────────
function autoResizeTextarea() {
  userInput.style.height = 'auto';
  userInput.style.height = Math.min(userInput.scrollHeight, 200) + 'px';
}

function updateSendBtn() {
  sendBtn.disabled = !userInput.value.trim();
}

// ─── Clear History ────────────────────────────────────────────────────────────
async function handleClearHistory() {
  if (!confirm('Clear all messages in this conversation?')) return;
  sidebarDropdown.classList.remove('show');
  await userManager.clearChatHistoryServer();
  resetConversation();
  clearMessagesUI();
  showEmptyState(true);
  await refreshSidebar();
}

// ─── Logout ───────────────────────────────────────────────────────────────────
function handleLogout() {
  if (confirm('Log out?')) {
    userManager.logout();
    window.location.href = 'login.html';
  }
}
