'use strict';

/* =============================
   CONSTANTS & STATE
============================= */
const SK = {
    TASKS: 'salvospace_tasks',
    THEME: 'salvospace_theme',
    ONBOARDED: 'salvospace_onboarded',
    SORT: 'salvospace_sort',
    SETTINGS: 'salvospace_settings',
};

const PRIO_WEIGHT = { high: 3, medium: 2, low: 1 };
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

let state = {
    tasks: [],
    filter: 'all',
    taskFilter: 'all',
    sort: 'default',
    search: '',
    charts: { bar: null, pie: null, line: null, donut: null },
    editingId: null,
    currentView: 'dashboard',
    reportPeriod: 'weekly',
    settings: {
        compactMode: false,
        animations: true,
        taskReminders: true,
        completionAlerts: true,
        dailySummary: false,
        autoSave: true,
        defaultPriority: 'medium',
        defaultTime: 'morning',
        name: 'Sagnik Mondal',
        role: 'Pro Member',
        initials: 'SM',
    },
};

/* =============================
   INIT
============================= */
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    initTheme();
    loadTasks();
    renderAll();
    setupEvents();
    setupKeys();
    initScrollReveal();
    setMeta();
    setCurrentTimePeriod();
    setTimeout(checkOnboard, 700);
    setTimeout(buildCharts, 400);
    renderInsights();
    renderReports();
    syncSettingsUI();
});

/* =============================
   THEME
============================= */
function initTheme() {
    const saved = ls(SK.THEME) || 'dark';
    doc().setAttribute('data-theme', saved);
    updateThemeUI(saved);
}

function toggleTheme() {
    const cur = doc().getAttribute('data-theme');
    const nxt = cur === 'dark' ? 'light' : 'dark';
    doc().setAttribute('data-theme', nxt);
    lss(SK.THEME, nxt);
    updateThemeUI(nxt);
    destroyCharts();
    setTimeout(buildCharts, 200);
    showToast(nxt === 'dark' ? '🌙 Dark mode' : '☀️ Light mode', 'info');
}

function updateThemeUI(theme) {
    const label = qs('#scThemeLabel');
    if (label) label.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
    const settingsToggle = qs('#settingsThemeToggle');
    if (settingsToggle) {
        settingsToggle.classList.toggle('active', theme === 'dark');
        settingsToggle.setAttribute('aria-checked', theme === 'dark');
    }
}

/* =============================
   SETTINGS
============================= */
function loadSettings() {
    try {
        const raw = ls(SK.SETTINGS);
        if (raw) state.settings = { ...state.settings, ...JSON.parse(raw) };
    } catch { }
}

function saveSettings() {
    lss(SK.SETTINGS, JSON.stringify(state.settings));
}

function syncSettingsUI() {
    qs('#settingsName') && (qs('#settingsName').value = state.settings.name);
    qs('#settingsRole') && (qs('#settingsRole').value = state.settings.role);
    qs('#settingsInitials') && (qs('#settingsInitials').value = state.settings.initials);
    qs('#defaultPriority') && (qs('#defaultPriority').value = state.settings.defaultPriority);
    qs('#defaultTime') && (qs('#defaultTime').value = state.settings.defaultTime);

    syncToggle('compactModeToggle', state.settings.compactMode);
    syncToggle('animationsToggle', state.settings.animations);
    syncToggle('taskRemindersToggle', state.settings.taskReminders);
    syncToggle('completionAlertsToggle', state.settings.completionAlerts);
    syncToggle('dailySummaryToggle', state.settings.dailySummary);
    syncToggle('autoSaveToggle', state.settings.autoSave);
    syncToggle('settingsThemeToggle', doc().getAttribute('data-theme') === 'dark');

    applyCompactMode();
}

function syncToggle(id, active) {
    const el = qs(`#${id}`);
    if (el) {
        el.classList.toggle('active', active);
        el.setAttribute('aria-checked', active);
    }
}

function applyCompactMode() {
    document.body.classList.toggle('compact', state.settings.compactMode);
}

/* =============================
   DATA / localStorage
============================= */
function loadTasks() {
    try {
        const raw = ls(SK.TASKS);
        state.tasks = raw ? JSON.parse(raw) : defaultTasks();
    } catch { state.tasks = defaultTasks(); }
    lss(SK.TASKS, JSON.stringify(state.tasks));
}

function saveTasks() { lss(SK.TASKS, JSON.stringify(state.tasks)); }

function defaultTasks() {
    return [
        { id: uid(), title: 'Review project roadmap', desc: 'Check milestones and deliverables', time: 'morning', priority: 'high', done: false, created: Date.now() },
        { id: uid(), title: 'Team standup call', desc: 'Daily sync with engineering', time: 'morning', priority: 'medium', done: true, created: Date.now() },
        { id: uid(), title: 'Write feature documentation', desc: '', time: 'afternoon', priority: 'high', done: false, created: Date.now() },
        { id: uid(), title: 'Reply to client emails', desc: 'Respond to 3 pending threads', time: 'afternoon', priority: 'medium', done: false, created: Date.now() },
        { id: uid(), title: 'Code review PR #142', desc: '', time: 'afternoon', priority: 'low', done: true, created: Date.now() },
        { id: uid(), title: 'Plan tomorrow tasks', desc: '', time: 'evening', priority: 'medium', done: false, created: Date.now() },
        { id: uid(), title: 'Read industry article', desc: '', time: 'evening', priority: 'low', done: false, created: Date.now() },
    ];
}

/* =============================
   TASK CRUD
============================= */
function addTask(title, desc, time, priority) {
    const task = { id: uid(), title: title.trim(), desc: desc.trim(), time, priority, done: false, created: Date.now() };
    state.tasks.unshift(task);
    saveTasks();
    renderAll();
    updateCharts();
    showToast('Task added!', 'success');
}

function updateTask(id, title, desc, time, priority) {
    const t = state.tasks.find(t => t.id === id);
    if (!t) return;
    t.title = title.trim(); t.desc = desc.trim(); t.time = time; t.priority = priority;
    saveTasks(); renderAll(); updateCharts();
    showToast('Task updated!', 'info');
}

