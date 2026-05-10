// js/auth.js
// ==========================================
// JWT-backed Authentication and User Session Management
// ==========================================

class UserManager {
  constructor() {
    this.sessionKey = 'llm_chatbot_session';

    // Backend sync (required). `API_CONFIG` is defined in config/api.js
    this.backendEnabled = (typeof API_CONFIG !== 'undefined') && API_CONFIG.useBackend;
    this.backendUrl = this.backendEnabled ? (API_CONFIG.backendUrl || '/api') : null;
  }

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
    return { success: true, message: 'Logged out successfully!' };
  }

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

  async saveChatMessageServer(role, content) {
    await this.apiRequest('/history/messages', {
      method: 'POST',
      body: JSON.stringify({ role, content }),
      headers: { 'Content-Type': 'application/json' }
    });
  }

  async getChatHistoryServer() {
    const data = await this.apiRequest('/history', { method: 'GET' });
    return data.messages || [];
  }

  async clearChatHistoryServer() {
    return this.apiRequest('/history', { method: 'DELETE' });
  }
}

// Create global instance
const userManager = new UserManager();
