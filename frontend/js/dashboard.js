// ── Dashboard state ────────────────────────────────────────────────────────────
let allTasks = [];
let dashboardStats = null;
let activeFilter = 'all';

const FILTER_META = {
  all:          { title: 'All assigned tasks',   empty: 'No tasks assigned to you yet.' },
  TODO:         { title: 'Pending tasks',        empty: 'No pending tasks.' },
  IN_PROGRESS:  { title: 'In progress',          empty: 'Nothing in progress right now.' },
  DONE:         { title: 'Completed tasks',    empty: 'No completed tasks yet.' },
  overdue:      { title: 'Overdue tasks',        empty: 'No overdue tasks — you\'re on track!' },
};

document.addEventListener('DOMContentLoaded', async () => {
  initPageChrome();
  requireAuth();
  const user = getCurrentUser();
  if (!user) { logout(); return; }

  document.getElementById('user-name').textContent  = user.name;
  document.getElementById('user-email').textContent = user.email;
  setUserAvatar(document.getElementById('user-avatar'), user.name);
  const roleSummary = document.getElementById('user-role-summary');
  if (roleSummary) {
    roleSummary.innerHTML = `Signed in as ${roleBadge(user.account_role || 'MEMBER')}`;
  }
  document.getElementById('logout-btn').addEventListener('click', logout);

  const createBtn = document.getElementById('create-project-btn');
  if (createBtn && isAccountMember()) {
    createBtn.classList.add('hidden');
  }

  const pendingIcon = document.getElementById('stat-icon-pending');
  if (pendingIcon && typeof Icons !== 'undefined') pendingIcon.innerHTML = Icons.tasks;

  const hubIcon = document.getElementById('hub-llm-icon');
  const projIcon = document.getElementById('proj-llm-icon');
  if (hubIcon && typeof Icons !== 'undefined') hubIcon.innerHTML = Icons.sparkles;
  if (projIcon && typeof Icons !== 'undefined') projIcon.innerHTML = Icons.sparkles;

  document.querySelectorAll('.stat-card-btn').forEach(btn => {
    btn.addEventListener('click', () => setActiveFilter(btn.dataset.filter));
  });

  const modal         = document.getElementById('create-project-modal');
  const closeModal    = document.getElementById('close-modal');
  const cancelCreate  = document.getElementById('cancel-create');
  const createForm    = document.getElementById('create-project-form');

  createBtn?.addEventListener('click', () => modal.classList.add('open'));
  closeModal.addEventListener('click', () => modal.classList.remove('open'));
  cancelCreate.addEventListener('click', () => modal.classList.remove('open'));
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.classList.remove('open'); });

  document.getElementById('ai-project-desc-btn')?.addEventListener('click', generateProjectDescription);
  document.getElementById('hub-llm-refresh')?.addEventListener('click', runHubLlmInsight);

  createForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = createForm.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await API.post('/projects/', {
        name:        createForm.proj_name.value.trim(),
        description: createForm.proj_desc.value.trim() || null,
      });
      modal.classList.remove('open');
      createForm.reset();
      document.getElementById('proj-llm-status')?.classList.add('hidden');
      showToast('Project created successfully', 'success');
      loadWorkHub();
    } catch (ex) {
      showToast(ex.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  window.refreshPageData = loadWorkHub;
  loadWorkHub();
});