function deleteTask(id) {
    const el = qs(`[data-id="${id}"]`);
    if (el) {
        el.style.transition = 'all .3s ease';
        el.style.opacity = '0';
        el.style.transform = 'translateX(20px)';
        setTimeout(() => { state.tasks = state.tasks.filter(t => t.id !== id); saveTasks(); renderAll(); updateCharts(); }, 280);
    } else {
        state.tasks = state.tasks.filter(t => t.id !== id); saveTasks(); renderAll(); updateCharts();
    }
    showToast('Task deleted', 'info');
}

function toggleDone(id) {
    const t = state.tasks.find(t => t.id === id);
    if (!t) return;
    t.done = !t.done;
    saveTasks(); renderAll(); updateCharts();
    if (t.done) showToast('🎉 Task complete!', 'success');
}

function clearDoneTasks() {
    const count = state.tasks.filter(t => t.done).length;
    if (!count) { showToast('No completed tasks to clear', 'info'); return; }
    state.tasks = state.tasks.filter(t => !t.done);
    saveTasks(); renderAll(); updateCharts();
    showToast(`🗑️ Cleared ${count} completed task${count > 1 ? 's' : ''}`, 'info');
}

/* =============================
   SORT / FILTER
============================= */
function getSortedTasks(tasks) {
    const arr = [...tasks];
    if (state.sort === 'priority') return arr.sort((a, b) => PRIO_WEIGHT[b.priority] - PRIO_WEIGHT[a.priority]);
    if (state.sort === 'time') { const o = { morning: 0, afternoon: 1, evening: 2 }; return arr.sort((a, b) => o[a.time] - o[b.time]); }
    if (state.sort === 'name') return arr.sort((a, b) => a.title.localeCompare(b.title));
    return arr;
}

function getFilteredTasks() {
    let arr = getSortedTasks(state.tasks);
    if (state.filter === 'pending') arr = arr.filter(t => !t.done);
    if (state.filter === 'done') arr = arr.filter(t => t.done);
    if (state.search) {
        const q = state.search.toLowerCase();
        arr = arr.filter(t => t.title.toLowerCase().includes(q) || t.desc.toLowerCase().includes(q));
    }
    return arr;
}

function getTaskPanelFiltered() {
    let arr = getSortedTasks(state.tasks);
    const f = state.taskFilter;
    if (f === 'pending') arr = arr.filter(t => !t.done);
    else if (f === 'done') arr = arr.filter(t => t.done);
    else if (f === 'high') arr = arr.filter(t => t.priority === 'high');
    else if (f === 'medium') arr = arr.filter(t => t.priority === 'medium');
    else if (f === 'low') arr = arr.filter(t => t.priority === 'low');
    return arr;
}

/* =============================
   PRODUCTIVITY SCORE
============================= */
function calcScore() {
    const total = state.tasks.length;
    if (total === 0) return { score: 0, completionPct: 0, highPrioPct: 0, morningPct: 0 };
    const done = state.tasks.filter(t => t.done);
    const completionPct = Math.round((done.length / total) * 100);
    const highTotal = state.tasks.filter(t => t.priority === 'high').length;
    const highDone = done.filter(t => t.priority === 'high').length;
    const highPrioPct = highTotal > 0 ? Math.round((highDone / highTotal) * 100) : 0;
    const morningTotal = state.tasks.filter(t => t.time === 'morning').length;
    const morningDone = done.filter(t => t.time === 'morning').length;
    const morningPct = morningTotal > 0 ? Math.round((morningDone / morningTotal) * 100) : 0;
    const score = Math.round(completionPct * 0.7 + highPrioPct * 0.2 + morningPct * 0.1);
    return { score, completionPct, highPrioPct, morningPct };
}

function scoreLabel(s) {
    if (s >= 90) return 'Highly Productive 🚀';
    if (s >= 70) return 'Good Progress 👍';
    if (s >= 40) return 'Keep Going ⚡';
    return 'Just Getting Started 🌱';
}

/* =============================
   RENDER MASTER
============================= */
function renderAll() {
    renderTaskGroups();
    renderTasksPanel();
    renderStats();
    renderScore();
    updateGlobalProgress();
    updateSidebarScore();
    updateNavBadge();
    renderInsights();
    if (state.currentView === 'reports') renderReports();
}

/* ---- Task Groups (Dashboard) ---- */
function renderTaskGroups() {
    const filtered = getFilteredTasks();
    ['morning', 'afternoon', 'evening'].forEach(period => {
        const tasks = filtered.filter(t => t.time === period);
        const container = qs(`#tasks-${period}`);
        const empty = qs(`#empty-${period}`);
        const cnt = qs(`#cnt-${period}`);
        if (cnt) cnt.textContent = tasks.length;
        if (!container) return;
        if (tasks.length === 0) { container.innerHTML = ''; if (empty) empty.style.display = 'block'; return; }
        if (empty) empty.style.display = 'none';
        container.innerHTML = tasks.map(t => renderTaskItem(t)).join('');
        attachTaskEvents(container);
    });
}

/* ---- Tasks Panel (My Tasks view) ---- */
function renderTasksPanel() {
    const list = qs('#tpList');
    if (!list) return;
    const filtered = getTaskPanelFiltered();

    const done = state.tasks.filter(t => t.done).length;
    const pending = state.tasks.filter(t => !t.done).length;
    const high = state.tasks.filter(t => t.priority === 'high').length;
    setText('tpTotal', state.tasks.length);
    setText('tpDone', done);
    setText('tpPending', pending);
    setText('tpHigh', high);

    if (filtered.length === 0) {
        list.innerHTML = `<div class="tp-empty">No tasks match this filter.<br>Try a different filter or add new tasks.</div>`;
        return;
    }
    list.innerHTML = filtered.map(t => renderTaskItem(t, true)).join('');
    attachTaskEvents(list);
}

