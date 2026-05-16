// ── Project Page ───────────────────────────────────────────────────────────────
let PROJECT_ID   = null;
let currentUser  = null;
let isAdmin      = false;
let projectData  = null;
let projectTasks = [];

document.addEventListener('DOMContentLoaded', async () => {
  initPageChrome();
  requireAuth();
  currentUser = getCurrentUser();
  if (!currentUser) { logout(); return; }

  PROJECT_ID = new URLSearchParams(window.location.search).get('id');
  if (!PROJECT_ID) { window.location.href = '/dashboard'; return; }

  document.getElementById('user-name').textContent   = currentUser.name;
  document.getElementById('user-email').textContent  = currentUser.email;
  setUserAvatar(document.getElementById('user-avatar'), currentUser.name);
  document.getElementById('logout-btn').addEventListener('click', logout);

  const taskIcon = document.getElementById('task-llm-icon');
  if (taskIcon && typeof Icons !== 'undefined') taskIcon.innerHTML = Icons.sparkles;

  setupModals();
  window.refreshPageData = loadProject;
  await loadProject();
});

async function loadProject() {
  try {
    const [project, tasks] = await Promise.all([
      API.get(`/projects/${PROJECT_ID}`),
      API.get(`/tasks/project/${PROJECT_ID}`),
    ]);
    projectData  = project;
    projectTasks = tasks;

    const me = project.members.find(m => m.user_id === currentUser.id);
    const projectLead = me && me.role === 'ADMIN';
    isAdmin = projectLead && isAccountAdmin();

    renderProjectHeader(project);
    renderMembers(project.members);
    renderKanban(tasks);
    toggleAdminControls();
    bindProjectLlm();
  } catch (ex) {
    showToast('Failed to load project: ' + ex.message, 'error');
  }
}

function renderProjectHeader(p) {
  document.title = p.name + ' — TaskFlow';
  document.getElementById('project-name').textContent = p.name;
  document.getElementById('project-desc').textContent = p.description || '';
  const me = p.members.find(m => m.user_id === currentUser.id);
  const roleEl = document.getElementById('my-project-role');
  if (roleEl && me) roleEl.innerHTML = roleBadge(me.role);
}

function renderMembers(members) {
  const el = document.getElementById('members-strip');
  el.innerHTML = `<span class="members-strip-label">Team</span>` +
    members.map(m => `
      <div class="member-chip">
        ${avatarHtml(m.user.name, 'avatar-sm')}
        <span class="name">${escHtml(m.user.name)}</span>
        ${roleBadge(m.role)}
        ${isAdmin && m.user_id !== currentUser.id
          ? `<button type="button" class="btn-remove-member" onclick="removeMember(${m.user_id})" title="Remove member">${Icons.close}</button>`
          : ''}
      </div>`).join('');
}

function renderKanban(tasks) {
  const cols = { TODO: [], IN_PROGRESS: [], DONE: [] };
  tasks.forEach(t => cols[t.status]?.push(t));

  ['TODO','IN_PROGRESS','DONE'].forEach(status => {
    const list  = document.getElementById(`col-${status}`);
    const count = document.getElementById(`count-${status}`);
    count.textContent = cols[status].length;
    if (!cols[status].length) {
      list.innerHTML = emptyState('No tasks in this column');
      return;
    }
    list.innerHTML = cols[status].map(t => taskCard(t)).join('');
  });
}

function taskCard(t) {
  const overdue = isOverdue(t.due_date, t.status);
  return `
    <div class="kanban-card ${overdue ? 'overdue' : ''}" onclick="openTaskModal(${t.id})">
      <div class="kanban-card-title">${escHtml(t.title)}</div>
      <div class="kanban-card-meta">
        ${priorityBadge(t.priority)}
        ${t.assignee ? avatarHtml(t.assignee.name, 'avatar-sm') : '<span class="text-muted text-xs">Unassigned</span>'}
      </div>
      ${t.due_date ? `
      <div class="kanban-card-footer">
        <span class="due-date ${overdue ? 'overdue' : ''}">${Icons.calendar} ${formatDate(t.due_date)}</span>
      </div>` : ''}
    </div>`;
}

