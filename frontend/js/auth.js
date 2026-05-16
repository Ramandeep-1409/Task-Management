// ── Login / Signup Logic ───────────────────────────────────────────────────────

const ROLE_HINTS = {
  ADMIN: 'Project Lead — create projects, manage teams, and full task CRUD.',
  MEMBER: 'Tasker — view projects and boards; update status on tasks assigned to you.',
};

function getSelectedAccountRole() {
  const active = document.querySelector('.auth-role-tab.active');
  return active?.dataset.role || 'ADMIN';
}

function initRoleTabs() {
  const tabs = document.querySelectorAll('.auth-role-tab');
  const hint = document.getElementById('role-hint');
  if (!tabs.length) return;

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => {
        t.classList.remove('active');
        t.setAttribute('aria-selected', 'false');
      });
      tab.classList.add('active');
      tab.setAttribute('aria-selected', 'true');
      if (hint) hint.textContent = ROLE_HINTS[tab.dataset.role] || '';
    });
  });

  if (hint) hint.textContent = ROLE_HINTS[getSelectedAccountRole()];
}

document.addEventListener('DOMContentLoaded', () => {
  if (typeof initPageChrome === 'function') initPageChrome();
  initRoleTabs();

  if (localStorage.getItem('token')) {
    window.location.href = '/dashboard';
    return;
  }

  const loginForm  = document.getElementById('login-form');
  const signupForm = document.getElementById('signup-form');

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = loginForm.querySelector('button[type=submit]');
      const err = document.getElementById('login-error');
      btn.disabled = true;
      btn.textContent = 'Signing in…';
      err.classList.remove('visible');
      try {
        const data = await API.post('/auth/login', {
          email:        loginForm.email.value.trim(),
          password:     loginForm.password.value,
          account_role: getSelectedAccountRole(),
        });
        saveAuth(data);
        window.location.href = '/dashboard';
      } catch (ex) {
        err.textContent = ex.message;
        err.classList.add('visible');
        btn.disabled = false;
        btn.textContent = 'Sign in';
      }
    });
  }

  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = signupForm.querySelector('button[type=submit]');
      const err = document.getElementById('signup-error');
      btn.disabled = true;
      btn.textContent = 'Creating account…';
      err.classList.remove('visible');

      const password  = signupForm.password.value;
      const password2 = signupForm.password2.value;
      if (password !== password2) {
        err.textContent = 'Passwords do not match';
        err.classList.add('visible');
        btn.disabled = false;
        btn.textContent = 'Create account';
        return;
      }
      try {
        const data = await API.post('/auth/signup', {
          name:         signupForm.name.value.trim(),
          email:        signupForm.email.value.trim(),
          password,
          account_role: getSelectedAccountRole(),
        });
        saveAuth(data);
        window.location.href = '/dashboard';
      } catch (ex) {
        err.textContent = ex.message;
        err.classList.add('visible');
        btn.disabled = false;
        btn.textContent = 'Create account';
      }
    });
  }
});