function renderTaskItem(t, showTime = false) {
    const chk = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
    const pLabels = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };
    const timeBadge = showTime ? `<span class="prio-badge" style="background:var(--inp);color:var(--txt2);border-color:var(--border);text-transform:capitalize">${t.time}</span>` : '';
    return `
    <div class="task-item ${t.done ? 'done' : ''}" data-id="${t.id}">
      <button class="ti-check-btn ti-check" aria-label="Toggle complete">${chk}</button>
      <div class="ti-main">
        <span class="ti-title">${escHtml(t.title)}</span>
        ${t.desc ? `<span class="ti-desc">${escHtml(t.desc)}</span>` : ''}
      </div>
      <div class="ti-badges">
        ${timeBadge}
        <span class="prio-badge ${t.priority}">${pLabels[t.priority]}</span>
      </div>
      <div class="ti-actions">
        <button class="ti-act-btn ti-edit-btn" aria-label="Edit task">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="ti-act-btn del ti-del-btn" aria-label="Delete task">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>
        </button>
      </div>
    </div>`;
}

function attachTaskEvents(container) {
    container.querySelectorAll('.ti-check-btn').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); toggleDone(btn.closest('.task-item').dataset.id); });
    });
    container.querySelectorAll('.ti-edit-btn').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); openEditModal(btn.closest('.task-item').dataset.id); });
    });
    container.querySelectorAll('.ti-del-btn').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); deleteTask(btn.closest('.task-item').dataset.id); });
    });
}

/* ---- Stats ---- */
function renderStats() {
    const total = state.tasks.length;
    const done = state.tasks.filter(t => t.done).length;
    const { score } = calcScore();
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    setText('statTotal', total);
    setText('statDone', done);
    setText('statDoneSub', `${pct}% completion rate`);
    setText('statPending', total - done);
    setText('statScore', score);
}

/* ---- Score Section ---- */
function renderScore() {
    const { score, completionPct, highPrioPct, morningPct } = calcScore();
    const circumference = 2 * Math.PI * 66;
    const fill = qs('#scoreRingFill');
    if (fill) {
        fill.style.strokeDashoffset = circumference - (score / 100) * circumference;
        fill.setAttribute('stroke-dasharray', circumference);
    }
    setText('scoreBig', score);
    setText('scoreBadge', scoreLabel(score));
    setText('sbiCompletion', `${completionPct}%`);
    setText('sbiHighPrio', `${highPrioPct}%`);
    setText('sbiMorning', `${morningPct}%`);
    setWidth('compFill', completionPct);
    setWidth('highFill', highPrioPct);
    setWidth('mornFill', morningPct);
}

/* ---- Global Progress Bar ---- */
function updateGlobalProgress() {
    const total = state.tasks.length;
    const done = state.tasks.filter(t => t.done).length;
    setWidth('globalProgressFill', total === 0 ? 0 : Math.round((done / total) * 100));
}

/* ---- Sidebar Score (mini ring) ---- */
function updateSidebarScore() {
    const { score } = calcScore();
    // Main sidebar card
    setText('sidebarScore', score || '—');
    setWidth('sidebarScoreBar', score);
    setText('sidebarScoreStatus', score === 0 ? 'Add tasks to start' : scoreLabel(score));
    // Top controls ring
    setText('scpNum', score);
    setText('scpStatus', score === 0 ? 'Add tasks' : scoreLabel(score).split(' ').slice(0, 2).join(' '));
    // Mini ring circle (circumference of r=16 circle: 2π×16 ≈ 100.5)
    const circ = 100.5;
    const circle = qs('#scpCircle');
    if (circle) circle.style.strokeDashoffset = circ - (score / 100) * circ;
}

/* ---- Nav Badge ---- */
function updateNavBadge() {
    const pending = state.tasks.filter(t => !t.done).length;
    const badge = qs('#snavBadge');
    if (badge) { badge.textContent = pending; badge.style.display = pending > 0 ? 'inline' : 'none'; }
}

/* =============================
   AI INSIGHTS — Image 2 Style
============================= */
function generateInsightsData() {
    const total = state.tasks.length;
    const done = state.tasks.filter(t => t.done);
    const pending = state.tasks.filter(t => !t.done);
    const pct = total > 0 ? Math.round((done.length / total) * 100) : 0;

    const morningDone = done.filter(t => t.time === 'morning').length;
    const afternoonDone = done.filter(t => t.time === 'afternoon').length;
    const eveningDone = done.filter(t => t.time === 'evening').length;
    const topPeriodArr = [['Morning', morningDone, '🌅'], ['Afternoon', afternoonDone, '☀️'], ['Evening', eveningDone, '🌙']].sort((a, b) => b[1] - a[1]);
    const topPeriod = topPeriodArr[0];

    const highPending = pending.filter(t => t.priority === 'high').length;
    const highDone = done.filter(t => t.priority === 'high').length;
    const highTotal = state.tasks.filter(t => t.priority === 'high').length;
    const highPct = highTotal > 0 ? Math.round((highDone / highTotal) * 100) : 0;

    const biggestPending = pending.sort((a, b) => PRIO_WEIGHT[b.priority] - PRIO_WEIGHT[a.priority])[0];

    // Avg priority score
    const avgPrio = total > 0 ? (state.tasks.reduce((s, t) => s + PRIO_WEIGHT[t.priority], 0) / total).toFixed(1) : '0';

    return [
        {
            label: 'COMPLETION RATE',
            value: `${pct}%`,
            sub: pct >= 80 ? 'Excellent! You\'re in top-performer territory.' : pct >= 50 ? 'Good progress. Push a few more tasks to completion.' : 'Room to grow. Break tasks into smaller steps to build momentum.',
            color: pct >= 70 ? 'green' : pct >= 40 ? 'amber' : 'red',
        },
        {
            label: 'TOP PERIOD',
            value: `${topPeriod[2]} ${topPeriod[0]}`,
            sub: topPeriod[1] > 0 ? `${topPeriod[1]} task${topPeriod[1] > 1 ? 's' : ''} completed during this window. Schedule deep work here.` : 'No tasks completed yet. Start with your morning tasks.',
            color: 'cyan',
        },
        {
            label: 'TASK VOLUME',
            value: `${total}`,
            sub: `${done.length} completed · ${pending.length} pending this session.`,
            color: total > 8 ? 'amber' : 'blue',
        },
        {
            label: 'HIGH PRIORITY DONE',
            value: `${highDone} / ${highTotal}`,
            sub: highPct >= 70 ? 'Great prioritization! High-impact work is getting done.' : highPending > 0 ? `${highPending} high-priority task${highPending > 1 ? 's' : ''} still pending. Tackle these first.` : 'No high-priority tasks. Consider adding some.',
            color: highPct >= 70 ? 'green' : 'red',
        },
        {
            label: 'AVG PRIORITY SCORE',
            value: `${avgPrio} / 3`,
            sub: 'Average weight across all tasks. Higher = more demanding workload.',
            color: parseFloat(avgPrio) >= 2 ? 'amber' : 'blue',
        },
        {
            label: 'BIGGEST PENDING TASK',
            value: biggestPending ? escHtml(biggestPending.title.length > 24 ? biggestPending.title.slice(0, 24) + '…' : biggestPending.title) : 'None',
            sub: biggestPending ? `Priority: ${biggestPending.priority} · ${biggestPending.time}` : 'All tasks completed! 🎉',
            color: biggestPending ? (biggestPending.priority === 'high' ? 'red' : 'amber') : 'green',
        },
    ];
}

