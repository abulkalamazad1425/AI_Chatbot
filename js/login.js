// js/login.js
// ==========================================
// Login Page Functionality
// ==========================================

document.addEventListener('DOMContentLoaded', function () {
  if (userManager.isLoggedIn()) {
    window.location.href = 'index.html';
    return;
  }

  initTheme();
  setupTabSwitching();
  setupFormHandlers();
});

// Theme Management
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

// Theme toggle event listener
document.getElementById('themeToggleLarge')?.addEventListener('click', toggleTheme);

// Setup tab switching
function setupTabSwitching() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  const authTabs = document.querySelectorAll('.auth-tab');
  const tabSwitches = document.querySelectorAll('.tab-switch');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetTab = btn.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });

  tabSwitches.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const targetTab = link.getAttribute('data-tab');
      switchTab(targetTab);
    });
  });
}

function switchTab(tabName) {
  // Update active tab button
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');

  // Update active tab content
  document.querySelectorAll('.auth-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  document.getElementById(`${tabName}-tab`).classList.add('active');

  // Clear error messages
  document.getElementById('loginError')?.textContent && (document.getElementById('loginError').textContent = '');
  document.getElementById('registerError')?.textContent && (document.getElementById('registerError').textContent = '');
}

// Setup form handlers
function setupFormHandlers() {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');

  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  if (registerForm) {
    registerForm.addEventListener('submit', handleRegister);
  }
}

// Handle login form submission
async function handleLogin(e) {
  e.preventDefault();

  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorDiv = document.getElementById('loginError');

  // Clear previous errors
  errorDiv.textContent = '';
  errorDiv.classList.remove('show');

  // Validate input
  if (!username || !password) {
    showError(errorDiv, 'Please enter both username and password');
    return;
  }

  // Attempt login
  const result = await userManager.loginUser(username, password);

  if (!result.success) {
    showError(errorDiv, result.message);
    return;
  }

  console.log('✅ Login successful!');

  // Clear active conversation — a new one is created lazily on the first message
  userManager.setCurrentConversationId(null);

  setTimeout(() => {
    window.location.href = 'index.html';
  }, 500);
}

// Handle register form submission
async function handleRegister(e) {
  e.preventDefault();

  const username = document.getElementById('registerUsername').value.trim();
  const password = document.getElementById('registerPassword').value;
  const password2 = document.getElementById('registerPassword2').value;
  const errorDiv = document.getElementById('registerError');

  // Clear previous errors
  errorDiv.textContent = '';
  errorDiv.classList.remove('show');

  // Validate input
  if (!username || !password || !password2) {
    showError(errorDiv, 'Please fill in all fields');
    return;
  }

  if (password !== password2) {
    showError(errorDiv, 'Passwords do not match');
    return;
  }

  // Attempt registration
  const result = await userManager.registerUser(username, password);

  if (!result.success) {
    showError(errorDiv, result.message);
    return;
  }

  console.log('✅ Registration successful!');
  showSuccess(errorDiv, 'Account created! Redirecting to chat...');

  document.getElementById('registerForm').reset();

  setTimeout(() => {
    window.location.href = 'index.html';
  }, 1000);
}

// Show error message
function showError(element, message) {
  element.textContent = '❌ ' + message;
  element.classList.add('show');
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

// Show success message
function showSuccess(element, message) {
  element.style.background = 'rgba(40, 167, 69, 0.1)';
  element.style.borderColor = '#28a745';
  element.style.color = '#28a745';
  element.textContent = '✅ ' + message;
  element.classList.add('show');
}