// ── Task Detail Modal ──────────────────────────────────────────────────────────
function openTaskModal(taskId) {
  const t = projectTasks.find(x => x.id === taskId);
  if (!t) return;

  const overdue = isOverdue(t.due_date, t.status);
  const canEdit = isAdmin || (isAccountMember() && t.assignee_id === currentUser.id);

  document.getElementById('task-detail-title').textContent = t.title;
  document.getElementById('task-detail-body').innerHTML = `
    <div class="form-group">
      <label>Description</label>
      <p class="text-sm" style="color:var(--text-secondary)">${escHtml(t.description || 'No description')}</p>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="form-group">
        <label>Status</label>
        ${canEdit ? `
          <select id="task-status-sel" class="form-group select" style="width:100%;padding:10px 14px;background:var(--bg-inset);border:1px solid var(--border);border-radius:8px;color:var(--text-primary)">
            <option value="TODO"        ${t.status==='TODO'?'selected':''}>To Do</option>
            <option value="IN_PROGRESS" ${t.status==='IN_PROGRESS'?'selected':''}>In Progress</option>
            <option value="DONE"        ${t.status==='DONE'?'selected':''}>Done</option>
          </select>` : statusBadge(t.status)}
      </div>
      <div class="form-group">
        <label>Priority</label>
        ${priorityBadge(t.priority)}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
      <div class="form-group">
        <label>Assignee</label>
        <p class="text-sm">${t.assignee ? escHtml(t.assignee.name) : '<span class="text-muted">Unassigned</span>'}</p>
      </div>
      <div class="form-group">
        <label>Due Date</label>
        <p class="text-sm ${overdue ? 'danger' : ''}">${t.due_date ? formatDate(t.due_date) + (overdue ? ' · Overdue' : '') : '—'}</p>
      </div>
    </div>
    ${isAdmin ? `
    <div style="display:flex;gap:10px;margin-top:8px">
      <button class="btn btn-ghost btn-sm" onclick="openEditTask(${t.id})">Edit</button>
      <button class="btn btn-danger btn-sm" onclick="deleteTask(${t.id})">Delete</button>
    </div>` : ''}
  `;

  document.getElementById('save-status-btn').onclick = async () => {
    if (!canEdit) return;
    const sel = document.getElementById('task-status-sel');
    if (!sel) return;
    try {
      await API.patch(`/tasks/${t.id}/status`, { status: sel.value });
      showToast('Status updated!', 'success');
      closeAllModals();
      await loadProject();
    } catch (ex) { showToast(ex.message, 'error'); }
  };
  document.getElementById('save-status-btn').style.display = canEdit ? '' : 'none';

  document.getElementById('task-detail-modal').classList.add('open');
}

async function deleteTask(taskId) {
  if (!confirm('Delete this task?')) return;
  try {
    await API.delete(`/tasks/${taskId}`);
    showToast('Task deleted', 'success');
    closeAllModals();
    await loadProject();
  } catch (ex) { showToast(ex.message, 'error'); }
}

// ── Add Task Modal ─────────────────────────────────────────────────────────────
function setupModals() {
  // Add Task
  document.getElementById('add-task-btn')?.addEventListener('click', () => {
    populateMemberSelect();
    document.getElementById('add-task-modal').classList.add('open');
  });
  document.getElementById('close-task-modal')?.addEventListener('click', closeAllModals);
  document.getElementById('cancel-task')?.addEventListener('click', closeAllModals);

  document.getElementById('add-task-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f   = e.target;
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await API.post(`/tasks/project/${PROJECT_ID}`, {
        title:       f.task_title.value.trim(),
        description: f.task_desc.value.trim() || null,
        assignee_id: f.task_assignee.value ? parseInt(f.task_assignee.value) : null,
        status:      f.task_status.value,
        priority:    f.task_priority.value,
        due_date:    f.task_due.value || null,
      });
      showToast('Task created!', 'success');
      closeAllModals();
      f.reset();
      await loadProject();
    } catch (ex) {
      showToast(ex.message, 'error');
    } finally { btn.disabled = false; }
  });

  // Add Member
  document.getElementById('add-member-btn')?.addEventListener('click', () =>
    document.getElementById('add-member-modal').classList.add('open'));
  document.getElementById('close-member-modal')?.addEventListener('click', closeAllModals);
  document.getElementById('cancel-member')?.addEventListener('click', closeAllModals);

  document.getElementById('ai-task-insight-btn')?.addEventListener('click', runTaskInsight);
  document.getElementById('ai-suggest-tasks-btn')?.addEventListener('click', suggestProjectTasks);

  document.getElementById('add-member-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const f   = e.target;
    const btn = f.querySelector('button[type=submit]');
    btn.disabled = true;
    try {
      await API.post(`/projects/${PROJECT_ID}/members`, {
        email: f.member_email.value.trim(),
        role:  f.member_role.value,
      });
      showToast('Member added!', 'success');
      closeAllModals();
      f.reset();
      await loadProject();
    } catch (ex) {
      showToast(ex.message, 'error');
    } finally { btn.disabled = false; }
  });

  // Task detail close
  document.getElementById('close-task-detail')?.addEventListener('click', closeAllModals);
  document.getElementById('close-detail-btn')?.addEventListener('click', closeAllModals);

  // Close on overlay click
  document.querySelectorAll('.modal-overlay').forEach(o =>
    o.addEventListener('click', (e) => { if (e.target === o) closeAllModals(); }));
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('open'));
}