function renderInsights() {
    const list = qs('#insightsList');
    if (!list) return;
    const items = generateInsightsData();
    list.innerHTML = items.map((item, i) => `
    <div class="insight-item" style="animation-delay:${i * .07}s">
      <div class="ii-label">${item.label}</div>
      <div class="ii-value ${item.color}">${item.value}</div>
      <div class="ii-sub">${item.sub}</div>
    </div>`).join('');
}

/* =============================
   REPORTS PANEL
============================= */
function renderReports() {
    const container = qs('#reportsContent');
    if (!container) return;

    const period = state.reportPeriod;
    const total = state.tasks.length;
    const done = state.tasks.filter(t => t.done).length;
    const { score } = calcScore();
    const highDone = state.tasks.filter(t => t.done && t.priority === 'high').length;

    // Generate day/week data
    const today = new Date();
    const isWeekly = period === 'weekly';
    const labels = isWeekly
        ? Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() - (6 - i)); return DAYS[d.getDay()]; })
        : ['Week 1', 'Week 2', 'Week 3', 'Week 4'];

    // Mock productivity values (seeded from real score)
    const base = score;
    const trend = labels.map((_, i) => {
        const noise = Math.floor(Math.random() * 30) - 10;
        return Math.max(0, Math.min(100, Math.round(base * 0.7 + noise + (i / labels.length) * 20)));
    });
    // Today / this week is actual score
    trend[trend.length - 1] = score;
    const maxTrend = Math.max(...trend, 1);

    container.innerHTML = `
    <div class="reports-summary">
      <div class="rs-card rsc-blue">
        <div class="rs-label">TOTAL TASKS</div>
        <div class="rs-value">${total}</div>
        <div class="rs-sub">${isWeekly ? 'This week' : 'This month'}</div>
      </div>
      <div class="rs-card rsc-green">
        <div class="rs-label">COMPLETED</div>
        <div class="rs-value">${done}</div>
        <div class="rs-sub">${total > 0 ? Math.round((done / total) * 100) : 0}% completion rate</div>
      </div>
      <div class="rs-card rsc-amber">
        <div class="rs-label">TOP SCORE</div>
        <div class="rs-value">${Math.max(...trend)}</div>
        <div class="rs-sub">pts · ${isWeekly ? 'best day' : 'best week'}</div>
      </div>
      <div class="rs-card rsc-red">
        <div class="rs-label">HIGH PRIO DONE</div>
        <div class="rs-value">${highDone}</div>
        <div class="rs-sub">High priority tasks</div>
      </div>
    </div>

    <div class="reports-body">
      <div class="report-panel-card">
        <h4>📈 ${isWeekly ? 'Daily' : 'Weekly'} Productivity Trend</h4>
        <div class="report-days-grid">
          ${labels.map((lbl, i) => `
            <div class="report-day-row">
              <span class="rdr-day">${lbl}</span>
              <div class="rdr-bar-track">
                <div class="rdr-bar-fill" style="width:${Math.round((trend[i] / maxTrend) * 100)}%"></div>
              </div>
              <span class="rdr-val">${trend[i]}</span>
            </div>`).join('')}
        </div>
      </div>

      <div class="report-panel-card">
        <h4>📋 ${isWeekly ? 'This Week\'s' : 'This Month\'s'} Tasks</h4>
        <div class="report-task-list">
          ${state.tasks.length === 0
            ? '<div style="padding:20px;text-align:center;color:var(--txt3);font-size:.82rem">No tasks to report.</div>'
            : state.tasks.map(t => `
            <div class="rtli ${t.done ? 'done' : ''}">
              <div class="rtl-check">${t.done ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>
              <span style="flex:1;font-size:.8rem">${escHtml(t.title)}</span>
              <span class="prio-badge ${t.priority}" style="font-size:.62rem">${t.priority}</span>
              <span style="font-size:.72rem;color:var(--txt3);text-transform:capitalize">${t.time}</span>
            </div>`).join('')}
        </div>
      </div>

      <div class="report-panel-card" style="grid-column:1/-1">
        <h4>📊 ${isWeekly ? 'Weekly' : 'Monthly'} Summary</h4>
        <p style="font-size:.83rem;color:var(--txt2);line-height:1.8">
          ${scoreLabel(score)} — Your current productivity score is <strong style="color:var(--pri)">${score}/100</strong>.
          ${done} out of ${total} tasks have been completed, giving a <strong>${total > 0 ? Math.round((done / total) * 100) : 0}%</strong> completion rate.
          ${highDone > 0 ? `You've completed <strong>${highDone}</strong> high-priority task${highDone > 1 ? 's' : ''}, demonstrating excellent prioritization.` : ''}
          ${score >= 70 ? '🚀 You\'re performing at a high level — keep the momentum going!' : score >= 40 ? '⚡ Good work so far. Prioritize your pending tasks to boost your score.' : '🌱 Just getting started. Try completing your morning tasks first to build a streak.'}
        </p>
      </div>
    </div>`;
}

/* =============================
   VIEW PANEL SWITCHING
============================= */
function handleView(view) {
    state.currentView = view;

    // Hide all panels
    qsa('.view-panel').forEach(p => p.classList.remove('active'));

    // Show target panel
    const panel = qs(`#view-${view}`);
    if (panel) {
        panel.classList.add('active');
        // Re-trigger scroll reveal for new panel
        panel.querySelectorAll('.reveal:not(.in)').forEach((el, i) => {
            setTimeout(() => el.classList.add('in'), i * 80);
        });
    }

    // Build charts when analytics is shown
    if (view === 'analytics') {
        setTimeout(() => { destroyCharts(); buildCharts(); }, 150);
    }

    // Render reports when reports panel is shown
    if (view === 'reports') renderReports();

    // Sync settings UI
    if (view === 'settings') syncSettingsUI();

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* =============================
   CHARTS
============================= */
function getChartColors() {
    const isDark = doc().getAttribute('data-theme') === 'dark';
    return {
        grid: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
        tick: isDark ? '#94A3B8' : '#475569',
        text: isDark ? '#E2E8F0' : '#0F172A',
    };
}

function chartDefaults() {
    const c = getChartColors();
    return {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 800, easing: 'easeInOutQuart' },
        plugins: {
            legend: { labels: { color: c.text, font: { family: 'Poppins', size: 12 }, padding: 14, usePointStyle: true } },
            tooltip: { titleFont: { family: 'Poppins', weight: '600' }, bodyFont: { family: 'Poppins' }, cornerRadius: 10, padding: 10 },
        },
        scales: {
            x: { grid: { color: c.grid }, ticks: { color: c.tick, font: { family: 'Poppins', size: 11 } } },
            y: { grid: { color: c.grid }, ticks: { color: c.tick, font: { family: 'Poppins', size: 11 } } },
        },
    };
}

