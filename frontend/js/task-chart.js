// ── Live task pie chart — updates when stat filters change ─────────────────────
const TaskPieChart = (() => {
  const STATUS_SLICES = [
    { key: 'todo',       label: 'Pending',      color: '#a78bfa' },
    { key: 'inProgress', label: 'In progress',  color: '#38bdf8' },
    { key: 'done',       label: 'Completed',    color: '#4ade80' },
    { key: 'overdue',    label: 'Overdue',      color: '#fb7185' },
  ];

  const PRIORITY_SLICES = [
    { key: 'high',   label: 'High',   color: '#f472b6' },
    { key: 'medium', label: 'Medium', color: '#60a5fa' },
    { key: 'low',    label: 'Low',    color: '#94a3b8' },
  ];

  let canvas = null;
  let ctx = null;
  let animFrame = null;
  let activeSlices = STATUS_SLICES;
  let target = {};
  let current = {};
  let showOverdueRing = true;

  function init() {
    canvas = document.getElementById('task-pie-chart');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    STATUS_SLICES.forEach(s => { target[s.key] = 0; current[s.key] = 0; });
    resize();
    window.addEventListener('resize', resize);
  }

  function resize() {
    if (!canvas) return;
    const wrap = canvas.parentElement;
    const size = Math.min(wrap?.clientWidth || 220, 240);
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(current);
  }

  function countByStatus(tasks) {
    const data = { todo: 0, inProgress: 0, done: 0, overdue: 0 };
    (tasks || []).forEach(t => {
      if (t.status === 'TODO') data.todo++;
      else if (t.status === 'IN_PROGRESS') data.inProgress++;
      else if (t.status === 'DONE') data.done++;
      if (typeof isOverdue === 'function' && isOverdue(t.due_date, t.status)) data.overdue++;
    });
    return data;
  }

  function countByPriority(tasks) {
    const data = { high: 0, medium: 0, low: 0 };
    (tasks || []).forEach(t => {
      const p = (t.priority || 'MEDIUM').toLowerCase();
      if (p === 'HIGH') data.high++;
      else if (p === 'LOW') data.low++;
      else data.medium++;
    });
    return data;
  }

  function countOverdueByStatus(tasks) {
    const data = { todo: 0, inProgress: 0, done: 0 };
    (tasks || []).forEach(t => {
      if (typeof isOverdue !== 'function' || !isOverdue(t.due_date, t.status)) return;
      if (t.status === 'TODO') data.todo++;
      else if (t.status === 'IN_PROGRESS') data.inProgress++;
    });
    return { todo: data.todo, inProgress: data.inProgress, done: 0, overdue: 0 };
  }

  function update(tasks, stats, filter = 'all') {
    const titles = {
      all: 'Task distribution',
      TODO: 'Pending tasks',
      IN_PROGRESS: 'In progress',
      DONE: 'Completed',
      overdue: 'Overdue breakdown',
    };
    const centerLabels = {
      all: 'Total',
      TODO: 'Pending',
      IN_PROGRESS: 'Active',
      DONE: 'Done',
      overdue: 'Late',
    };

    const titleEl = document.getElementById('chart-title');
    const centerLabelEl = document.getElementById('chart-center-label');
    if (titleEl) titleEl.textContent = titles[filter] || 'Tasks';
    if (centerLabelEl) centerLabelEl.textContent = centerLabels[filter] || 'Total';

    showOverdueRing = filter === 'all';

    if (filter === 'all') {
      activeSlices = STATUS_SLICES;
      target = countByStatus(tasks);
    } else if (filter === 'overdue') {
      activeSlices = [
        { key: 'todo', label: 'Pending (late)', color: '#c084fc' },
        { key: 'inProgress', label: 'In progress (late)', color: '#38bdf8' },
        { key: 'done', label: '—', color: 'transparent' },
        { key: 'overdue', label: '', color: 'transparent' },
      ];
      const od = countOverdueByStatus(tasks);
      target = { todo: od.todo, inProgress: od.inProgress, done: 0, overdue: 0 };
    } else {
      activeSlices = PRIORITY_SLICES.map(s => ({ ...s, key: s.key }));
      const filtered = (tasks || []).filter(t => t.status === filter);
      const pr = countByPriority(filtered);
      target = { high: pr.high, medium: pr.medium, low: pr.low, overdue: 0 };
    }

    const total = Object.entries(target)
      .filter(([k]) => k !== 'overdue')
      .reduce((s, [, v]) => s + v, 0);

    const badge = document.getElementById('chart-total-badge');
    const center = document.getElementById('chart-center-value');
    if (badge) badge.textContent = `${total} task${total !== 1 ? 's' : ''}`;
    if (center) center.textContent = total;

    renderLegend(target, filter);
    animate();
  }

  function renderLegend(data, filter) {
    const el = document.getElementById('chart-legend');
    if (!el) return;

    const slices = filter === 'all' ? STATUS_SLICES
      : filter === 'overdue' ? activeSlices.filter(s => s.key !== 'done' && s.key !== 'overdue')
      : PRIORITY_SLICES;

    const total = slices.reduce((s, sl) => s + (data[sl.key] || 0), 0);

    el.innerHTML = slices
      .filter(s => s.color !== 'transparent')
      .map(s => {
        const val = data[s.key] || 0;
        const pct = total ? Math.round((val / total) * 100) : 0;
        return `
          <div class="chart-legend-item">
            <span class="chart-legend-dot" style="background:${s.color};box-shadow:0 0 10px ${s.color}"></span>
            <span class="chart-legend-label">${s.label}</span>
            <span class="chart-legend-value">${val} <em>(${pct}%)</em></span>
          </div>`;
      }).join('');
  }

  function animate() {
    if (animFrame) cancelAnimationFrame(animFrame);
    const keys = activeSlices.map(s => s.key);
    keys.forEach(k => {
      if (current[k] === undefined) current[k] = 0;
      if (target[k] === undefined) target[k] = 0;
    });

    const step = () => {
      let settled = true;
      keys.forEach(k => {
        const diff = (target[k] || 0) - (current[k] || 0);
        if (Math.abs(diff) > 0.01) {
          current[k] = (current[k] || 0) + diff * 0.2;
          settled = false;
        } else {
          current[k] = target[k] || 0;
        }
      });
      draw(current);
      if (!settled) animFrame = requestAnimationFrame(step);
    };
    animFrame = requestAnimationFrame(step);
  }

  function draw(data) {
    if (!ctx || !canvas) return;
    const size = canvas.width / (window.devicePixelRatio || 1);
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.38;
    const inner = size * 0.24;

    ctx.clearRect(0, 0, size, size);

    const segments = activeSlices
      .filter(s => s.color !== 'transparent')
      .map(s => ({ value: data[s.key] || 0, color: s.color }));

    const total = segments.reduce((s, x) => s + x.value, 0);

    if (total === 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(167, 139, 250, 0.15)';
      ctx.lineWidth = radius - inner;
      ctx.stroke();
      return;
    }

    let start = -Math.PI / 2;
    segments.forEach(seg => {
      if (seg.value <= 0) return;
      const angle = (seg.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, radius, start, start + angle);
      ctx.arc(cx, cy, inner, start + angle, start, true);
      ctx.closePath();
      ctx.fillStyle = seg.color;
      ctx.shadowColor = seg.color;
      ctx.shadowBlur = 14;
      ctx.fill();
      ctx.shadowBlur = 0;
      start += angle;
    });

    if (showOverdueRing && (data.overdue || 0) > 0) {
      ctx.beginPath();
      ctx.arc(cx, cy, radius + 4, 0, Math.PI * 2);
      ctx.strokeStyle = STATUS_SLICES[3].color;
      ctx.lineWidth = 3;
      ctx.setLineDash([5, 4]);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  document.addEventListener('DOMContentLoaded', init);

  return { update, countByStatus };
})();
