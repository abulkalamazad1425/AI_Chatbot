// js/auth.js
// ==========================================
// JWT-backed Authentication and User Session Management
// ==========================================

class UserManager {
  constructor() {
    this.sessionKey = 'llm_chatbot_session';
    this.conversationKey = 'llm_chatbot_conversation';

    // Backend sync (required). `API_CONFIG` is defined in config/api.js
    this.backendEnabled = (typeof API_CONFIG !== 'undefined') && API_CONFIG.useBackend;
    this.backendUrl = this.backendEnabled ? (API_CONFIG.backendUrl || '/api') : null;
  }

  // ==========================================
  // Session helpers
  // ==========================================

  getAuthToken() {
    const session = this.getSession();
    return session ? session.token : null;
  }

  setSession(username, token) {
    sessionStorage.setItem(this.sessionKey, JSON.stringify({ username, token }));
  }

  getSession() {
    const session = sessionStorage.getItem(this.sessionKey);
    return session ? JSON.parse(session) : null;
  }

  getCurrentUsername() {
    const session = this.getSession();
    return session ? session.username : null;
  }

  isLoggedIn() {
    return Boolean(this.getAuthToken());
  }

  logout() {
    sessionStorage.removeItem(this.sessionKey);
    sessionStorage.removeItem(this.conversationKey);
    return { success: true, message: 'Logged out successfully!' };
  }

  // ==========================================
  // Active conversation (persisted in sessionStorage)
  // ==========================================

  getCurrentConversationId() {
    return sessionStorage.getItem(this.conversationKey) || null;
  }

  setCurrentConversationId(id) {
    if (id) {
      sessionStorage.setItem(this.conversationKey, id);
    } else {
      sessionStorage.removeItem(this.conversationKey);
    }
  }

  // ==========================================
  // Generic API request helper
  // ==========================================

  async apiRequest(path, options = {}) {
    if (!this.backendEnabled || !this.backendUrl) {
      throw new Error('Backend authentication is required for this project.');
    }

    const headers = {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    };

    const token = this.getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${this.backendUrl}${path}`, {
      ...options,
      headers
    });

    const text = await response.text();
    const data = text ? (() => {
      try {
        return JSON.parse(text);
      } catch (error) {
        return { raw: text };
      }
    })() : {};

    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
    }

    return data;
  }

  // ==========================================
  // Auth: register / login
  // ==========================================

  async registerUser(username, password) {
    try {
      const data = await this.apiRequest('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
        headers: { 'Content-Type': 'application/json' }
      });

      if (data.token && data.user?.username) {
        this.setSession(data.user.username, data.token);
      }

      return { success: true, message: 'Registration successful!', user: data.user };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  async loginUser(username, password) {
    try {
      const data = await this.apiRequest('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
        headers: { 'Content-Type': 'application/json' }
      });

      if (data.token && data.user?.username) {
        this.setSession(data.user.username, data.token);
      }

      return { success: true, message: 'Login successful!', user: data.user };
    } catch (error) {
      return { success: false, message: error.message };
    }
  }

  // ==========================================
  // Conversation management
  // ==========================================

  /** List all conversations, newest first */
  async getConversations() {
    const data = await this.apiRequest('/conversations', { method: 'GET' });
    return data.conversations || [];
  }

  /**
   * Create a new conversation and make it active.
   * @returns {object} { id, title, createdAt }
   */
  async createConversation(title = 'New Conversation') {
    const data = await this.apiRequest('/conversations', {
      method: 'POST',
      body: JSON.stringify({ title })
    });
    this.setCurrentConversationId(data.id);
    return data;
  }

  /**
   * Ensure there is an active conversation. If none is stored, pick the most
   * recent one from the server (or create a fresh one).
   * @returns {string} conversation id
   */
  async ensureConversation() {
    let id = this.getCurrentConversationId();
    if (id) return id;
    // No active conversation — create a fresh one on the first message send
    const convo = await this.createConversation('New Conversation');
    return convo.id;
  }

  /** Switch active conversation */
  switchConversation(id) {
    this.setCurrentConversationId(id);
  }

  /** Delete a conversation. If it was active, clear the stored id. */
  async deleteConversation(id) {
    await this.apiRequest(`/conversations/${id}`, { method: 'DELETE' });
    if (this.getCurrentConversationId() === String(id)) {
      this.setCurrentConversationId(null);
    }
  }

  // ==========================================
  // Chat history (scoped to active conversation)
  // ==========================================

  async getChatHistoryServer() {
    const id = this.getCurrentConversationId();
    // No active conversation yet — return empty so the user sees a fresh screen
    if (!id) return [];
    const data = await this.apiRequest(`/conversations/${id}`, { method: 'GET' });
    return data.messages || [];
  }

  async saveChatMessageServer(role, content) {
    const id = await this.ensureConversation();
    const data = await this.apiRequest(`/conversations/${id}/messages`, {
      method: 'POST',
      body: JSON.stringify({ role, content })
    });
    // If server auto-titled the conversation, return the new title
    return data.title || null;
  }

  async clearChatHistoryServer() {
    const id = this.getCurrentConversationId();
    if (!id) return;
    return this.apiRequest(`/conversations/${id}/messages`, { method: 'DELETE' });
  }
}

// Create global instance
const userManager = new UserManager();