function noScaleDefaults() {
    const c = getChartColors();
    return {
        responsive: true, maintainAspectRatio: false,
        animation: { duration: 900, easing: 'easeInOutQuart' },
        plugins: {
            legend: { position: 'bottom', labels: { color: c.text, font: { family: 'Poppins', size: 11 }, padding: 12, usePointStyle: true } },
            tooltip: { titleFont: { family: 'Poppins', weight: '600' }, bodyFont: { family: 'Poppins' }, cornerRadius: 10, padding: 10 },
        },
    };
}

function buildCharts() {
    buildBarChart(); buildPieChart(); buildLineChart(); buildDoughnutChart();
}

function destroyCharts() {
    Object.values(state.charts).forEach(c => { if (c) c.destroy(); });
    state.charts = { bar: null, pie: null, line: null, donut: null };
}

function updateCharts() { destroyCharts(); setTimeout(buildCharts, 50); }

function buildBarChart() {
    const ctx = qs('#barChart'); if (!ctx) return;
    const periods = ['Morning', 'Afternoon', 'Evening'];
    const completed = periods.map((_, i) => state.tasks.filter(t => t.time == ['morning', 'afternoon', 'evening'][i] && t.done).length);
    const pending = periods.map((_, i) => state.tasks.filter(t => t.time == ['morning', 'afternoon', 'evening'][i] && !t.done).length);
    const opts = chartDefaults(); opts.scales.y.beginAtZero = true; opts.scales.y.ticks.stepSize = 1;
    state.charts.bar = new Chart(ctx, {
        type: 'bar', data: {
            labels: periods, datasets: [
                { label: 'Completed', data: completed, backgroundColor: 'rgba(29,78,216,0.75)', borderColor: '#1D4ED8', borderWidth: 2, borderRadius: 8, borderSkipped: false },
                { label: 'Pending', data: pending, backgroundColor: 'rgba(148,163,184,0.35)', borderColor: '#94A3B8', borderWidth: 2, borderRadius: 8, borderSkipped: false },
            ]
        }, options: opts
    });
}

function buildPieChart() {
    const ctx = qs('#pieChart'); if (!ctx) return;
    const high = state.tasks.filter(t => t.priority === 'high').length;
    const med = state.tasks.filter(t => t.priority === 'medium').length;
    const low = state.tasks.filter(t => t.priority === 'low').length;
    state.charts.pie = new Chart(ctx, {
        type: 'pie', data: {
            labels: ['High', 'Medium', 'Low'], datasets: [{
                data: [high || 0, med || 0, low || 0],
                backgroundColor: ['rgba(239,68,68,0.8)', 'rgba(245,158,11,0.8)', 'rgba(16,185,129,0.8)'],
                borderColor: ['#EF4444', '#F59E0B', '#10B981'], borderWidth: 2, hoverOffset: 6,
            }]
        }, options: noScaleDefaults()
    });
}

function buildLineChart() {
    const ctx = qs('#lineChart'); if (!ctx) return;
    const today = new Date();
    const labels = Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(d.getDate() - (6 - i)); return DAYS[d.getDay()]; });
    const { score } = calcScore();
    const productivity = labels.map((_, i) => Math.round(40 + Math.random() * 30 + (i / 6) * score * 0.5));
    productivity[productivity.length - 1] = score;
    const goal = labels.map(() => 80);
    const opts = chartDefaults(); opts.scales.y.min = 0; opts.scales.y.max = 100;
    opts.elements = { point: { radius: 5, hoverRadius: 7, borderWidth: 2 }, line: { tension: 0.45, borderWidth: 2.5 } };
    state.charts.line = new Chart(ctx, {
        type: 'line', data: {
            labels, datasets: [
                { label: 'Productivity', data: productivity, borderColor: '#2563EB', backgroundColor: 'rgba(37,99,235,0.1)', fill: true, pointBackgroundColor: '#2563EB' },
                { label: 'Goal', data: goal, borderColor: '#10B981', borderDash: [6, 4], backgroundColor: 'transparent', pointRadius: 0 },
            ]
        }, options: opts
    });
}

