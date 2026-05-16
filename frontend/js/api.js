// ── API Wrapper ────────────────────────────────────────────────────────────────
const API = (() => {
  const BASE = '/api';

  function getToken() {
    return localStorage.getItem('token');
  }

  async function request(method, path, body = null) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const opts = { method, headers };
    if (body !== null) opts.body = JSON.stringify(body);

    const res = await fetch(BASE + path, opts);

    // handle no-content
    if (res.status === 204) return null;

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      let msg = `HTTP ${res.status}`;
      const d = data.detail;
      if (typeof d === 'string') msg = d;
      else if (Array.isArray(d)) msg = d.map(e => e.msg || e.message || JSON.stringify(e)).join(', ');
      throw new Error(msg);
    }
    return data;
  }

  return {
    get:    (path)        => request('GET',    path),
    post:   (path, body)  => request('POST',   path, body),
    put:    (path, body)  => request('PUT',    path, body),
    patch:  (path, body)  => request('PATCH',  path, body),
    delete: (path)        => request('DELETE', path),
  };
})();

// ── Auth helpers ───────────────────────────────────────────────────────────────
function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('user')); }
  catch { return null; }
}

/** Global account role from sign-in (ADMIN = Project Lead, MEMBER = Tasker) */
function isAccountAdmin() {
  const user = getCurrentUser();
  return user?.account_role === 'ADMIN';
}

function isAccountMember() {
  const user = getCurrentUser();
  return user?.account_role === 'MEMBER';
}

function accountRoleLabel() {
  return roleLabel(getCurrentUser()?.account_role || 'MEMBER');
}
function saveAuth(data) {
  localStorage.setItem('token', data.access_token);
  localStorage.setItem('user',  JSON.stringify(data.user));
}
function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
}
function requireAuth() {
  if (!localStorage.getItem('token')) window.location.href = '/';
}

// ── Toast ──────────────────────────────────────────────────────────────────────
function showToast(message, type = 'info', duration = 3500) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.textContent = message;
  container.appendChild(t);
  setTimeout(() => t.remove(), duration);
}

// ── Utility ────────────────────────────────────────────────────────────────────
function getInitials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}
function formatDate(d) {
  if (!d) return '';
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function isOverdue(d, status) {
  if (!d || status === 'DONE') return false;
  return new Date(d + 'T00:00:00') < new Date(new Date().toDateString());
}
function statusBadge(s) {
  const map = { TODO: ['badge-todo','To do'], IN_PROGRESS: ['badge-in-progress','In progress'], DONE: ['badge-done','Done'] };
  const [cls, label] = map[s] || ['badge-todo', s];
  return `<span class="badge ${cls}">${label}</span>`;
}
function priorityBadge(p) {
  const map = { LOW: ['badge-low','Low'], MEDIUM: ['badge-medium','Medium'], HIGH: ['badge-high','High'] };
  const [cls, label] = map[p] || ['', p];
  return `<span class="badge ${cls}">${label}</span>`;
}

/** Human-readable role (ADMIN → Project Lead, MEMBER → Tasker) */
function roleLabel(role) {
  if (role === 'ADMIN') return 'Project Lead';
  if (role === 'MEMBER') return 'Tasker';
  return role;
}

function roleBadge(role) {
  const isLead = role === 'ADMIN';
  const cls = isLead ? 'badge-lead' : 'badge-tasker';
  const title = isLead
    ? 'Project Lead — manages team, tasks, and members'
    : 'Tasker — works on assigned tasks';
  return `<span class="badge ${cls}" title="${title}">${roleLabel(role)}</span>`;
}

const AVATAR_COLORS = ['#0d9488', '#0369a1', '#7c3aed', '#b45309', '#be123c', '#4d7c0f'];

function avatarColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function getTheme() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
}

function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  updateThemeToggleUI();
}

function toggleTheme() {
  setTheme(getTheme() === 'light' ? 'dark' : 'light');
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.setAttribute('data-theme', saved);
  } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
}

function updateThemeToggleUI() {
  if (typeof Icons === 'undefined') return;
  const isLight = getTheme() === 'light';
  const svg = isLight ? Icons.moon : Icons.sun;
  const label = isLight ? 'Dark mode' : 'Light mode';
  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    const iconEl = btn.querySelector('.nav-icon');
    const labelEl = btn.querySelector('.theme-label');
    if (iconEl) iconEl.innerHTML = svg;
    else btn.innerHTML = svg;
    if (labelEl) labelEl.textContent = label;
    btn.setAttribute('aria-label', 'Switch to ' + (isLight ? 'dark' : 'light') + ' mode');
    btn.title = btn.getAttribute('aria-label');
  });
}

function bindChromeActions() {
  document.querySelectorAll('[data-theme-toggle]').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });
  const refreshBtn = document.getElementById('refresh-btn');
  if (refreshBtn && typeof window.refreshPageData === 'function') {
    refreshBtn.addEventListener('click', async () => {
      refreshBtn.classList.add('spinning');
      refreshBtn.disabled = true;
      try {
        await window.refreshPageData();
        showToast('Page refreshed', 'success');
      } catch (ex) {
        showToast(ex.message || 'Refresh failed', 'error');
      } finally {
        refreshBtn.classList.remove('spinning');
        refreshBtn.disabled = false;
      }
    });
  }
}

function initPageChrome() {
  initTheme();
  if (typeof Icons === 'undefined') return;
  const map = {
    'sidebar-logo': Icons.logo,
    'brand-logo': Icons.logo,
    'mobile-logo': Icons.logo,
    'nav-icon-dashboard': Icons.home,
    'nav-icon-project': Icons.folder,
    'nav-icon-logout': Icons.logout,
    'nav-icon-refresh': Icons.refresh,
    'stat-icon-total': Icons.tasks,
    'stat-icon-progress': Icons.progress,
    'stat-icon-done': Icons.check,
    'stat-icon-overdue': Icons.alert,
    'btn-icon-plus': Icons.plus,
  };
  Object.entries(map).forEach(([id, svg]) => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = svg;
  });
  document.querySelectorAll('.modal-close').forEach(btn => {
    if (!btn.querySelector('svg')) btn.innerHTML = Icons.close;
  });
  updateThemeToggleUI();
  bindChromeActions();
}

function avatarHtml(name, cls = '') {
  const bg = avatarColor(name);
  return `<div class="avatar ${cls}" style="background:${bg}">${getInitials(name)}</div>`;
}

function emptyState(message) {
  const icon = typeof Icons !== 'undefined' ? Icons.empty : '';
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><p>${message}</p></div>`;
}

function setUserAvatar(el, name) {
  if (!el) return;
  el.textContent = getInitials(name);
  el.style.background = avatarColor(name);
}