function populateMemberSelect() {
  const sel = document.getElementById('task_assignee');
  if (!sel || !projectData) return;
  sel.innerHTML = '<option value="">Unassigned</option>' +
    projectData.members.map(m => `<option value="${m.user_id}">${escHtml(m.user.name)}</option>`).join('');
}

function toggleAdminControls() {
  const adminEls = document.querySelectorAll('.admin-only');
  adminEls.forEach(el => el.classList.toggle('hidden', !isAdmin));
}

function bindProjectLlm() {
  const icon = document.getElementById('project-llm-icon');
  if (icon && typeof Icons !== 'undefined') icon.innerHTML = Icons.sparkles;
  document.getElementById('project-llm-suggest-btn')?.addEventListener('click', async () => {
    if (!isAdmin || !projectData) return;
    const list = document.getElementById('project-llm-tasks');
    const btn = document.getElementById('project-llm-suggest-btn');
    btn.disabled = true;
    list.classList.remove('hidden');
    list.innerHTML = '<li>Generating…</li>';
    try {
      const res = await API.post('/ai/task-suggestions', {
        project_name: projectData.name,
        description: projectData.description,
        count: 6,
      });
      list.innerHTML = res.tasks.map(t => `<li>${escHtml(t)}</li>`).join('')
        + `<li style="list-style:none;margin-top:8px" class="llm-source">${res.source === 'llm' ? 'OpenAI' : 'Built-in assistant'}</li>`;
    } catch (ex) {
      showToast(ex.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

async function removeMember(userId) {
  if (!confirm('Remove this member?')) return;
  try {
    await API.delete(`/projects/${PROJECT_ID}/members/${userId}`);
    showToast('Member removed', 'success');
    await loadProject();
  } catch (ex) { showToast(ex.message, 'error'); }
}

function openEditTask(taskId) {
  showToast('Use the Add Task button to create a new task', 'info');
}

async function runTaskInsight() {
  const title = document.getElementById('task_title')?.value.trim();
  const out = document.getElementById('task-llm-insight');
  if (!title) {
    showToast('Enter a task title first', 'error');
    return;
  }
  const btn = document.getElementById('ai-task-insight-btn');
  btn.disabled = true;
  out.classList.remove('hidden');
  out.textContent = 'LLM thinking…';
  try {
    const res = await API.post('/ai/task-insight', {
      title,
      description: document.getElementById('task_desc')?.value.trim() || null,
    });
    out.innerHTML = escHtml(res.insight) + `<div class="llm-source">${res.source === 'llm' ? 'OpenAI' : 'Built-in assistant'}</div>`;
    out.innerHTML = out.innerHTML.replace('</div>', '</div>');
  } catch (ex) {
    out.textContent = ex.message;
    showToast(ex.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

async function suggestProjectTasks() {
  if (!isAdmin) {
    showToast('Only the Project Lead can suggest tasks', 'error');
    return;
  }
  const list = document.getElementById('ai-suggested-tasks');
  const btn = document.getElementById('ai-suggest-tasks-btn');
  btn.disabled = true;
  list.classList.remove('hidden');
  list.innerHTML = '<li>Generating…</li>';
  try {
    const res = await API.post('/ai/task-suggestions', {
      project_name: projectData.name,
      description: projectData.description,
      count: 5,
    });
    list.innerHTML = res.tasks.map(t => `<li>${escHtml(t)}</li>`).join('')
      + `<li class="llm-source" style="list-style:none;margin-top:8px">${res.source === 'llm' ? 'OpenAI' : 'Built-in assistant'}</li>`;
    showToast('Task ideas ready — copy into New task', 'success');
  } catch (ex) {
    list.innerHTML = '';
    showToast(ex.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

function escHtml(str) {
  if (!str) return '';
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