function buildDoughnutChart() {
    const ctx = qs('#doughnutChart'); if (!ctx) return;
    const done = state.tasks.filter(t => t.done).length;
    const pending = state.tasks.filter(t => !t.done).length;
    const total = done + pending;
    const opts = noScaleDefaults(); opts.cutout = '70%';
    state.charts.donut = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Done', 'Pending'], datasets: [{
                data: [done || 0, pending || (total === 0 ? 1 : 0)],
                backgroundColor: ['rgba(29,78,216,0.85)', 'rgba(148,163,184,0.2)'],
                borderColor: ['#1D4ED8', 'transparent'], borderWidth: 2, hoverOffset: 4,
            }]
        },
        options: opts,
        plugins: [{
            id: 'centerLabel', afterDraw(chart) {
                const { ctx: c, chartArea: { left, top, right, bottom } } = chart;
                const cx = (left + right) / 2, cy = (top + bottom) / 2;
                const pct = total === 0 ? 0 : Math.round((done / total) * 100);
                c.save();
                c.font = `800 1.5rem Host Grotesk,Poppins,sans-serif`;
                c.fillStyle = getChartColors().text; c.textAlign = 'center'; c.textBaseline = 'middle';
                c.fillText(`${pct}%`, cx, cy - 8);
                c.font = `400 .72rem Poppins,sans-serif`;
                c.fillStyle = getChartColors().tick;
                c.fillText('complete', cx, cy + 14); c.restore();
            }
        }],
    });
}

/* =============================
   SEARCH RESULTS
============================= */
function renderSearchResults(q) {
    const box = qs('#searchResults'); if (!box) return;
    if (!q) { box.classList.remove('open'); box.innerHTML = ''; return; }
    const results = state.tasks.filter(t => t.title.toLowerCase().includes(q.toLowerCase()) || t.desc.toLowerCase().includes(q.toLowerCase())).slice(0, 6);
    if (results.length === 0) { box.innerHTML = `<div class="sr-empty">No tasks found for "${escHtml(q)}"</div>`; box.classList.add('open'); return; }
    box.innerHTML = results.map(t => `
    <div class="sr-item" data-id="${t.id}">
      <span>${t.done ? '✅' : '⬜'}</span>
      <span style="flex:1">${escHtml(t.title)}</span>
      <span class="prio-badge ${t.priority}" style="font-size:.6rem;padding:1px 6px">${t.priority}</span>
    </div>`).join('');
    box.classList.add('open');
    box.querySelectorAll('.sr-item').forEach(item => {
        item.addEventListener('click', () => { toggleDone(item.dataset.id); box.classList.remove('open'); qs('#searchInput').value = ''; });
    });
}

/* =============================
   MODALS
============================= */
function openAddModal() {
    // Apply defaults from settings
    const mp = qs('#mPriority'), mt = qs('#mTime');
    if (mp) mp.value = state.settings.defaultPriority;
    if (mt) mt.value = state.settings.defaultTime;
    qs('#addModal').classList.add('open');
    setTimeout(() => qs('#mTitle')?.focus(), 100);
}
function closeAddModal() {
    qs('#addModal').classList.remove('open');
    qs('#mTitle').value = ''; qs('#mDesc').value = '';
    qs('#mTime').value = state.settings.defaultTime || 'morning';
    qs('#mPriority').value = state.settings.defaultPriority || 'high';
}

function openEditModal(id) {
    const t = state.tasks.find(t => t.id === id); if (!t) return;
    state.editingId = id;
    qs('#editId').value = id; qs('#eTitle').value = t.title; qs('#eDesc').value = t.desc;
    qs('#eTime').value = t.time; qs('#ePriority').value = t.priority;
    qs('#editModal').classList.add('open');
    setTimeout(() => qs('#eTitle')?.focus(), 100);
}
function closeEditModal() { qs('#editModal').classList.remove('open'); state.editingId = null; }

function handleAddTask() {
    const title = qs('#mTitle').value.trim();
    if (!title) { shakeEl(qs('#mTitle')); showToast('⚠️ Title required', 'error'); return; }
    addTask(title, qs('#mDesc').value, qs('#mTime').value, qs('#mPriority').value);
    closeAddModal();
}

function handleEditTask() {
    const title = qs('#eTitle').value.trim();
    if (!title) { shakeEl(qs('#eTitle')); showToast('⚠️ Title required', 'error'); return; }
    updateTask(state.editingId, title, qs('#eDesc').value, qs('#eTime').value, qs('#ePriority').value);
    closeEditModal();
}

/* =============================
   WEEKLY REPORT MODAL
============================= */
function openWeeklyReport() {
    const total = state.tasks.length, done = state.tasks.filter(t => t.done).length;
    const { score } = calcScore(), highDone = state.tasks.filter(t => t.done && t.priority === 'high').length;
    const body = qs('#reportBody'); if (!body) return;
    body.innerHTML = `
    <div class="report-meta">
      <div class="report-meta-item"><span class="rmi-val">${total}</span><span class="rmi-lbl">Total</span></div>
      <div class="report-meta-item"><span class="rmi-val">${done}</span><span class="rmi-lbl">Completed</span></div>
      <div class="report-meta-item"><span class="rmi-val">${total - done}</span><span class="rmi-lbl">Pending</span></div>
      <div class="report-meta-item"><span class="rmi-val">${score}</span><span class="rmi-lbl">Score</span></div>
      <div class="report-meta-item"><span class="rmi-val">${highDone}</span><span class="rmi-lbl">High Done</span></div>
    </div>
    <div class="report-section">
      <h4>📊 Summary</h4>
      <p style="font-size:.82rem;color:var(--txt2);line-height:1.7;margin-bottom:12px">
        ${scoreLabel(score)} — Score <strong>${score}/100</strong>. 
        ${score >= 70 ? 'Excellent work! Maintain this output.' : 'Room to improve. Try tackling high-priority items first.'}
      </p>
    </div>
    <div class="report-section">
      <h4>📋 All Tasks</h4>
      <div class="report-task-list">
        ${state.tasks.map(t => `
          <div class="rtli ${t.done ? 'done' : ''}">
            <div class="rtl-check">${t.done ? '<svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>' : ''}</div>
            <span style="flex:1;font-size:.8rem">${escHtml(t.title)}</span>
            <span class="prio-badge ${t.priority}" style="font-size:.62rem">${t.priority}</span>
            <span style="font-size:.72rem;color:var(--txt3);text-transform:capitalize">${t.time}</span>
          </div>`).join('')}
      </div>
    </div>`;
    qs('#reportModal').classList.add('open');
}

