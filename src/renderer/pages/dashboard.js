/**
 * dashboard.js — Overview dashboard
 * Shows: upcoming deadlines, overdue tasks, role progress, calendar blocks today
 */

async function render_dashboard(container) {
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function fmtDate(d) { return d ? new Date(d).toLocaleDateString([],{weekday:'short',month:'short',day:'numeric'}) : ''; }
  function fmtDT(d)   { return d ? new Date(d).toLocaleString([],{dateStyle:'short',timeStyle:'short'}) : ''; }
  function daysUntil(d) {
    const diff = new Date(d).setHours(0,0,0,0) - new Date().setHours(0,0,0,0);
    const days = Math.round(diff / 86400000);
    if (days < 0)  return { label: `${Math.abs(days)}d overdue`, color: 'var(--danger)' };
    if (days === 0) return { label: 'Due today',                  color: 'var(--accent)' };
    if (days === 1) return { label: 'Due tomorrow',               color: 'var(--accent2)' };
    return { label: `${days}d left`, color: 'var(--muted)' };
  }

  const roles      = await window.api.store.get('roles')           || [];
  const roleGroups = await window.api.store.get('roleGroups')      || [];
  const blocks     = await window.api.store.get('localcal.blocks') || [];
  const now        = new Date();
  const todayStr   = now.toDateString();

  // ── Gather all tasks ────────────────────────────────────────────────────────
  const allTasks = [];
  for (const role of roles) {
    for (const t of (role.responsibilities || [])) {
      allTasks.push({ ...t, roleTitle: role.title, roleId: role.id });
    }
  }

  const overdueTasks  = allTasks.filter(t => !t.done && t.deadline && new Date(t.deadline) < now).sort((a,b) => new Date(a.deadline)-new Date(b.deadline));
  const upcomingTasks = allTasks.filter(t => !t.done && t.deadline && new Date(t.deadline) >= now).sort((a,b) => new Date(a.deadline)-new Date(b.deadline)).slice(0,8);
  const todayTasks    = allTasks.filter(t => !t.done && t.startDate && new Date(t.startDate).toDateString() === todayStr);
  const doneTasks     = allTasks.filter(t => t.done);

  // ── Today's calendar blocks ─────────────────────────────────────────────────
  function getBlocksToday() {
    const dow = now.getDay();
    const result = [];
    for (const b of blocks) {
      if (!b.recurring && b.date && new Date(b.date).toDateString() === todayStr) result.push(b);
      if (b.recurring && b.recurDays && b.recurDays.includes(dow)) {
        const from = b.recurFrom ? new Date(b.recurFrom) : null;
        const to   = b.recurTo   ? new Date(b.recurTo)   : null;
        if (from && now < from) continue;
        if (to   && now > to)   continue;
        result.push(b);
      }
    }
    return result.sort((a,b) => (a.startTime||'').localeCompare(b.startTime||''));
  }
  const todayBlocks = getBlocksToday();

  // ── Role progress ────────────────────────────────────────────────────────────
  const roleProgress = roles.map(r => {
    const tasks = r.responsibilities || [];
    const done  = tasks.filter(t => t.done).length;
    const total = tasks.length;
    const pct   = total ? Math.round(done/total*100) : 0;
    return { ...r, done, total, pct };
  }).sort((a,b) => a.pct - b.pct); // lowest first

  // ── Stats ───────────────────────────────────────────────────────────────────
  const totalTasks    = allTasks.length;
  const totalDone     = doneTasks.length;
  const totalOverdue  = overdueTasks.length;
  const totalPct      = totalTasks ? Math.round(totalDone/totalTasks*100) : 0;

  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 17 ? 'Good afternoon' : 'Good evening';
  const dateStr  = now.toLocaleDateString([],{weekday:'long',month:'long',day:'numeric',year:'numeric'});

  container.innerHTML = `
  <div class="page">

    <!-- Header -->
    <div style="margin-bottom:28px">
      <h1 style="font-family:'Playfair Display',serif;font-size:28px;font-weight:900;letter-spacing:-1px">${greeting}, Eddie</h1>
      <div class="text-muted text-sm" style="margin-top:4px">${dateStr}</div>
    </div>

    <!-- Stat cards -->
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:28px">
      ${statCard('Total Tasks',    totalTasks,   '◈',          'var(--text)')}
      ${statCard('Completed',      totalDone,    '✓',          'var(--success)')}
      ${statCard('Overdue',        totalOverdue, '⚠',          totalOverdue>0?'var(--danger)':'var(--muted)')}
      ${statCard('Overall',        totalPct+'%', '▰',          'var(--accent)')}
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">

      <!-- Overdue -->
      ${overdueTasks.length > 0 ? `
      <div class="card" style="grid-column:span 2;border-color:var(--danger)">
        <div class="card-header" style="border-bottom-color:rgba(196,90,58,0.3)">
          <h3 style="color:var(--danger)">⚠ Overdue Tasks</h3>
          <span class="chip chip-danger">${overdueTasks.length}</span>
        </div>
        <div>
          ${overdueTasks.slice(0,5).map(t => taskRow(t, true)).join('')}
          ${overdueTasks.length > 5 ? `<div class="text-muted text-sm" style="padding:10px 18px">+${overdueTasks.length-5} more overdue — <a onclick="navigate('roles')" style="color:var(--accent);cursor:pointer">view all →</a></div>` : ''}
        </div>
      </div>` : ''}

      <!-- Upcoming deadlines -->
      <div class="card">
        <div class="card-header">
          <h3>📅 Upcoming Deadlines</h3>
          <span class="chip chip-muted">${upcomingTasks.length}</span>
        </div>
        <div>
          ${upcomingTasks.length === 0
            ? `<div class="empty" style="padding:24px"><div class="empty-icon" style="font-size:24px">🎉</div><p style="color:var(--muted);font-size:11px">No upcoming deadlines</p></div>`
            : upcomingTasks.map(t => taskRow(t, false)).join('')}
        </div>
      </div>

      <!-- Today -->
      <div class="card">
        <div class="card-header"><h3>☀️ Today</h3></div>
        <div>
          ${todayBlocks.length === 0 && todayTasks.length === 0
            ? `<div class="empty" style="padding:24px"><p style="color:var(--muted);font-size:11px">Nothing scheduled for today</p></div>`
            : ''}
          ${todayBlocks.map(b => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 18px;border-bottom:1px solid var(--border)">
              <span style="font-size:10px;color:var(--muted);width:50px;flex-shrink:0">${b.startTime||'All day'}${b.endTime?' – '+b.endTime:''}</span>
              <div style="width:3px;height:30px;background:${b.roleId?roleColor(b.roleId,roles):'var(--muted)'};border-radius:2px;flex-shrink:0"></div>
              <div>
                <div style="font-size:12px">${esc(b.title)}</div>
                ${b.roleId?`<div class="text-muted text-sm">${esc(roles.find(r=>r.id===b.roleId)?.title||'')}</div>`:''}
              </div>
            </div>`).join('')}
          ${todayTasks.map(t => `
            <div style="display:flex;align-items:center;gap:12px;padding:10px 18px;border-bottom:1px solid var(--border)">
              <span style="font-size:10px;color:var(--success);width:50px;flex-shrink:0">▶ Start</span>
              <div>
                <div style="font-size:12px">${esc(t.text)}</div>
                <div class="text-muted text-sm">${esc(t.roleTitle)}</div>
              </div>
            </div>`).join('')}
        </div>
        <div style="padding:10px 18px;border-top:1px solid var(--border)">
          <button class="btn btn-ghost btn-sm" onclick="navigate('localcalendar')">Open Calendar →</button>
        </div>
      </div>

      <!-- Role progress -->
      <div class="card" style="grid-column:span 2">
        <div class="card-header">
          <h3>◈ Role Progress</h3>
          <button class="btn btn-ghost btn-sm" onclick="navigate('roles')">Manage Roles →</button>
        </div>
        <div style="padding:16px;display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:12px">
          ${roleProgress.length === 0
            ? `<div class="text-muted text-sm">No roles yet — <a onclick="navigate('roles')" style="color:var(--accent);cursor:pointer">add one →</a></div>`
            : roleProgress.map(r => `
              <div style="cursor:pointer;padding:12px;background:var(--card);border-radius:6px;border:1px solid var(--border);transition:border-color 0.1s"
                   onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'"
                   onclick="navigate('roles')">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                  <span style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(r.title)}</span>
                  <span style="font-size:11px;color:var(--muted);flex-shrink:0;margin-left:8px">${r.pct}%</span>
                </div>
                <div class="progress-wrap"><div class="progress-bar" style="width:${r.pct}%"></div></div>
                <div style="display:flex;justify-content:space-between;margin-top:6px">
                  <span class="text-muted text-sm">${r.done}/${r.total} done</span>
                  ${r.responsibilities?.some(t=>!t.done&&t.deadline&&new Date(t.deadline)<now)
                    ? `<span style="font-size:9px;color:var(--danger)">⚠ overdue</span>` : ''}
                </div>
              </div>`).join('')}
        </div>
      </div>

    </div>
  </div>`;

  function statCard(label, value, icon, color) {
    return `
    <div class="card">
      <div class="card-body" style="text-align:center;padding:18px 12px">
        <div style="font-size:22px;margin-bottom:4px;color:${color}">${icon}</div>
        <div style="font-size:24px;font-weight:700;color:${color};font-family:'Playfair Display',serif">${value}</div>
        <div style="font-size:10px;color:var(--muted);letter-spacing:1px;text-transform:uppercase;margin-top:3px">${label}</div>
      </div>
    </div>`;
  }

  function taskRow(t, isOverdue) {
    const due = daysUntil(t.deadline);
    return `
    <div style="display:flex;align-items:center;gap:12px;padding:10px 18px;border-bottom:1px solid var(--border);cursor:pointer;transition:background 0.1s"
         onmouseover="this.style.background='var(--card)'" onmouseout="this.style.background=''"
         onclick="navigate('roles')">
      <div style="flex:1;min-width:0">
        <div style="font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.text)}</div>
        <div class="text-muted text-sm">${esc(t.roleTitle)}${t.assignedTo?' · '+esc(t.assignedTo):''}</div>
      </div>
      <div style="text-align:right;flex-shrink:0">
        <div style="font-size:10px;color:${due.color};font-weight:500">${due.label}</div>
        <div class="text-muted text-sm">${fmtDate(t.deadline)}</div>
      </div>
    </div>`;
  }

  function roleColor(roleId, roles) {
    const COLORS = ['#e8c547','#c47a3a','#4a9a6a','#4a8aca','#c45a3a','#9a4aca','#ca4a7a','#4acaca'];
    const idx = roles.findIndex(r => r.id === roleId);
    return COLORS[idx % COLORS.length] || '#7a7570';
  }
}