function setActiveFilter(filter) {
  activeFilter = filter;
  document.querySelectorAll('.stat-card-btn').forEach(btn => {
    const on = btn.dataset.filter === filter;
    btn.classList.toggle('active', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  applyFilter();
}

function filterTasks(tasks, filter) {
  if (filter === 'all') return tasks;
  if (filter === 'overdue') {
    return tasks.filter(t => isOverdue(t.due_date, t.status));
  }
  return tasks.filter(t => t.status === filter);
}

function applyFilter() {
  const filtered = filterTasks(allTasks, activeFilter);
  renderFilterPanel(filtered, activeFilter);
  if (typeof TaskPieChart !== 'undefined') {
    TaskPieChart.update(filtered, dashboardStats, activeFilter);
  }
  const panel = document.getElementById('filter-tasks-panel');
  if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function loadWorkHub() {
  try {
    const [stats, projects] = await Promise.all([
      API.get('/tasks/dashboard'),
      API.get('/projects/'),
    ]);
    allTasks = stats.my_tasks || [];
    dashboardStats = stats;
    renderStats(stats, allTasks);
    renderMyTasks(allTasks);
    renderProjects(projects);
    renderRoleSummary(projects);
    applyFilter();
  } catch (ex) {
    showToast('Failed to load work hub: ' + ex.message, 'error');
  }
}

function renderRoleSummary(projects) {
  const el = document.getElementById('user-role-summary');
  if (!el) return;
  const user = getCurrentUser();
  const account = user ? `Signed in as ${roleBadge(user.account_role || 'MEMBER')}` : '';
  if (!projects.length) {
    el.innerHTML = account + (account ? '<br>' : '') + 'No project roles yet';
    return;
  }
  const leads = projects.filter(p => p.my_role === 'ADMIN').length;
  const tasker = projects.filter(p => p.my_role === 'MEMBER').length;
  const parts = [];
  if (leads) parts.push(`Lead on ${leads}`);
  if (tasker) parts.push(`Tasker on ${tasker}`);
  el.innerHTML = account + (account ? '<br>' : '') + (parts.join(' · ') || 'Member');
}

function renderStats(stats, tasks) {
  const pending = tasks.filter(t => t.status === 'TODO').length;
  document.getElementById('stat-total').textContent    = stats.total_tasks;
  document.getElementById('stat-pending').textContent  = pending;
  document.getElementById('stat-progress').textContent = stats.in_progress;
  document.getElementById('stat-done').textContent     = stats.done;
  document.getElementById('stat-overdue').textContent  = stats.overdue;
}

function renderFilterPanel(tasks, filter) {
  const list = document.getElementById('filter-panel-list');
  const title = document.getElementById('filter-panel-title');
  const count = document.getElementById('filter-panel-count');
  const meta = FILTER_META[filter] || FILTER_META.all;

  if (title) title.textContent = meta.title;
  if (count) count.textContent = tasks.length;

  if (!list) return;

  if (!tasks.length) {
    list.innerHTML = emptyState(meta.empty);
    return;
  }

  list.innerHTML = tasks.map(t => taskRowHtml(t)).join('');
}

function taskRowHtml(t) {
  const overdue = isOverdue(t.due_date, t.status);
  return `
    <div class="task-item ${overdue ? 'overdue' : ''}" role="button" tabindex="0"
         onclick="window.location.href='/project?id=${t.project_id}'"
         onkeydown="if(event.key==='Enter')window.location.href='/project?id=${t.project_id}'">
      <div class="task-info">
        <div class="task-title">${escHtml(t.title)}</div>
        <div class="task-meta">
          ${statusBadge(t.status)}
          ${priorityBadge(t.priority)}
          ${t.due_date ? `<span class="task-due${overdue ? ' overdue' : ''}">${Icons.calendar} ${formatDate(t.due_date)}${overdue ? ' · Overdue' : ''}</span>` : ''}
        </div>
      </div>
      <span class="task-item-arrow">→</span>
    </div>`;
}

function renderMyTasks(tasks) {
  const el = document.getElementById('my-tasks-list');
  const badge = document.getElementById('my-tasks-badge');
  badge.textContent = tasks.length;

  if (!tasks.length) {
    el.innerHTML = emptyState('No deliverables assigned to you yet.');
    return;
  }

  el.innerHTML = tasks.slice(0, 8).map(t => {
    const overdue = isOverdue(t.due_date, t.status);
    return `
      <div class="task-item ${overdue ? 'overdue' : ''}" onclick="window.location.href='/project?id=${t.project_id}'">
        <div class="task-info">
          <div class="task-title">${escHtml(t.title)}</div>
          <div class="task-meta">
            ${statusBadge(t.status)}
            ${priorityBadge(t.priority)}
            ${t.due_date ? `<span class="task-due${overdue ? ' overdue' : ''}">${Icons.calendar} ${formatDate(t.due_date)}${overdue ? ' · Overdue' : ''}</span>` : ''}
          </div>
        </div>
      </div>`;
  }).join('');
}

function renderProjects(projects) {
  const el = document.getElementById('projects-grid');
  const badge = document.getElementById('projects-badge');
  badge.textContent = projects.length;

  if (!projects.length) {
    el.innerHTML = emptyState('No initiatives yet. Create your first project to get started.');
    return;
  }

  el.innerHTML = projects.map(p => {
    const pct = p.task_count ? Math.round((p.done_count / p.task_count) * 100) : 0;
    return `
      <div class="project-card" onclick="window.location.href='/project?id=${p.id}'">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px;margin-bottom:4px">
          <h3>${escHtml(p.name)}</h3>
          ${roleBadge(p.my_role)}
        </div>
        <p>${escHtml(p.description || 'No description')}</p>
        <div class="project-meta">
          <span>${p.member_count} member${p.member_count !== 1 ? 's' : ''}</span>
          <span>${p.done_count} / ${p.task_count} completed</span>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" style="width:${pct}%"></div>
        </div>
      </div>`;
  }).join('');
}

async function generateProjectDescription() {
  const name = document.getElementById('proj_name')?.value.trim();
  const statusEl = document.getElementById('proj-llm-status');
  const descEl = document.getElementById('proj_desc');
  if (!name) {
    showToast('Enter a project name first', 'error');
    return;
  }
  const btn = document.getElementById('ai-project-desc-btn');
  btn.disabled = true;
  statusEl.classList.remove('hidden');
  statusEl.textContent = 'LLM generating…';
  try {
    const res = await API.post('/ai/project-description', {
      name,
      context: document.getElementById('proj_ai_context')?.value.trim() || null,
    });
    descEl.value = res.description;
    statusEl.innerHTML = escHtml(res.description) + `<div class="llm-source">${res.source === 'llm' ? 'OpenAI' : 'Built-in assistant'}</div>`;
    showToast('Description generated', 'success');
  } catch (ex) {
    statusEl.textContent = ex.message;
    showToast(ex.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function runHubLlmInsight() {
  const out = document.getElementById('hub-llm-output');
  const btn = document.getElementById('hub-llm-refresh');
  btn.disabled = true;
  out.classList.remove('hidden');
  out.textContent = 'Analyzing…';
  try {
    const stats = await API.get('/tasks/dashboard');
    const projects = await API.get('/projects/');
    const leadN = projects.filter(p => p.my_role === 'ADMIN').length;
    const lines = [
      `You have ${stats.total_tasks} assigned deliverable(s): ${stats.in_progress} in progress, ${stats.done} done, ${stats.overdue} overdue.`,
      `Across ${projects.length} initiative(s) — Project Lead on ${leadN}, Tasker on ${projects.length - leadN}.`,
    ];
    if (stats.overdue > 0) lines.push('Priority: clear overdue items or ask your Project Lead for an extension.');
    if (stats.total_tasks === 0) lines.push('No assignments yet — check Active initiatives or ask your lead to assign work.');
    if (projects.length && stats.in_progress === 0 && stats.total_tasks > 0) {
      lines.push('LLM tip: move one task to In progress to signal active work to stakeholders.');
    }
    out.innerHTML = lines.map(l => `<p style="margin-bottom:8px">${escHtml(l)}</p>`).join('')
      + '<div class="llm-source">Built-in assistant</div>';
  } catch (ex) {
    out.textContent = ex.message;
  } finally {
    btn.disabled = false;
  }
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