/* =============================
   EXPORT
============================= */
function exportCharts() {
    showToast('📸 Preparing export…', 'info');
    setTimeout(() => {
        const firstChart = Object.values(state.charts).find(Boolean);
        if (!firstChart) { showToast('No charts to export', 'error'); return; }
        try {
            const a = document.createElement('a');
            a.href = firstChart.toBase64Image();
            a.download = `salvospace-${new Date().toISOString().slice(0, 10)}.png`;
            a.click();
            showToast('✅ Chart exported!', 'success');
        } catch { showToast('Export failed — try again', 'error'); }
    }, 400);
}

/* =============================
   ONBOARDING
============================= */
function checkOnboard() { if (!ls(SK.ONBOARDED)) qs('#onboardModal')?.classList.add('open'); }
function closeOnboard() { qs('#onboardModal')?.classList.remove('open'); lss(SK.ONBOARDED, '1'); }

/* =============================
   TOASTS
============================= */
function showToast(msg, type = 'info') {
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    const container = qs('#toastContainer'); if (!container) return;
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.innerHTML = `<span>${icons[type]}</span><span>${msg}</span>`;
    container.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 220); }, 3000);
}

/* =============================
   SCROLL REVEAL
============================= */
function initScrollReveal() {
    const obs = new IntersectionObserver((entries) => {
        entries.forEach((e, i) => { if (e.isIntersecting) { setTimeout(() => e.target.classList.add('in'), i * 70); obs.unobserve(e.target); } });
    }, { threshold: 0.06 });
    qsa('.reveal').forEach(el => obs.observe(el));
}

/* =============================
   META / HELPERS
============================= */
function setMeta() {
    const d = qs('#heroDate');
    if (d) d.textContent = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const h = qs('#heroTitle');
    if (h) { const hr = new Date().getHours(); if (hr >= 12 && hr < 17) h.textContent = 'Good afternoon, Sagnik! ☀️'; else if (hr >= 17) h.textContent = 'Good evening, Sagnik! 🌙'; }
}

function setCurrentTimePeriod() {
    const hr = new Date().getHours();
    let period = 'morning';
    if (hr >= 12 && hr < 18) period = 'afternoon';
    else if (hr >= 18) period = 'evening';
    qs(`#tg-${period}`)?.classList.add('active-period');
}

/* =============================
   SIDEBAR
============================= */
function openSidebar() { qs('#sidebar')?.classList.add('open'); qs('#sidebarVeil')?.classList.add('on'); document.body.style.overflow = 'hidden'; }
function closeSidebar() { qs('#sidebar')?.classList.remove('open'); qs('#sidebarVeil')?.classList.remove('on'); document.body.style.overflow = ''; }

/* =============================
   EVENTS
============================= */
function setupEvents() {
    // FAB
    qs('#fabBtn')?.addEventListener('click', e => { openAddModal(); addRipple(e.currentTarget, e); });

    // Add modal
    qs('#mSaveBtn')?.addEventListener('click', handleAddTask);
    qs('#modalXBtn')?.addEventListener('click', closeAddModal);
    qs('#mCancelBtn')?.addEventListener('click', closeAddModal);
    qs('#addModal')?.addEventListener('click', e => { if (e.target === qs('#addModal')) closeAddModal(); });
    qs('#mTitle')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleAddTask(); });

    // Edit modal
    qs('#eUpdateBtn')?.addEventListener('click', handleEditTask);
    qs('#editXBtn')?.addEventListener('click', closeEditModal);
    qs('#eCancelBtn')?.addEventListener('click', closeEditModal);
    qs('#editModal')?.addEventListener('click', e => { if (e.target === qs('#editModal')) closeEditModal(); });
    qs('#eTitle')?.addEventListener('keydown', e => { if (e.key === 'Enter') handleEditTask(); });

    // Report modal
    qs('#weeklyReportBtn')?.addEventListener('click', openWeeklyReport);
    qs('#reportXBtn')?.addEventListener('click', () => qs('#reportModal')?.classList.remove('open'));
    qs('#reportModal')?.addEventListener('click', e => { if (e.target === qs('#reportModal')) qs('#reportModal').classList.remove('open'); });

    // Onboarding
    qs('#obStartBtn')?.addEventListener('click', closeOnboard);
    qs('#onboardModal')?.addEventListener('click', e => { if (e.target === qs('#onboardModal')) closeOnboard(); });

    // Theme (topbar)
    qs('#themeBtn')?.addEventListener('click', toggleTheme);
    // Theme (sidebar)
    qs('#scThemeBtn')?.addEventListener('click', toggleTheme);

    // Sidebar
    qs('#burgerBtn')?.addEventListener('click', openSidebar);
    qs('#sidebarX')?.addEventListener('click', closeSidebar);
    qs('#sidebarVeil')?.addEventListener('click', closeSidebar);

    // Nav
    qsa('.snav-link').forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            qsa('.snav-link').forEach(l => l.classList.remove('active'));
            link.classList.add('active');
            handleView(link.dataset.view);
            if (window.innerWidth <= 900) closeSidebar();
        });
    });

    // Dashboard filters
    qsa('.filter-pill[data-f]').forEach(p => {
        p.addEventListener('click', () => {
            qsa('.filter-pill[data-f]').forEach(x => x.classList.remove('active'));
            p.classList.add('active'); state.filter = p.dataset.f; renderTaskGroups();
        });
    });

    // Task panel filters
    qsa('.filter-pill[data-tf]').forEach(p => {
        p.addEventListener('click', () => {
            qsa('.filter-pill[data-tf]').forEach(x => x.classList.remove('active'));
            p.classList.add('active'); state.taskFilter = p.dataset.tf; renderTasksPanel();
        });
    });

    // Clear done tasks
    qs('#clearDoneTasks')?.addEventListener('click', () => { clearDoneTasks(); });

    // Add task button in tasks panel
    qs('#addTaskBtnTasks')?.addEventListener('click', () => openAddModal());

    // Search
    qs('#searchInput')?.addEventListener('input', e => { state.search = e.target.value; renderSearchResults(state.search); renderTaskGroups(); });
    document.addEventListener('click', e => { if (!qs('#searchInput')?.contains(e.target) && !qs('#searchResults')?.contains(e.target)) qs('#searchResults')?.classList.remove('open'); });

    // Sort
    qs('#sortBtn')?.addEventListener('click', e => { e.stopPropagation(); qs('#sortDropdown')?.classList.toggle('open'); });
    qsa('.sort-opt').forEach(opt => {
        opt.addEventListener('click', () => { state.sort = opt.dataset.sort; lss(SK.SORT, state.sort); qs('#sortDropdown')?.classList.remove('open'); renderTaskGroups(); showToast(`Sorted by ${opt.dataset.sort}`, 'info'); });
    });
    document.addEventListener('click', e => { if (!qs('#sortBtn')?.contains(e.target) && !qs('#sortDropdown')?.contains(e.target)) qs('#sortDropdown')?.classList.remove('open'); });

    // Insights refresh
    qs('#refreshInsightsBtn')?.addEventListener('click', () => {
        const list = qs('#insightsList');
        if (list) { list.style.opacity = '0'; list.style.transition = 'opacity .3s'; }
        setTimeout(() => { renderInsights(); if (list) { list.style.opacity = '1'; } showToast('🤖 Insights refreshed', 'info'); }, 300);
    });

    // Export
    qs('#exportBtn')?.addEventListener('click', exportCharts);

    // Reports tabs
    qsa('.rtab').forEach(tab => {
        tab.addEventListener('click', () => {
            qsa('.rtab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            state.reportPeriod = tab.dataset.rperiod;
            renderReports();
        });
    });

    // Settings toggles
    setupToggle('settingsThemeToggle', () => toggleTheme());
    setupToggle('compactModeToggle', (on) => { state.settings.compactMode = on; applyCompactMode(); saveSettings(); });
    setupToggle(
        'animationsToggle', (on) => { state.settings.animations = on; saveSettings(); }
    );
    setupToggle('taskRemindersToggle', (on) => { state.settings.taskReminders = on; saveSettings(); });
    setupToggle('completionAlertsToggle', (on) => { state.settings.completionAlerts = on; saveSettings(); });
    setupToggle('dailySummaryToggle', (on) => { state.settings.dailySummary = on; saveSettings(); });
    setupToggle('autoSaveToggle', (on) => { state.settings.autoSave = on; saveSettings(); });

    // Settings save buttons
    qs('#saveProfileBtn')?.addEventListener('click', () => {
        state.settings.name = qs('#settingsName')?.value || 'Sagnik Mondal';
        state.settings.role = qs('#settingsRole')?.value || 'Pro Member';
        state.settings.initials = qs('#settingsInitials')?.value.slice(0, 2).toUpperCase() || 'SM';
        saveSettings();
        showToast('Profile saved!', 'success');
    });
    qs('#saveDefaultsBtn')?.addEventListener('click', () => {
        state.settings.defaultPriority = qs('#defaultPriority')?.value || 'medium';
        state.settings.defaultTime = qs('#defaultTime')?.value || 'morning';
        saveSettings();
        showToast('Defaults saved!', 'success');
    });

    // Danger buttons
    qs('#clearTasksBtn')?.addEventListener('click', () => {
        if (confirm('Clear ALL tasks? This cannot be undone.')) {
            state.tasks = []; saveTasks(); renderAll(); updateCharts();
            showToast('All tasks cleared', 'info');
        }
    });
    qs('#resetAppBtn')?.addEventListener('click', () => {
        if (confirm('Reset the entire app? All data will be lost.')) {
            localStorage.clear(); location.reload();
        }
    });

    // Scroll to top
    window.addEventListener('scroll', () => { const btn = qs('#scrollTopBtn'); if (btn) btn.classList.toggle('visible', window.scrollY > 300); });
    qs('#scrollTopBtn')?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

    // Ripple
    qsa('.msave,.mcancel,.weekly-report-btn,.export-btn').forEach(btn => { btn.addEventListener('click', e => addRipple(btn, e)); });

    // Resize
    let rt;
    window.addEventListener('resize', () => {
        clearTimeout(rt); rt = setTimeout(() => { if (state.currentView === 'analytics') { destroyCharts(); buildCharts(); } }, 300);
        if (window.innerWidth > 900) closeSidebar();
    });
}

function setupToggle(id, callback) {
    const el = qs(`#${id}`); if (!el) return;
    el.addEventListener('click', () => {
        const isActive = el.classList.toggle('active');
        el.setAttribute('aria-checked', isActive);
        callback(isActive);
    });
}

/* =============================
   KEYBOARD SHORTCUTS
============================= */
function setupKeys() {
    document.addEventListener('keydown', e => {
        const tag = document.activeElement.tagName;
        const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(tag);
        if (e.key === 'a' && !typing && !e.ctrlKey && !e.metaKey) { openAddModal(); return; }
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); qs('#searchInput')?.focus(); return; }
        if (e.key === 'Escape') { closeAddModal(); closeEditModal(); qs('#reportModal')?.classList.remove('open'); closeOnboard(); qs('#searchResults')?.classList.remove('open'); }
    });
}

/* =============================
   UTILS
============================= */
function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return document.querySelectorAll(sel); }
function doc() { return document.documentElement; }
function ls(k) {
    try {
        return localStorage.getItem(k);
    } catch { return null; }
}
function lss(k, v) {
    try { localStorage.setItem(k, v); } catch { }
}
function uid() {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}
function escHtml(s) {
    const d = document.createElement('div'); d.textContent = s; return d.innerHTML;
}
function setText(id, val) {
    const el = qs(`#${id}`); if (el) el.textContent = val;
}
function setWidth(id, pct) {
    const el = qs(`#${id}`); if (el) el.style.width = `${Math.min(100, Math.max(0, pct))}%`;
}

function shakeEl(el) {
    if (!el) return;
    el.style.border = '1px solid #EF4444';
    el.style.boxShadow = '0 0 0 3px rgba(239,68,68,.15)';
    setTimeout(() => { el.style.border = ''; el.style.boxShadow = ''; }, 1500);
}

function addRipple(el, event) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const span = document.createElement('span');
    span.className = 'ripple-effect';
    span.style.left = `${(event?.clientX ?? rect.left + rect.width / 2) - rect.left}px`;
    span.style.top = `${(event?.clientY ?? rect.top + rect.height / 2) - rect.top}px`;
    el.appendChild(span);
    setTimeout(() => span.remove(), 600);
}

window.addEventListener('resize', () => { if (window.innerWidth > 900) closeSidebar(); });
