/**
 * roles.js — Roles & Responsibilities page
 * Full drag-and-drop + arrow button reordering at every level:
 *   Role Groups → Roles within group → Task Folders → Tasks within folder
 */

async function render_roles(container) {
  let roles      = await window.api.store.get('roles')      || [];
  let roleGroups = await window.api.store.get('roleGroups') || [];
  let activeId   = null;
  let activeType = null;
  let collapsed  = {};
  let dragState  = {}; // { type, fromIdx, id }

  if (roleGroups.length) { activeId = roleGroups[0].id; activeType = 'group'; }
  else if (roles.length) { activeId = roles[0].id;      activeType = 'role';  }

  const saveRoles  = () => window.api.store.set('roles', roles);
  const saveGroups = () => window.api.store.set('roleGroups', roleGroups);
  const saveAll    = () => Promise.all([saveRoles(), saveGroups()]);

  const getRole  = id => roles.find(r => r.id === id);
  const getGroup = id => roleGroups.find(g => g.id === id);
  const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const fmtDT = d => d ? new Date(d).toLocaleString([],{dateStyle:'short',timeStyle:'short'}) : '';
  const toLocalDT = iso => { if(!iso) return ''; const d=new Date(iso); return new Date(d.getTime()-d.getTimezoneOffset()*60000).toISOString().slice(0,16); };

  const PRIORITY_COLORS = { high:'chip-danger', medium:'chip-accent', low:'chip-success' };
  const TASK_PRI_COLORS = { high:'var(--danger)', medium:'var(--accent)', low:'var(--success)', '':'var(--muted)' };
  const FOLDER_COLORS   = ['#e8c547','#c47a3a','#4a9a6a','#4a8aca','#c45a3a','#9a4aca','#ca4a7a','#4acaca'];

  const rolesInGroup   = gid => roles.filter(r => r.groupId === gid);
  const ungroupedRoles = ()  => roles.filter(r => !r.groupId);
  const tasksInFolder  = (role, fid) => (role.responsibilities||[]).filter(t => t.folderId === fid);
  const unfolderedTasks= role => (role.responsibilities||[]).filter(t => !t.folderId);

  // ── Array helpers ────────────────────────────────────────────────────────────
  function moveItem(arr, fromIdx, toIdx) {
    const copy = [...arr];
    const [item] = copy.splice(fromIdx, 1);
    copy.splice(toIdx, 0, item);
    return copy;
  }

  function moveUp(arr, idx)   { return idx > 0              ? moveItem(arr, idx, idx-1) : arr; }
  function moveDown(arr, idx) { return idx < arr.length - 1 ? moveItem(arr, idx, idx+1) : arr; }

  // ── Reorder: Role Groups ─────────────────────────────────────────────────────
  async function moveGroup(idx, dir) {
    roleGroups = dir === 'up' ? moveUp(roleGroups, idx) : moveDown(roleGroups, idx);
    await saveGroups(); render();
  }
  async function dropGroup(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    roleGroups = moveItem(roleGroups, fromIdx, toIdx);
    await saveGroups(); render();
  }

  // ── Reorder: Roles within a group ────────────────────────────────────────────
  async function moveRoleInGroup(groupId, roleId, dir) {
    const groupRoles = rolesInGroup(groupId);
    const idx = groupRoles.findIndex(r => r.id === roleId);
    const moved = dir === 'up' ? moveUp(groupRoles, idx) : moveDown(groupRoles, idx);
    // Apply new order back into roles array preserving ungrouped positions
    const otherRoles = roles.filter(r => r.groupId !== groupId);
    roles = [...otherRoles, ...moved];
    await saveRoles(); render();
  }
  async function dropRoleInGroup(groupId, fromRoleId, toRoleId) {
    if (fromRoleId === toRoleId) return;
    const groupRoles = rolesInGroup(groupId);
    const fromIdx = groupRoles.findIndex(r => r.id === fromRoleId);
    const toIdx   = groupRoles.findIndex(r => r.id === toRoleId);
    const moved   = moveItem(groupRoles, fromIdx, toIdx);
    const otherRoles = roles.filter(r => r.groupId !== groupId);
    roles = [...otherRoles, ...moved];
    await saveRoles(); render();
  }

  // ── Reorder: Task Folders ────────────────────────────────────────────────────
  async function moveFolder(roleId, folderId, dir) {
    const role = getRole(roleId); if (!role) return;
    const idx  = (role.taskFolders||[]).findIndex(f => f.id === folderId);
    role.taskFolders = dir === 'up' ? moveUp(role.taskFolders, idx) : moveDown(role.taskFolders, idx);
    await saveRoles(); render();
  }
  async function dropFolder(roleId, fromFid, toFid) {
    if (fromFid === toFid) return;
    const role = getRole(roleId); if (!role) return;
    const fromIdx = (role.taskFolders||[]).findIndex(f => f.id === fromFid);
    const toIdx   = (role.taskFolders||[]).findIndex(f => f.id === toFid);
    role.taskFolders = moveItem(role.taskFolders, fromIdx, toIdx);
    await saveRoles(); render();
  }

  // ── Reorder: Tasks ───────────────────────────────────────────────────────────
  async function moveTask(roleId, taskId, folderId, dir) {
    const role  = getRole(roleId); if (!role) return;
    const tasks = folderId
      ? (role.responsibilities||[]).filter(t => t.folderId === folderId)
      : (role.responsibilities||[]).filter(t => !t.folderId);
    const idx     = tasks.findIndex(t => t.id === taskId);
    const moved   = dir === 'up' ? moveUp(tasks, idx) : moveDown(tasks, idx);
    const others  = folderId
      ? (role.responsibilities||[]).filter(t => t.folderId !== folderId)
      : (role.responsibilities||[]).filter(t => t.folderId);
    role.responsibilities = [...others, ...moved];
    await saveRoles(); render();
  }
  async function dropTask(roleId, fromTaskId, toTaskId, folderId) {
    if (fromTaskId === toTaskId) return;
    const role  = getRole(roleId); if (!role) return;
    const tasks = folderId
      ? (role.responsibilities||[]).filter(t => t.folderId === folderId)
      : (role.responsibilities||[]).filter(t => !t.folderId);
    const fromIdx = tasks.findIndex(t => t.id === fromTaskId);
    const toIdx   = tasks.findIndex(t => t.id === toTaskId);
    const moved   = moveItem(tasks, fromIdx, toIdx);
    const others  = folderId
      ? (role.responsibilities||[]).filter(t => t.folderId !== folderId)
      : (role.responsibilities||[]).filter(t => t.folderId);
    role.responsibilities = [...others, ...moved];
    await saveRoles(); render();
  }

  // ── Drag helpers (CSS classes) ───────────────────────────────────────────────
  function onDragStart(e, type, id, groupId) {
    dragState = { type, id, groupId };
    e.dataTransfer.effectAllowed = 'move';
    e.currentTarget.style.opacity = '0.4';
  }
  function onDragEnd(e) { e.currentTarget.style.opacity = '1'; }
  function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; e.currentTarget.style.background = 'var(--card)'; }
  function onDragLeave(e) { e.currentTarget.style.background = ''; }

  // ── Arrow buttons html ───────────────────────────────────────────────────────
  function arrowBtns(onUp, onDown, isFirst, isLast) {
    return `<div style="display:flex;flex-direction:column;gap:1px;flex-shrink:0">
      <button onclick="event.stopPropagation();${onUp}" ${isFirst?'disabled':''} style="background:none;border:none;color:${isFirst?'var(--border)':'var(--muted)'};cursor:${isFirst?'default':'pointer'};font-size:9px;line-height:1;padding:1px 3px" title="Move up">▲</button>
      <button onclick="event.stopPropagation();${onDown}" ${isLast?'disabled':''} style="background:none;border:none;color:${isLast?'var(--border)':'var(--muted)'};cursor:${isLast?'default':'pointer'};font-size:9px;line-height:1;padding:1px 3px" title="Move down">▼</button>
    </div>`;
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  function render() {
    const savedInnerW = localStorage.getItem('rolesSidebarW') || '260';
    container.innerHTML = `
    <div style="display:flex;height:100%;min-height:0">
      <div id="roles-sidebar" style="width:${savedInnerW}px;min-width:160px;border-right:1px solid var(--border);display:flex;flex-direction:column;overflow:hidden;flex-shrink:0">
        <div class="flex-between" style="padding:16px;border-bottom:1px solid var(--border);flex-shrink:0">
          <span style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--muted)">Workspace</span>
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm" onclick="openGroupModal()" title="New Role Group">📁 Group</button>
            <button class="btn btn-ghost btn-sm" onclick="openRoleModal()">＋ Role</button>
          </div>
        </div>
        <div style="overflow-y:auto;flex:1;padding:8px" id="sidebar-list">${renderSidebar()}</div>
      </div>
      <div class="resizer" id="roles-resizer" title="Drag to resize sidebar"></div>
      <div id="roles-main" style="overflow-y:auto;padding:32px;flex:1;min-width:0">${renderMain()}</div>
    </div>
    ${roleModalHtml()}${groupModalHtml()}${taskModalHtml()}${taskFolderModalHtml()}`;
    attachHandlers();
    // Wire up inner resizer after DOM is set
    initRolesResizer();
  }

  // ── Sidebar ──────────────────────────────────────────────────────────────────
  function renderSidebar() {
    let html = '';
    roleGroups.forEach((g, gi) => {
      const gRoles    = rolesInGroup(g.id);
      const totalDone = gRoles.reduce((a,r)=>(a+(r.responsibilities||[]).filter(t=>t.done).length),0);
      const totalAll  = gRoles.reduce((a,r)=>(a+(r.responsibilities||[]).length),0);
      const pct       = totalAll ? Math.round(totalDone/totalAll*100) : 0;
      const isOpen    = !collapsed[g.id];
      const isActive  = activeId === g.id && activeType === 'group';
      const color     = g.color || '#7a7570';

      html += `
      <div draggable="true"
           ondragstart="handleDragStart(event,'group','${g.id}',null,${gi})"
           ondragend="handleDragEnd(event)"
           ondragover="handleDragOver(event)"
           ondragleave="handleDragLeave(event)"
           ondrop="handleDropGroup(event,${gi})"
           style="margin-bottom:4px;border-radius:4px;transition:background 0.1s">
        <div class="nav-item ${isActive?'active':''}" onclick="selectItem('${g.id}','group')"
             style="border-left:3px solid ${color};flex-direction:column;align-items:flex-start;gap:3px;cursor:grab">
          <div class="flex-between" style="width:100%">
            <div style="display:flex;align-items:center;gap:4px;min-width:0;flex:1">
              <span style="color:var(--muted);font-size:10px;flex-shrink:0;cursor:grab" title="Drag to reorder">⠿</span>
              <span onclick="event.stopPropagation();toggleCollapse('${g.id}')" style="cursor:pointer;font-size:10px;color:var(--muted);flex-shrink:0">${isOpen?'▾':'▸'}</span>
              <span style="font-size:12px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📁 ${esc(g.title)}</span>
            </div>
            <div style="display:flex;align-items:center;gap:2px;flex-shrink:0">
              <span style="font-size:9px;color:var(--muted)">${totalDone}/${totalAll}</span>
              ${arrowBtns(`moveGroup(${gi},'up')`,`moveGroup(${gi},'down')`, gi===0, gi===roleGroups.length-1)}
            </div>
          </div>
          <div class="progress-wrap" style="width:100%"><div class="progress-bar" style="width:${pct}%;background:${color}"></div></div>
        </div>
        ${isOpen ? `
          ${gRoles.map((r,ri) => renderSidebarRole(r, true, g.id, ri, gRoles.length)).join('')}
          <div style="padding:2px 8px 4px 20px">
            <button class="btn btn-ghost btn-sm" onclick="openRoleModal(null,'${g.id}')" style="font-size:10px;width:100%">＋ Add role to group</button>
          </div>` : ''}
      </div>`;
    });

    const unGrouped = ungroupedRoles();
    if (unGrouped.length) {
      html += `<div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);padding:8px 8px 4px">Ungrouped</div>`;
      unGrouped.forEach((r,ri) => { html += renderSidebarRole(r, false, null, ri, unGrouped.length); });
    }

    if (!roleGroups.length && !roles.length) {
      html = `<div class="text-muted text-sm" style="padding:12px;text-align:center;line-height:1.8">No roles yet.<br/>Create a group or add a role.</div>`;
    }
    return html;
  }

  function renderSidebarRole(r, indented, groupId, ri, total) {
    const done     = (r.responsibilities||[]).filter(t=>t.done).length;
    const total2   = (r.responsibilities||[]).length;
    const pct      = total2 ? Math.round(done/total2*100) : 0;
    const isActive = activeId === r.id && activeType === 'role';
    const gpStr    = groupId || 'null';
    return `
    <div draggable="true"
         ondragstart="handleDragStart(event,'role','${r.id}','${gpStr}',${ri})"
         ondragend="handleDragEnd(event)"
         ondragover="handleDragOver(event)"
         ondragleave="handleDragLeave(event)"
         ondrop="handleDropRole(event,'${gpStr}','${r.id}')"
         style="border-radius:4px;transition:background 0.1s">
      <div class="nav-item ${isActive?'active':''}" onclick="selectItem('${r.id}','role')"
           style="flex-direction:column;align-items:flex-start;gap:3px;${indented?'padding-left:20px':''}">
        <div class="flex-between" style="width:100%">
          <div style="display:flex;align-items:center;gap:4px;min-width:0;flex:1">
            <span style="color:var(--muted);font-size:10px;flex-shrink:0;cursor:grab" title="Drag to reorder">⠿</span>
            <span style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">◈ ${esc(r.title)}</span>
          </div>
          <div style="display:flex;align-items:center;gap:2px;flex-shrink:0">
            <span style="font-size:9px;color:var(--muted)">${done}/${total2}</span>
            ${groupId
              ? arrowBtns(`moveRoleInGroup('${groupId}','${r.id}','up')`,`moveRoleInGroup('${groupId}','${r.id}','down')`, ri===0, ri===total-1)
              : arrowBtns(`moveUngroupedRole('${r.id}','up')`,`moveUngroupedRole('${r.id}','down')`, ri===0, ri===total-1)}
          </div>
        </div>
        <div class="progress-wrap" style="width:100%"><div class="progress-bar" style="width:${pct}%"></div></div>
      </div>
    </div>`;
  }

  // ── Main panel ───────────────────────────────────────────────────────────────
  function renderMain() {
    if (!activeId) return `<div class="empty"><div class="empty-icon">◈</div><h3>Nothing selected</h3></div>`;
    if (activeType === 'group') return renderGroupDetail(getGroup(activeId));
    if (activeType === 'role')  return renderRoleDetail(getRole(activeId));
    return '';
  }

  function renderGroupDetail(g) {
    if (!g) return '';
    const gRoles    = rolesInGroup(g.id);
    const totalDone = gRoles.reduce((a,r)=>(a+(r.responsibilities||[]).filter(t=>t.done).length),0);
    const totalAll  = gRoles.reduce((a,r)=>(a+(r.responsibilities||[]).length),0);
    const pct       = totalAll ? Math.round(totalDone/totalAll*100) : 0;
    const color     = g.color || '#7a7570';
    const overdue   = g.deadline && new Date(g.deadline) < new Date();

    return `
    <div class="page-header">
      <div>
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:6px">
          <div style="width:14px;height:14px;border-radius:3px;background:${color}"></div>
          <h1>📁 ${esc(g.title)}</h1>
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">
          <span class="chip chip-muted">${gRoles.length} roles</span>
          <span class="chip chip-muted">${totalAll} tasks</span>
          ${g.deadline ? `<span class="chip ${overdue?'chip-danger':'chip-accent'}">${overdue?'⚠':'📅'} ${new Date(g.deadline).toLocaleDateString()}</span>` : ''}
          <span class="text-muted text-sm">${pct}% complete</span>
        </div>
        <div style="margin-top:10px;width:240px"><div class="progress-wrap" style="height:5px"><div class="progress-bar" style="width:${pct}%;background:${color}"></div></div></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="openGroupModal('${g.id}')">✎ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteGroup('${g.id}')">✕ Delete</button>
      </div>
    </div>
    ${g.notes ? `<div class="card" style="margin-bottom:20px"><div class="card-header"><h3>Notes</h3></div><div style="padding:14px 18px;font-size:12px;line-height:1.8;color:var(--muted)">${esc(g.notes)}</div></div>` : ''}
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px">
      ${gRoles.length === 0
        ? `<div class="empty" style="grid-column:span 2"><div class="empty-icon">◈</div><h3>No roles in this group</h3></div>`
        : gRoles.map(r => {
            const done  = (r.responsibilities||[]).filter(t=>t.done).length;
            const total = (r.responsibilities||[]).length;
            const pct2  = total ? Math.round(done/total*100) : 0;
            return `<div class="card" style="cursor:pointer" onclick="selectItem('${r.id}','role')">
              <div class="card-body">
                <div style="font-size:14px;font-weight:600;margin-bottom:6px">◈ ${esc(r.title)}</div>
                <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px">
                  ${r.dept?`<span class="chip chip-muted">${esc(r.dept)}</span>`:''}
                  <span class="chip ${PRIORITY_COLORS[r.priority]||'chip-muted'}">${r.priority||'medium'}</span>
                  <span class="text-muted text-sm">${done}/${total} done</span>
                </div>
                <div class="progress-wrap"><div class="progress-bar" style="width:${pct2}%"></div></div>
              </div>
            </div>`;
          }).join('')}
      <div class="card" style="border-style:dashed;cursor:pointer;display:flex;align-items:center;justify-content:center;min-height:80px" onclick="openRoleModal(null,'${g.id}')">
        <span style="color:var(--muted);font-size:12px">＋ Add Role to Group</span>
      </div>
    </div>`;
  }

  function calcProgress(role, period) {
    const resps = (role.responsibilities||[]).filter(t => !t.excludeFromPct);
    if (!resps.length) return { done: 0, total: 0, pct: 0 };
    const now = new Date();
    let filtered = resps;
    if (period === 'daily') {
      const todayStr = now.toDateString();
      filtered = resps.filter(t => t.deadline && new Date(t.deadline).toDateString() === todayStr);
    } else if (period === 'weekly') {
      const weekStart = new Date(now); weekStart.setDate(now.getDate() - now.getDay() + 1); weekStart.setHours(0,0,0,0);
      const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);
      filtered = resps.filter(t => t.deadline && new Date(t.deadline) >= weekStart && new Date(t.deadline) < weekEnd);
    } else if (period === 'monthly') {
      filtered = resps.filter(t => t.deadline && new Date(t.deadline).getMonth()===now.getMonth() && new Date(t.deadline).getFullYear()===now.getFullYear());
    } else if (period === 'yearly') {
      filtered = resps.filter(t => t.deadline && new Date(t.deadline).getFullYear()===now.getFullYear());
    }
    if (!filtered.length) return { done: 0, total: resps.length, pct: 0, periodEmpty: true };
    const done = filtered.filter(t=>t.done).length;
    return { done, total: filtered.length, pct: Math.round(done/filtered.length*100) };
  }

  function renderRoleDetail(role) {
    if (!role) return '';
    const resps   = role.responsibilities || [];
    const folders = role.taskFolders      || [];
    const period  = role.progressPeriod   || 'all';
    const prog    = calcProgress(role, period);
    const pct     = prog.pct;
    const group   = role.groupId ? getGroup(role.groupId) : null;
    const excluded = resps.filter(t=>t.excludeFromPct).length;

    return `
    <div class="page-header">
      <div>
        ${group?`<div style="font-size:10px;color:var(--muted);margin-bottom:4px">📁 ${esc(group.title)}</div>`:''}
        <h1>${esc(role.title)}</h1>
        <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center">
          ${role.dept?`<span class="chip chip-muted">${esc(role.dept)}</span>`:''}
          <span class="chip ${PRIORITY_COLORS[role.priority]||'chip-muted'}">${role.priority||'medium'} priority</span>
          <span class="text-muted text-sm">${pct}% ${period!=='all'?'('+period+')':''}</span>
          ${excluded?`<span class="text-muted text-sm" style="font-size:10px">${excluded} excluded</span>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:10px;margin-top:10px">
          <div class="progress-wrap" style="width:180px"><div class="progress-bar" style="width:${pct}%"></div></div>
          <span style="font-size:10px;color:var(--muted)">${prog.done}/${prog.total} tasks</span>
        </div>
        <!-- Period selector -->
        <div style="display:flex;align-items:center;gap:6px;margin-top:8px;flex-wrap:wrap">
          <span style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted)">Progress period:</span>
          ${['all','daily','weekly','monthly','yearly'].map(p=>`
            <button onclick="setProgressPeriod('${role.id}','${p}')"
                    class="btn btn-sm ${period===p?'btn-primary':'btn-ghost'}"
                    style="font-size:9px;padding:3px 10px;letter-spacing:1px;text-transform:uppercase">
              ${p}
            </button>`).join('')}
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="openTaskFolderModal(null,'${role.id}')">📁 Add Folder</button>
        <button class="btn btn-ghost btn-sm" onclick="duplicateRole('${role.id}')">⧉ Duplicate</button>
        <button class="btn btn-ghost btn-sm" onclick="openRoleModal('${role.id}')">✎ Edit</button>
        <button class="btn btn-danger btn-sm" onclick="deleteRole('${role.id}')">✕ Delete</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
      ${folders.map((f,fi) => renderTaskFolder(role, f, fi, folders.length)).join('')}
      ${renderTaskSection(role)}
      <div class="card">
        <div class="card-header"><h3>Role Priority</h3></div>
        <div style="display:flex;gap:8px;padding:16px;flex-wrap:wrap">
          ${['high','medium','low'].map(p=>`<div onclick="setRolePriority('${p}')" style="padding:8px 16px;border-radius:20px;font-size:11px;cursor:pointer;border:1px solid ${p==='high'?'var(--danger)':p==='medium'?'var(--accent)':'var(--success)'};color:${p==='high'?'var(--danger)':p==='medium'?'var(--accent)':'var(--success)'};background:${role.priority===p?(p==='high'?'rgba(196,90,58,0.15)':p==='medium'?'rgba(232,197,71,0.15)':'rgba(74,154,106,0.15)'):'none'};transition:all 0.12s">${p==='high'?'⬆':p==='medium'?'→':'⬇'} ${p}</div>`).join('')}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><h3>Role Notes</h3><button class="btn btn-ghost btn-sm" onclick="syncNotesToOneNote('${role.id}')">📓 OneNote</button></div>
        <textarea id="role-notes" style="width:100%;background:none;border:none;color:var(--text);font-family:'DM Mono',monospace;font-size:12px;padding:16px;resize:none;outline:none;min-height:100px;line-height:1.7" placeholder="Add notes…" onblur="saveRoleNotes()">${esc(role.notes||'')}</textarea>
      </div>
      <div class="card" style="grid-column:span 2">
        <div class="card-header"><h3>Linked Calendar Events</h3><button class="btn btn-ghost btn-sm" onclick="openCreateEventModal('${role.id}')">＋ Create Meeting</button></div>
        <div id="linked-events-list" style="padding:12px"><span class="text-muted text-sm">Loading events…</span></div>
      </div>
    </div>`;
  }

  // ── Task Folder ──────────────────────────────────────────────────────────────
  function renderTaskFolder(role, folder, fi, totalFolders) {
    const tasks   = tasksInFolder(role, folder.id);
    const done    = tasks.filter(t=>t.done).length;
    const pct     = tasks.length ? Math.round(done/tasks.length*100) : 0;
    const isOpen  = !collapsed['f_'+folder.id];
    const color   = folder.color || '#7a7570';
    const overdue = folder.deadline && new Date(folder.deadline) < new Date();

    return `
    <div class="card" style="grid-column:span 2;border-left:3px solid ${color}"
         draggable="true"
         ondragstart="handleDragStart(event,'folder','${folder.id}','${role.id}',${fi})"
         ondragend="handleDragEnd(event)"
         ondragover="handleDragOver(event)"
         ondragleave="handleDragLeave(event)"
         ondrop="handleDropFolder(event,'${role.id}','${folder.id}')">
      <div class="card-header">
        <div style="display:flex;align-items:center;gap:8px;flex:1;cursor:pointer" onclick="toggleCollapse('f_${folder.id}')">
          <span style="color:var(--muted);font-size:12px;cursor:grab" title="Drag to reorder">⠿</span>
          <span style="font-size:12px;color:var(--muted)">${isOpen?'▾':'▸'}</span>
          <div style="width:10px;height:10px;border-radius:2px;background:${color};flex-shrink:0"></div>
          <span style="font-size:12px;color:var(--text);font-weight:500">📁 ${esc(folder.title)}</span>
          ${folder.deadline?`<span class="chip ${overdue?'chip-danger':'chip-accent'}" style="font-size:9px">${overdue?'⚠':'📅'} ${new Date(folder.deadline).toLocaleDateString()}</span>`:''}
        </div>
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:10px;color:var(--muted)">${done}/${tasks.length} · ${pct}%</span>
          <div class="progress-wrap" style="width:70px"><div class="progress-bar" style="width:${pct}%;background:${color}"></div></div>
          ${arrowBtns(`moveFolder('${role.id}','${folder.id}','up')`,`moveFolder('${role.id}','${folder.id}','down')`, fi===0, fi===totalFolders-1)}
          <button onclick="duplicateFolder('${folder.id}','${role.id}')" class="btn btn-ghost btn-sm" title="Duplicate folder">⧉</button>
          <button onclick="openTaskFolderModal('${folder.id}','${role.id}')" class="btn btn-ghost btn-sm">✎</button>
          <button onclick="deleteTaskFolder('${folder.id}','${role.id}')" class="btn btn-danger btn-sm">✕</button>
        </div>
      </div>
      ${isOpen ? `
        ${folder.notes?`<div style="padding:8px 18px;font-size:11px;color:var(--muted);border-bottom:1px solid var(--border)">${esc(folder.notes)}</div>`:''}
        ${tasks.length>0?colHeaders():''}
        <div id="folder-tasks-${folder.id}">
          ${tasks.length===0
            ? `<div class="text-muted text-sm" style="padding:12px 18px">No tasks — add one below</div>`
            : tasks.map((t,ti) => renderTaskRow(role, t, ti, tasks.length, folder.id)).join('')}
        </div>
        <div style="padding:8px 18px;display:flex;gap:8px;border-top:1px solid var(--border)" draggable="false" ondragstart="event.stopPropagation()">
          <input type="text" placeholder="Quick add task…" id="qt-${folder.id}"
                 style="flex:1;background:none;border:none;color:var(--text);font-family:'DM Mono',monospace;font-size:12px;outline:none"
                 ondragstart="event.stopPropagation()" onkeydown="if(event.key==='Enter')addQuickTask('${role.id}','${folder.id}')"/>
          <button class="btn btn-ghost btn-sm" onclick="addQuickTask('${role.id}','${folder.id}')">＋</button>
          <button class="btn btn-primary btn-sm" onclick="openTaskModal(-1,'${role.id}','${folder.id}')">＋ Full</button>
        </div>` : ''}
    </div>`;
  }

  function renderTaskSection(role) {
    const tasks   = unfolderedTasks(role);
    const folders = role.taskFolders || [];
    if (tasks.length === 0 && folders.length > 0) return '';
    return `
    <div class="card" style="grid-column:span 2">
      <div class="card-header"><h3>General Tasks</h3><span class="chip chip-muted">${tasks.length}</span></div>
      ${tasks.length>0?colHeaders():''}
      <div>
        ${tasks.length===0
          ? `<div class="text-muted text-sm" style="padding:12px 18px">No tasks yet</div>`
          : tasks.map((t,ti) => renderTaskRow(role, t, ti, tasks.length, null)).join('')}
      </div>
      <div style="padding:8px 18px;display:flex;gap:8px;border-top:1px solid var(--border)" draggable="false" ondragstart="event.stopPropagation()">
        <input type="text" id="qt-general" placeholder="Quick add task…"
               style="flex:1;background:none;border:none;color:var(--text);font-family:'DM Mono',monospace;font-size:12px;outline:none"
               ondragstart="event.stopPropagation()" onkeydown="if(event.key==='Enter')addQuickTask('${role.id}',null)"/>
        <button class="btn btn-ghost btn-sm" onclick="addQuickTask('${role.id}',null)">＋</button>
        <button class="btn btn-primary btn-sm" onclick="openTaskModal(-1,'${role.id}',null)">＋ Full</button>
      </div>
    </div>`;
  }

  function colHeaders() {
    return `<div style="display:grid;grid-template-columns:20px 24px 1fr 80px 100px 100px 70px 90px 60px;gap:6px;padding:6px 18px;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);border-bottom:1px solid var(--border)">
      <span></span><span></span><span>Task</span><span>Priority</span><span>Start</span><span>Deadline</span><span>Duration</span><span>Assigned</span><span title="⊘ = excluded from %"></span>
    </div>`;
  }

  function renderTaskRow(role, t, ti, total, folderId) {
    const overdue  = !t.done && t.deadline && new Date(t.deadline) < new Date();
    const tpColor  = TASK_PRI_COLORS[t.priority||''];
    const taskIdx  = (role.responsibilities||[]).findIndex(x=>x.id===t.id);
    const fidStr   = folderId || 'null';
    return `
    <div draggable="true"
         ondragstart="handleDragStart(event,'task','${t.id}','${role.id}:${fidStr}',${ti})"
         ondragend="handleDragEnd(event)"
         ondragover="handleDragOver(event)"
         ondragleave="handleDragLeave(event)"
         ondrop="handleDropTask(event,'${role.id}','${t.id}','${fidStr}')"
         style="display:grid;grid-template-columns:20px 24px 1fr 80px 100px 100px 70px 90px 60px;gap:6px;align-items:center;padding:9px 18px;border-bottom:1px solid var(--border);transition:background 0.1s;cursor:pointer"
         onmouseover="this.style.background='var(--card)'" onmouseout="this.style.background=''"
         onclick="openTaskModal(${taskIdx},'${role.id}','${folderId||''}')">
      <input type="checkbox" ${t.done?'checked':''} onclick="event.stopPropagation()" onchange="toggleTask('${role.id}',${taskIdx})"
             style="accent-color:var(--accent);cursor:pointer;width:14px;height:14px"/>
      <div style="display:flex;flex-direction:column;gap:1px" onclick="event.stopPropagation()">
        ${arrowBtns(`moveTask('${role.id}','${t.id}','${fidStr}','up')`,`moveTask('${role.id}','${t.id}','${fidStr}','down')`, ti===0, ti===total-1)}
      </div>
      <div style="min-width:0">
        <div style="display:flex;align-items:center;gap:6px">
          <span style="font-size:12px;${t.done?'text-decoration:line-through;color:var(--muted)':''}overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.text)}</span>
          ${t.recur?`<span style="font-size:9px;color:var(--info);flex-shrink:0">🔁</span>`:''}
        </div>
        ${(t.subtasks&&t.subtasks.length)?`<div style="display:flex;align-items:center;gap:6px;margin-top:3px">
          <div class="progress-wrap" style="width:60px;height:3px"><div class="progress-bar" style="width:${Math.round(t.subtasks.filter(s=>s.done).length/t.subtasks.length*100)}%"></div></div>
          <span style="font-size:9px;color:var(--muted)">${t.subtasks.filter(s=>s.done).length}/${t.subtasks.length}</span>
        </div>`:''}
        ${t.notes?`<div style="font-size:10px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.notes)}</div>`:''}
      </div>
      <span style="font-size:10px;color:${tpColor}">${t.priority||'—'}</span>
      <span style="font-size:10px;color:var(--muted)">${t.startDate?fmtDT(t.startDate):'—'}</span>
      <span style="font-size:10px;color:${overdue?'var(--danger)':'var(--muted)'}">${overdue?'⚠ ':''}${t.deadline?fmtDT(t.deadline):'—'}</span>
      <span style="font-size:10px;color:var(--muted)">${t.duration?t.duration+' '+(t.durationUnit||'min').slice(0,3):'—'}</span>
      <span style="font-size:10px;color:var(--muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t.assignedTo?esc(t.assignedTo):'—'}</span>
      <div style="display:flex;gap:2px" onclick="event.stopPropagation()">
        <button onclick="toggleExclude('${role.id}',${taskIdx})"
                title="${t.excludeFromPct?'Include in progress %':'Exclude from progress %'}"
                style="background:none;border:none;color:${t.excludeFromPct?'var(--accent)':'var(--muted)'};cursor:pointer;opacity:${t.excludeFromPct?'1':'0.3'};font-size:11px;padding:0 3px;transition:opacity 0.1s"
                onmouseover="this.style.opacity=1" onmouseout="this.style.opacity='${t.excludeFromPct?'1':'0.3'}'">⊘</button>
        <button onclick="deleteTask('${role.id}',${taskIdx})"
                style="background:none;border:none;color:var(--danger);cursor:pointer;opacity:0.3;font-size:12px;padding:0 4px;transition:opacity 0.1s"
                onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.3">✕</button>
      </div>
    </div>`;
  }

  // ── Modals ───────────────────────────────────────────────────────────────────
  function groupModalHtml() {
    return `<div class="modal-overlay" id="group-modal" onclick="closeGroupModal(event)"><div class="modal">
      <h2 id="gm-title">New Role Group</h2><input type="hidden" id="gm-id"/>
      <div class="field"><label>Group Name</label><input id="gm-name" type="text" placeholder="e.g. Client Projects…"/></div>
      <div class="field-row">
        <div class="field"><label>Deadline (optional)</label><input id="gm-deadline" type="date"/></div>
        <div class="field"><label>Colour</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${FOLDER_COLORS.map(c=>`<div onclick="selectGroupColor('${c}')" data-color="${c}" style="width:24px;height:24px;border-radius:4px;background:${c};cursor:pointer;border:2px solid transparent;transition:border 0.1s"></div>`).join('')}</div>
          <input type="hidden" id="gm-color" value="${FOLDER_COLORS[0]}"/>
        </div>
      </div>
      <div class="field"><label>Notes (optional)</label><textarea id="gm-notes" style="min-height:70px"></textarea></div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="closeGroupModal()">Cancel</button><button class="btn btn-primary" onclick="saveGroup()">Save</button></div>
    </div></div>`;
  }

  function roleModalHtml() {
    return `<div class="modal-overlay" id="role-modal" onclick="closeRoleModal(event)"><div class="modal">
      <h2 id="rm-title-h">Add Role</h2><input type="hidden" id="rm-id"/>
      <div class="field"><label>Role Title</label><input id="rm-title" type="text" placeholder="e.g. Product Manager"/></div>
      <div class="field-row">
        <div class="field"><label>Department</label><input id="rm-dept" type="text"/></div>
        <div class="field"><label>Priority</label><select id="rm-priority"><option value="high">High</option><option value="medium" selected>Medium</option><option value="low">Low</option></select></div>
      </div>
      <div class="field"><label>Add to Group</label><select id="rm-group"><option value="">— No group —</option>${roleGroups.map(g=>`<option value="${g.id}">${esc(g.title)}</option>`).join('')}</select></div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="closeRoleModal()">Cancel</button><button class="btn btn-primary" onclick="saveRole()">Save</button></div>
    </div></div>`;
  }

  function taskFolderModalHtml() {
    return `<div class="modal-overlay" id="tfolder-modal" onclick="closeTFolderModal(event)"><div class="modal">
      <h2 id="tf-title">New Task Folder</h2><input type="hidden" id="tf-id"/><input type="hidden" id="tf-role-id"/>
      <div class="field"><label>Folder Name</label><input id="tf-name" type="text" placeholder="e.g. Phase 1, Admin…"/></div>
      <div class="field-row">
        <div class="field"><label>Deadline (optional)</label><input id="tf-deadline" type="date"/></div>
        <div class="field"><label>Colour</label>
          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:4px">${FOLDER_COLORS.map(c=>`<div onclick="selectFolderColor('${c}')" data-fcolor="${c}" style="width:24px;height:24px;border-radius:4px;background:${c};cursor:pointer;border:2px solid transparent;transition:border 0.1s"></div>`).join('')}</div>
          <input type="hidden" id="tf-color" value="${FOLDER_COLORS[0]}"/>
        </div>
      </div>
      <div class="field"><label>Notes (optional)</label><textarea id="tf-notes" style="min-height:70px"></textarea></div>
      <div class="modal-footer"><button class="btn btn-ghost" onclick="closeTFolderModal()">Cancel</button><button class="btn btn-primary" onclick="saveTaskFolder()">Save</button></div>
    </div></div>`;
  }

  function taskModalHtml() {
    return `<div class="modal-overlay" id="task-modal" onclick="closeTaskModal(event)">
    <div class="modal" style="width:640px;max-height:92vh;overflow-y:auto;display:flex;flex-direction:column">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-shrink:0">
        <h2 id="task-modal-title" style="margin:0">Task Details</h2>
        <div style="display:flex;align-items:center;gap:6px">
          <span id="tm-autosave-indicator" style="font-size:10px;color:var(--muted);opacity:0">✓ Saved</span>
        </div>
      </div>

      <input type="hidden" id="tm-idx"/>
      <input type="hidden" id="tm-role-id"/>
      <input type="hidden" id="tm-folder-id"/>

      <!-- Task name -->
      <div class="field">
        <label>Task Name</label>
        <input id="tm-text" type="text" placeholder="What needs to be done?" oninput="tmAutoSave()"/>
      </div>

      <div class="field-row">
        <div class="field"><label>Priority</label>
          <select id="tm-priority" onchange="tmAutoSave()">
            <option value="">— None —</option>
            <option value="high">⬆ High</option>
            <option value="medium">→ Medium</option>
            <option value="low">⬇ Low</option>
          </select>
        </div>
        <div class="field"><label>Assigned To</label>
          <div style="display:flex;gap:6px">
            <select id="tm-assigned-select" onchange="applyAssigneeSelect()" style="flex:1;background:var(--card);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:'DM Mono',monospace;font-size:12px;padding:8px 10px;outline:none">
              <option value="">— Select from team —</option>
            </select>
            <span style="color:var(--muted);font-size:11px;align-self:center">or</span>
            <input id="tm-assigned" type="text" placeholder="Type manually" oninput="tmAutoSave()" style="flex:1"/>
          </div>
          <div style="font-size:10px;color:var(--muted);margin-top:4px">Pick from team or type a custom name</div>
        </div>
      </div>

      <div class="field">
        <label style="display:flex;align-items:center;justify-content:space-between">
          Start Date & Time
          <button type="button" onclick="copyDateToNotes('tm-start','Start')" class="btn btn-ghost btn-sm" style="font-size:9px;padding:2px 8px">📋 Copy to Notes</button>
        </label>
        <input id="tm-start" type="datetime-local" onchange="tmAutoSave()"/>
      </div>

      <div class="field">
        <label style="display:flex;align-items:center;justify-content:space-between">
          Deadline Date & Time
          <button type="button" onclick="copyDateToNotes('tm-deadline','Deadline')" class="btn btn-ghost btn-sm" style="font-size:9px;padding:2px 8px">📋 Copy to Notes</button>
        </label>
        <input id="tm-deadline" type="datetime-local" onchange="tmAutoSave()"/>
      </div>

      <div class="field">
        <label style="display:flex;align-items:center;justify-content:space-between">
          Completed Date & Time
          <button type="button" onclick="copyDateToNotes('tm-completed','Completed')" class="btn btn-ghost btn-sm" style="font-size:9px;padding:2px 8px">📋 Copy to Notes</button>
        </label>
        <input id="tm-completed" type="datetime-local" onchange="tmAutoSave()"/>
      </div>

      <div class="field">
        <label>Estimated Duration</label>
        <div style="display:flex;border:1px solid var(--border);border-radius:4px;overflow:hidden;background:var(--card)">
          <input id="tm-duration" type="number" min="1" placeholder="Amount" oninput="tmAutoSave()"
                 style="width:80px;flex-shrink:0;background:none;border:none;border-right:1px solid var(--border);color:var(--text);font-family:'DM Mono',monospace;font-size:12px;padding:8px 12px;outline:none"/>
          <select id="tm-duration-unit" onchange="tmAutoSave()"
                  style="flex:1;background:none;border:none;color:var(--text);font-family:'DM Mono',monospace;font-size:12px;padding:8px 12px;outline:none;cursor:pointer">
            <option value="minutes">Minutes</option>
            <option value="hours">Hours</option>
            <option value="days">Days</option>
            <option value="weeks">Weeks</option>
            <option value="months">Months</option>
            <option value="years">Years</option>
          </select>
          <button type="button" onclick="copyDurationToNotes()"
                  style="background:none;border:none;border-left:1px solid var(--border);color:var(--muted);font-size:10px;font-family:'DM Mono',monospace;padding:8px 12px;cursor:pointer;white-space:nowrap;transition:color 0.12s"
                  onmouseover="this.style.color='var(--accent)'" onmouseout="this.style.color='var(--muted)'">📋 Copy</button>
        </div>
      </div>

      <div class="field">
        <label>Move to Folder</label>
        <select id="tm-folder-select" onchange="tmAutoSave()"><option value="">— General Tasks —</option></select>
      </div>

      <!-- Subtasks -->
      <div class="field">
        <label style="display:flex;align-items:center;justify-content:space-between">
          <span>Subtasks</span>
          <div style="display:flex;align-items:center;gap:8px">
            <span id="st-progress-label" style="font-size:10px;color:var(--muted)"></span>
            <div class="progress-wrap" style="width:80px" id="st-progress-wrap" ><div id="st-progress-bar" class="progress-bar" style="width:0%"></div></div>
          </div>
        </label>
        <div id="subtask-list" style="background:var(--card);border:1px solid var(--border);border-radius:4px;min-height:40px;max-height:200px;overflow-y:auto"></div>
        <div style="display:flex;gap:6px;margin-top:6px">
          <input id="new-subtask-text" type="text" placeholder="Add a subtask…"
                 style="flex:1;background:var(--card);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:'DM Mono',monospace;font-size:12px;padding:8px 10px;outline:none"
                 onkeydown="if(event.key==='Enter'){event.preventDefault();addSubtask()}"
                 onclick="event.stopPropagation()"/>
          <button type="button" onclick="addSubtask()" class="btn btn-ghost btn-sm">＋ Add</button>
        </div>
      </div>

      <!-- Notes -->
      <div class="field">
        <label style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:4px">
          Notes
          <div style="display:flex;gap:4px;flex-wrap:wrap">
            <button type="button" onclick="insertNow()" class="btn btn-ghost btn-sm" style="font-size:9px;padding:2px 8px">⏱ Now</button>
            <button type="button" onclick="insertToday()" class="btn btn-ghost btn-sm" style="font-size:9px;padding:2px 8px">📅 Today</button>
            <button type="button" onclick="insertDateFromField('tm-start','Start')" class="btn btn-ghost btn-sm" style="font-size:9px;padding:2px 8px">▶ Start</button>
            <button type="button" onclick="insertDateFromField('tm-deadline','Deadline')" class="btn btn-ghost btn-sm" style="font-size:9px;padding:2px 8px">⏰ Deadline</button>
          </div>
        </label>
        <textarea id="tm-notes" style="min-height:90px" placeholder="Add notes… use buttons above to insert dates" oninput="tmAutoSave()"></textarea>
      </div>

      <div class="modal-footer" style="flex-shrink:0">
        <button class="btn btn-danger" id="tm-delete-btn" onclick="deleteTaskFromModal()" style="margin-right:auto">✕ Delete</button>
        <button class="btn btn-ghost btn-sm" id="tm-duplicate-btn" onclick="duplicateTaskFromModal()" style="margin-right:8px">⧉ Duplicate</button>
        <button class="btn btn-ghost" onclick="closeTaskModal()">Close</button>
        <button class="btn btn-primary" onclick="saveTask()">Save & Close</button>
      </div>
    </div></div>

    <!-- Completion dialog -->
    <div class="modal-overlay" id="completion-modal" style="z-index:600">
      <div class="modal" style="width:420px;text-align:center">
        <div style="font-size:40px;margin-bottom:12px">🎉</div>
        <h2 style="margin-bottom:8px">All subtasks complete!</h2>
        <p class="text-muted text-sm" style="margin-bottom:24px;line-height:1.8">Every subtask is ticked off. What would you like to do with this task?</p>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button class="btn btn-primary" onclick="completeTaskFully()" style="width:100%">✓ Mark task complete</button>
          <button class="btn btn-ghost" onclick="setTaskRecurring()" style="width:100%">🔁 Make this task recurring</button>
          <button class="btn btn-ghost" onclick="closeCompletionModal()" style="width:100%">Keep open — I'll decide later</button>
        </div>
      </div>
    </div>

    <!-- Recurrence dialog -->
    <div class="modal-overlay" id="recur-modal" style="z-index:700">
      <div class="modal" style="width:400px">
        <h2>Set Recurrence</h2>
        <div class="field">
          <label>Repeat every</label>
          <div style="display:flex;gap:8px">
            <input id="recur-value" type="number" min="1" value="1" style="width:80px;background:var(--card);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:'DM Mono',monospace;font-size:12px;padding:8px 10px;outline:none"/>
            <select id="recur-unit" style="flex:1;background:var(--card);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:'DM Mono',monospace;font-size:12px;padding:8px 10px;outline:none">
              <option value="days">Days</option>
              <option value="weeks" selected>Weeks</option>
              <option value="months">Months</option>
              <option value="years">Years</option>
            </select>
          </div>
        </div>
        <div class="field">
          <label>Reset subtasks on recurrence</label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:4px">
            <input type="checkbox" id="recur-reset-subtasks" checked style="accent-color:var(--accent)"/>
            <span style="font-size:12px">Yes — untick all subtasks when task recurs</span>
          </label>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="document.getElementById('recur-modal').classList.remove('open')">Cancel</button>
          <button class="btn btn-primary" onclick="saveRecurrence()">Save Recurrence</button>
        </div>
      </div>
    </div>`;
  }

  // ── Inner sidebar resizer ────────────────────────────────────────────────────
  function initRolesResizer() {
    const resizer = document.getElementById('roles-resizer');
    const sidebar = document.getElementById('roles-sidebar');
    if (!resizer || !sidebar) return;
    let dragging = false, startX = 0, startW = 0;
    resizer.addEventListener('mousedown', e => {
      dragging = true; startX = e.clientX; startW = sidebar.offsetWidth;
      resizer.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });
    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const newW = Math.min(480, Math.max(160, startW + (e.clientX - startX)));
      sidebar.style.width = newW + 'px';
    });
    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      resizer.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem('rolesSidebarW', sidebar.offsetWidth);
    });
  }

  // ── Attach all handlers ──────────────────────────────────────────────────────
  function attachHandlers() {
    window.selectItem       = (id,type)    => { activeId=id; activeType=type; render(); };
    window.toggleCollapse   = id           => { collapsed[id]=!collapsed[id]; render(); };

    // Drag & drop
    window.handleDragStart  = (e,type,id,groupId,idx) => { dragState={type,id,groupId,idx}; e.dataTransfer.effectAllowed='move'; setTimeout(()=>e.target.style.opacity='0.4',0); };
    window.handleDragEnd    = e            => { e.target.style.opacity='1'; document.querySelectorAll('[data-drop-target]').forEach(el=>el.style.background=''); };
    window.handleDragOver   = e            => { e.preventDefault(); e.currentTarget.style.background='rgba(232,197,71,0.06)'; };
    window.handleDragLeave  = e            => { e.currentTarget.style.background=''; };

    window.handleDropGroup  = async (e, toIdx) => {
      e.currentTarget.style.background='';
      if (dragState.type==='group') await dropGroup(dragState.idx, toIdx);
    };
    window.handleDropRole   = async (e, groupId, toRoleId) => {
      e.currentTarget.style.background='';
      if (dragState.type==='role') await dropRoleInGroup(groupId, dragState.id, toRoleId);
    };
    window.handleDropFolder = async (e, roleId, toFid) => {
      e.currentTarget.style.background='';
      if (dragState.type==='folder') await dropFolder(roleId, dragState.id, toFid);
    };
    window.handleDropTask   = async (e, roleId, toTaskId, folderId) => {
      e.currentTarget.style.background='';
      if (dragState.type==='task') await dropTask(roleId, dragState.id, toTaskId, folderId==='null'?null:folderId);
    };

    // Arrow buttons
    window.moveGroup        = (idx,dir) => moveGroup(idx,dir);
    window.moveRoleInGroup  = (gid,rid,dir) => moveRoleInGroup(gid,rid,dir);
    window.moveUngroupedRole= async (rid,dir) => {
      const ung = ungroupedRoles();
      const idx = ung.findIndex(r=>r.id===rid);
      const moved = dir==='up'?moveUp(ung,idx):moveDown(ung,idx);
      const grouped = roles.filter(r=>r.groupId);
      roles = [...grouped,...moved];
      await saveRoles(); render();
    };
    window.moveFolder       = (rid,fid,dir) => moveFolder(rid,fid,dir);
    window.moveTask         = (rid,tid,fid,dir) => moveTask(rid,tid,fid==='null'?null:fid,dir);

    // Group CRUD
    window.openGroupModal   = openGroupModal;
    window.closeGroupModal  = e => { if(!e||e.target===document.getElementById('group-modal')) document.getElementById('group-modal').classList.remove('open'); };
    window.saveGroup        = saveGroup;
    window.deleteGroup      = deleteGroup;
    window.selectGroupColor = c => { document.getElementById('gm-color').value=c; document.querySelectorAll('[data-color]').forEach(el=>el.style.borderColor=el.dataset.color===c?'#fff':'transparent'); };

    // Role CRUD
    window.openRoleModal    = openRoleModal;
    window.closeRoleModal   = e => { if(!e||e.target===document.getElementById('role-modal')) document.getElementById('role-modal').classList.remove('open'); };
    window.saveRole         = saveRole;
    window.deleteRole       = deleteRole;
    window.setRolePriority  = setRolePriority;
    window.saveRoleNotes    = saveRoleNotes;

    // Task folder CRUD
    window.openTaskFolderModal = openTaskFolderModal;
    window.closeTFolderModal   = e => { if(!e||e.target===document.getElementById('tfolder-modal')) document.getElementById('tfolder-modal').classList.remove('open'); };
    window.saveTaskFolder      = saveTaskFolder;
    window.deleteTaskFolder    = deleteTaskFolder;
    window.selectFolderColor   = c => { document.getElementById('tf-color').value=c; document.querySelectorAll('[data-fcolor]').forEach(el=>el.style.borderColor=el.dataset.fcolor===c?'#fff':'transparent'); };

    // Task CRUD
    window.openTaskModal      = openTaskModal;
    window.closeTaskModal     = e => { if(!e||e.target===document.getElementById('task-modal')) document.getElementById('task-modal').classList.remove('open'); };
    window.applyAssigneeSelect = () => {
      const sel = document.getElementById('tm-assigned-select');
      const inp = document.getElementById('tm-assigned');
      if (sel && inp && sel.value) { inp.value = sel.value; tmAutoSave(); }
    };
    window.saveTask           = saveTask;
    window.toggleTask         = toggleTask;
    window.deleteTask         = deleteTask;
    window.deleteTaskFromModal= deleteTaskFromModal;
    window.addQuickTask       = addQuickTask;

    // ── Date/time copy helpers ──────────────────────────────────────────────────
    window.copyDateToNotes = (fieldId, label) => {
      const val = document.getElementById(fieldId)?.value;
      if (!val) { toast('No date set for ' + label, 'info'); return; }
      const formatted = new Date(val).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      const notes = document.getElementById('tm-notes');
      const insert = `${label}: ${formatted}\n`;
      const pos = notes.selectionStart || notes.value.length;
      notes.value = notes.value.slice(0, pos) + insert + notes.value.slice(pos);
      notes.focus();
      toast(`${label} copied to notes`, 'info');
    };

    window.insertDateFromField = (fieldId, label) => {
      const val = document.getElementById(fieldId)?.value;
      if (!val) { toast('No date set', 'info'); return; }
      const formatted = new Date(val).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      const notes = document.getElementById('tm-notes');
      const pos = notes.selectionStart || notes.value.length;
      const insert = `[${label}: ${formatted}]`;
      notes.value = notes.value.slice(0, pos) + insert + notes.value.slice(pos);
      notes.focus();
      notes.setSelectionRange(pos + insert.length, pos + insert.length);
    };

    window.insertNow = () => {
      const now = new Date().toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
      const notes = document.getElementById('tm-notes');
      const pos = notes.selectionStart || notes.value.length;
      const insert = `[${now}]`;
      notes.value = notes.value.slice(0, pos) + insert + notes.value.slice(pos);
      notes.focus();
      notes.setSelectionRange(pos + insert.length, pos + insert.length);
    };

    window.insertToday = () => {
      const today = new Date().toLocaleDateString([], { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
      const notes = document.getElementById('tm-notes');
      const pos = notes.selectionStart || notes.value.length;
      const insert = `[${today}]`;
      notes.value = notes.value.slice(0, pos) + insert + notes.value.slice(pos);
      notes.focus();
      notes.setSelectionRange(pos + insert.length, pos + insert.length);
    };

    window.copyDurationToNotes = () => {
      const val  = document.getElementById('tm-duration')?.value;
      const unit = document.getElementById('tm-duration-unit')?.value || 'minutes';
      if (!val) { toast('No duration set', 'info'); return; }
      const notes = document.getElementById('tm-notes');
      const pos = notes.selectionStart || notes.value.length;
      const insert = `[Duration: ${val} ${unit}]`;
      notes.value = notes.value.slice(0, pos) + insert + notes.value.slice(pos);
      notes.focus();
    };

    // ── Duplicate helpers ────────────────────────────────────────────────────────
    window.duplicateTaskFromModal = async () => {
      const idx    = parseInt(document.getElementById('tm-idx').value);
      const roleId = document.getElementById('tm-role-id').value;
      if (idx < 0) return;
      const role = getRole(roleId); if (!role) return;
      const original = role.responsibilities[idx];
      const copy = { ...JSON.parse(JSON.stringify(original)), id: Date.now().toString(), done: false, completedAt: null, text: original.text + ' (copy)' };
      role.responsibilities.splice(idx + 1, 0, copy);
      await saveRoles();
      document.getElementById('task-modal').classList.remove('open');
      render();
      toast('Task duplicated ✓', 'success');
    };

    window.duplicateFolder = async (folderId, roleId) => {
      const role = getRole(roleId); if (!role) return;
      const folder = (role.taskFolders||[]).find(f => f.id === folderId); if (!folder) return;
      const newFolder = { ...JSON.parse(JSON.stringify(folder)), id: Date.now().toString(), title: folder.title + ' (copy)' };
      role.taskFolders.push(newFolder);
      // Duplicate tasks inside
      const folderTasks = (role.responsibilities||[]).filter(t => t.folderId === folderId);
      for (const t of folderTasks) {
        role.responsibilities.push({ ...JSON.parse(JSON.stringify(t)), id: (Date.now() + Math.random()).toString(), folderId: newFolder.id, done: false, completedAt: null });
      }
      await saveRoles(); render();
      toast('Folder duplicated ✓', 'success');
    };

    window.duplicateRole = async (roleId) => {
      const role = getRole(roleId); if (!role) return;
      const newRole = JSON.parse(JSON.stringify(role));
      newRole.id    = Date.now().toString();
      newRole.title = role.title + ' (copy)';
      // Give tasks and folders new IDs
      const idMap = {};
      (newRole.taskFolders||[]).forEach(f => { const newId = (Date.now() + Math.random()).toString(); idMap[f.id] = newId; f.id = newId; });
      (newRole.responsibilities||[]).forEach(t => { t.id = (Date.now() + Math.random()).toString(); t.done = false; t.completedAt = null; if (t.folderId && idMap[t.folderId]) t.folderId = idMap[t.folderId]; });
      roles.push(newRole);
      activeId = newRole.id; activeType = 'role';
      await saveRoles(); render();
      toast('Role duplicated ✓', 'success');
    };

        // ── Subtask functions ────────────────────────────────────────────────────────
    window.renderSubtaskList = (subtasks) => {
      const list = document.getElementById('subtask-list');
      if (!list) return;
      const done  = (subtasks||[]).filter(s=>s.done).length;
      const total = (subtasks||[]).length;
      const pct   = total ? Math.round(done/total*100) : 0;
      // Update progress
      const bar   = document.getElementById('st-progress-bar');
      const label = document.getElementById('st-progress-label');
      if (bar)   bar.style.width   = pct + '%';
      if (label) label.textContent = total ? `${done}/${total}` : '';

      if (!subtasks || !subtasks.length) {
        list.innerHTML = '<div style="padding:10px 12px;font-size:11px;color:var(--muted)">No subtasks yet</div>';
        return;
      }
      let _stDrag = null;
      list.innerHTML = subtasks.map((s,i) => `
        <div draggable="true"
             ondragstart="stDragStart(event,${i})"
             ondragend="stDragEnd(event)"
             ondragover="stDragOver(event)"
             ondragleave="stDragLeave(event)"
             ondrop="stDrop(event,${i})"
             style="display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--border);transition:background 0.1s"
             onmouseover="this.style.background='var(--surface)'" onmouseout="this.style.background=''">
          <span style="cursor:grab;color:var(--muted);font-size:11px;flex-shrink:0">⠿</span>
          <input type="checkbox" ${s.done?'checked':''} onchange="toggleSubtask(${i})"
                 style="accent-color:var(--accent);width:14px;height:14px;cursor:pointer;flex-shrink:0"/>
          <span style="flex:1;font-size:12px;${s.done?'text-decoration:line-through;color:var(--muted)':''}">${esc(s.text)}</span>
          <div style="display:flex;flex-direction:column;gap:0px">
            <button onclick="moveSubtask(${i},'up')" ${i===0?'disabled':''} style="background:none;border:none;color:${i===0?'var(--border)':'var(--muted)'};cursor:${i===0?'default':'pointer'};font-size:8px;padding:0 2px;line-height:1">▲</button>
            <button onclick="moveSubtask(${i},'down')" ${i===subtasks.length-1?'disabled':''} style="background:none;border:none;color:${i===subtasks.length-1?'var(--border)':'var(--muted)'};cursor:${i===subtasks.length-1?'default':'pointer'};font-size:8px;padding:0 2px;line-height:1">▼</button>
          </div>
          <button onclick="deleteSubtask(${i})" style="background:none;border:none;color:var(--danger);cursor:pointer;opacity:0.3;font-size:11px;padding:0 4px"
                  onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.3">✕</button>
        </div>`).join('');

      // Subtask drag handlers (re-set each render)
      window.stDragStart = (e,i) => { _stDrag=i; setTimeout(()=>e.target.style.opacity='0.4',0); };
      window.stDragEnd   = e     => { e.target.style.opacity='1'; };
      window.stDragOver  = e     => { e.preventDefault(); e.currentTarget.style.background='rgba(232,197,71,0.06)'; };
      window.stDragLeave = e     => { e.currentTarget.style.background=''; };
      window.stDrop      = async (e, toIdx) => {
        e.currentTarget.style.background='';
        if (_stDrag===null||_stDrag===toIdx) return;
        const idx=parseInt(document.getElementById('tm-idx').value);
        const roleId=document.getElementById('tm-role-id').value;
        const role=getRole(roleId); if(!role) return;
        const task=role.responsibilities[idx]; if(!task||!task.subtasks) return;
        const copy=[...task.subtasks]; const [item]=copy.splice(_stDrag,1); copy.splice(toIdx,0,item);
        task.subtasks=copy; await saveRoles();
        window.renderSubtaskList(task.subtasks);
      };
      window.moveSubtask = async (i, dir) => {
        const to = dir==='up'?i-1:i+1;
        const idx=parseInt(document.getElementById('tm-idx').value);
        const roleId=document.getElementById('tm-role-id').value;
        const role=getRole(roleId); if(!role) return;
        const task=role.responsibilities[idx]; if(!task||!task.subtasks) return;
        if(to<0||to>=task.subtasks.length) return;
        const copy=[...task.subtasks]; const [item]=copy.splice(i,1); copy.splice(to,0,item);
        task.subtasks=copy; await saveRoles();
        window.renderSubtaskList(task.subtasks);
      };
    };

    window.addSubtask = async () => {
      const input = document.getElementById('new-subtask-text');
      const text  = input?.value.trim(); if (!text) return;
      const idx    = parseInt(document.getElementById('tm-idx').value);
      const roleId = document.getElementById('tm-role-id').value;
      const role   = getRole(roleId); if (!role) return;

      // Auto-save task first if new
      if (idx < 0 || !role.responsibilities[idx]) {
        await tmAutoSaveNow();
      }

      const newIdx = parseInt(document.getElementById('tm-idx').value);
      const task   = role.responsibilities[newIdx]; if (!task) return;
      if (!task.subtasks) task.subtasks = [];
      task.subtasks.push({ id: Date.now().toString(), text, done: false });
      await saveRoles();
      input.value = '';
      window.renderSubtaskList(task.subtasks);
      tmAutoSaveIndicator();
    };

    window.toggleSubtask = async (i) => {
      const idx    = parseInt(document.getElementById('tm-idx').value);
      const roleId = document.getElementById('tm-role-id').value;
      const role   = getRole(roleId); if (!role) return;
      const task   = role.responsibilities[idx]; if (!task) return;
      task.subtasks[i].done = !task.subtasks[i].done;
      await saveRoles();
      window.renderSubtaskList(task.subtasks);
      render();
      // Check if all done
      const allDone = task.subtasks.length > 0 && task.subtasks.every(s => s.done);
      if (allDone && !task.done) {
        setTimeout(() => document.getElementById('completion-modal').classList.add('open'), 300);
      }
    };

    window.deleteSubtask = async (i) => {
      const idx    = parseInt(document.getElementById('tm-idx').value);
      const roleId = document.getElementById('tm-role-id').value;
      const role   = getRole(roleId); if (!role) return;
      const task   = role.responsibilities[idx]; if (!task) return;
      task.subtasks.splice(i, 1);
      await saveRoles();
      window.renderSubtaskList(task.subtasks);
    };

    // Auto-save immediately (used before adding subtasks to a new task)
    async function tmAutoSaveNow() {
      const text = document.getElementById('tm-text').value.trim(); if (!text) return;
      const roleId = document.getElementById('tm-role-id').value;
      const role   = getRole(roleId); if (!role) return;
      const data   = collectTaskDataFromModal();
      const newTask = { id: Date.now().toString(), done: false, subtasks: [], ...data };
      role.responsibilities.push(newTask);
      document.getElementById('tm-idx').value = role.responsibilities.length - 1;
      await saveRoles();
    }

    function tmAutoSaveIndicator() {
      const ind = document.getElementById('tm-autosave-indicator');
      if (ind) { ind.textContent='✓ Saved'; ind.style.opacity='1'; setTimeout(()=>ind.style.opacity='0',2000); }
    }

    // ── Completion dialog ────────────────────────────────────────────────────────
    window.completeTaskFully = async () => {
      const idx    = parseInt(document.getElementById('tm-idx').value);
      const roleId = document.getElementById('tm-role-id').value;
      const role   = getRole(roleId); if (!role) return;
      const task   = role.responsibilities[idx]; if (!task) return;
      task.done        = true;
      task.completedAt = new Date().toISOString();
      document.getElementById('tm-completed').value = toLocalDT(task.completedAt);
      await saveRoles();
      document.getElementById('completion-modal').classList.remove('open');
      document.getElementById('task-modal').classList.remove('open');
      render(); updateOverdueBadge();
      toast('Task completed ✓', 'success');
    };

    window.setTaskRecurring = () => {
      document.getElementById('completion-modal').classList.remove('open');
      document.getElementById('recur-modal').classList.add('open');
    };

    window.closeCompletionModal = () => {
      document.getElementById('completion-modal').classList.remove('open');
    };

    window.saveRecurrence = async () => {
      const idx    = parseInt(document.getElementById('tm-idx').value);
      const roleId = document.getElementById('tm-role-id').value;
      const role   = getRole(roleId); if (!role) return;
      const task   = role.responsibilities[idx]; if (!task) return;
      const value  = parseInt(document.getElementById('recur-value').value) || 1;
      const unit   = document.getElementById('recur-unit').value;
      const reset  = document.getElementById('recur-reset-subtasks').checked;
      task.recur = { value, unit, resetSubtasks: reset };
      // Calculate next deadline
      if (task.deadline) {
        const d = new Date(task.deadline);
        if (unit==='days')   d.setDate(d.getDate() + value);
        if (unit==='weeks')  d.setDate(d.getDate() + value*7);
        if (unit==='months') d.setMonth(d.getMonth() + value);
        if (unit==='years')  d.setFullYear(d.getFullYear() + value);
        task.deadline = d.toISOString();
        document.getElementById('tm-deadline').value = toLocalDT(task.deadline);
      }
      // Reset subtasks if requested
      if (reset && task.subtasks) task.subtasks.forEach(s => s.done = false);
      task.done = false; task.completedAt = null;
      document.getElementById('tm-completed').value = '';
      await saveRoles();
      document.getElementById('recur-modal').classList.remove('open');
      window.renderSubtaskList(task.subtasks||[]);
      render();
      toast(`Task set to recur every ${value} ${unit} ✓`, 'success');
    };

        window.setProgressPeriod = async (roleId, period) => {
      const role = getRole(roleId); if (!role) return;
      role.progressPeriod = period;
      await saveRoles(); render();
    };

    window.toggleExclude = async (roleId, idx) => {
      const role = getRole(roleId); if (!role) return;
      const task = role.responsibilities[idx]; if (!task) return;
      task.excludeFromPct = !task.excludeFromPct;
      await saveRoles(); render();
      toast(task.excludeFromPct ? '⊘ Excluded from progress %' : 'Included in progress %', 'info');
    };

        window.openCreateEventModal = rid => { navigate('calendar'); setTimeout(()=>{ if(window.openNewEventModal) window.openNewEventModal(rid); },400); };
    window.syncNotesToOneNote   = syncNotesToOneNote;
    setTimeout(loadLinkedEvents, 100);
  }

  // ── Group CRUD ───────────────────────────────────────────────────────────────
  function openGroupModal(editId) {
    const g = editId?getGroup(editId):null;
    document.getElementById('gm-title').textContent = g?'Edit Group':'New Role Group';
    document.getElementById('gm-id').value      = g?.id       || '';
    document.getElementById('gm-name').value    = g?.title    || '';
    document.getElementById('gm-deadline').value= g?.deadline ? g.deadline.slice(0,10):'';
    document.getElementById('gm-notes').value   = g?.notes    || '';
    document.getElementById('gm-color').value   = g?.color    || FOLDER_COLORS[0];
    document.querySelectorAll('[data-color]').forEach(el=>el.style.borderColor=el.dataset.color===(g?.color||FOLDER_COLORS[0])?'#fff':'transparent');
    document.getElementById('group-modal').classList.add('open');
    setTimeout(()=>document.getElementById('gm-name').focus(),100);
  }
  async function saveGroup() {
    const title=document.getElementById('gm-name').value.trim(); if(!title){document.getElementById('gm-name').focus();return;}
    const editId=document.getElementById('gm-id').value;
    const data={id:editId||Date.now().toString(),title,deadline:document.getElementById('gm-deadline').value||null,notes:document.getElementById('gm-notes').value.trim()||null,color:document.getElementById('gm-color').value};
    if(editId){const idx=roleGroups.findIndex(g=>g.id===editId);if(idx>=0)roleGroups[idx]=data;}else{roleGroups.push(data);activeId=data.id;activeType='group';}
    await saveGroups(); document.getElementById('group-modal').classList.remove('open'); render(); toast(editId?'Group updated ✓':'Group created ✓','success');
  }
  async function deleteGroup(id) {
    if(!confirm('Delete this group? Roles will become ungrouped.'))return;
    roleGroups=roleGroups.filter(g=>g.id!==id); roles.forEach(r=>{if(r.groupId===id)r.groupId=null;});
    activeId=roles.length?roles[0].id:roleGroups.length?roleGroups[0].id:null;
    activeType=roles.length?'role':roleGroups.length?'group':null;
    await saveAll(); render(); toast('Group deleted','info');
  }

  // ── Role CRUD ─────────────────────────────────────────────────────────────────
  function openRoleModal(editId, preGroupId) {
    const r=editId?getRole(editId):null;
    document.getElementById('rm-title-h').textContent=r?'Edit Role':'Add Role';
    document.getElementById('rm-id').value      =r?.id      ||'';
    document.getElementById('rm-title').value   =r?.title   ||'';
    document.getElementById('rm-dept').value    =r?.dept    ||'';
    document.getElementById('rm-priority').value=r?.priority||'medium';
    document.getElementById('rm-group').value   =r?.groupId ||preGroupId||'';
    document.getElementById('role-modal').classList.add('open');
    setTimeout(()=>document.getElementById('rm-title').focus(),100);
  }
  async function saveRole() {
    const title=document.getElementById('rm-title').value.trim(); if(!title){document.getElementById('rm-title').focus();return;}
    const editId=document.getElementById('rm-id').value;
    const data={id:editId||Date.now().toString(),title,dept:document.getElementById('rm-dept').value.trim(),priority:document.getElementById('rm-priority').value,groupId:document.getElementById('rm-group').value||null,responsibilities:[],taskFolders:[],notes:''};
    if(editId){const idx=roles.findIndex(r=>r.id===editId);if(idx>=0){data.responsibilities=roles[idx].responsibilities;data.taskFolders=roles[idx].taskFolders;data.notes=roles[idx].notes;roles[idx]=data;}}
    else{roles.push(data);activeId=data.id;activeType='role';}
    await saveRoles(); document.getElementById('role-modal').classList.remove('open'); render(); toast(editId?'Role updated ✓':'Role created ✓','success');
  }
  async function deleteRole(id) {
    if(!confirm('Delete this role and all its tasks?'))return;
    roles=roles.filter(r=>r.id!==id);
    activeId=roles.length?roles[0].id:roleGroups.length?roleGroups[0].id:null;
    activeType=roles.length?'role':roleGroups.length?'group':null;
    await saveRoles(); render(); toast('Role deleted','info');
  }
  async function setRolePriority(p){const role=getRole(activeId);if(!role)return;role.priority=p;await saveRoles();render();}
  async function saveRoleNotes(){const el=document.getElementById('role-notes');if(!el)return;const role=getRole(activeId);if(!role)return;role.notes=el.value;await saveRoles();}

  // ── Task Folder CRUD ──────────────────────────────────────────────────────────
  function openTaskFolderModal(folderId, roleId) {
    const role=getRole(roleId); const folder=folderId?(role?.taskFolders||[]).find(f=>f.id===folderId):null;
    document.getElementById('tf-title').textContent=folder?'Edit Folder':'New Task Folder';
    document.getElementById('tf-id').value      =folder?.id      ||'';
    document.getElementById('tf-role-id').value =roleId;
    document.getElementById('tf-name').value    =folder?.title   ||'';
    document.getElementById('tf-deadline').value=folder?.deadline?folder.deadline.slice(0,10):'';
    document.getElementById('tf-notes').value   =folder?.notes   ||'';
    document.getElementById('tf-color').value   =folder?.color   ||FOLDER_COLORS[0];
    document.querySelectorAll('[data-fcolor]').forEach(el=>el.style.borderColor=el.dataset.fcolor===(folder?.color||FOLDER_COLORS[0])?'#fff':'transparent');
    document.getElementById('tfolder-modal').classList.add('open');
    setTimeout(()=>document.getElementById('tf-name').focus(),100);
  }
  async function saveTaskFolder() {
    const title=document.getElementById('tf-name').value.trim(); if(!title){document.getElementById('tf-name').focus();return;}
    const roleId=document.getElementById('tf-role-id').value; const editId=document.getElementById('tf-id').value;
    const role=getRole(roleId); if(!role)return; if(!role.taskFolders)role.taskFolders=[];
    const data={id:editId||Date.now().toString(),title,deadline:document.getElementById('tf-deadline').value||null,notes:document.getElementById('tf-notes').value.trim()||null,color:document.getElementById('tf-color').value};
    if(editId){const idx=role.taskFolders.findIndex(f=>f.id===editId);if(idx>=0)role.taskFolders[idx]=data;}else role.taskFolders.push(data);
    await saveRoles(); document.getElementById('tfolder-modal').classList.remove('open'); render(); toast(editId?'Folder updated ✓':'Folder created ✓','success');
  }
  async function deleteTaskFolder(folderId, roleId) {
    if(!confirm('Delete folder? Tasks inside move to General Tasks.'))return;
    const role=getRole(roleId); if(!role)return;
    role.taskFolders=(role.taskFolders||[]).filter(f=>f.id!==folderId);
    (role.responsibilities||[]).forEach(t=>{if(t.folderId===folderId)t.folderId=null;});
    await saveRoles(); render(); toast('Folder deleted','info');
  }

  // ── Task CRUD ─────────────────────────────────────────────────────────────────
  function openTaskModal(idx, roleId, folderId) {
    const role=getRole(roleId); const t=idx>=0?(role?.responsibilities||[])[idx]:null;
    document.getElementById('task-modal-title').textContent=t?'Edit Task':'New Task';
    document.getElementById('tm-idx').value           =idx;
    document.getElementById('tm-role-id').value       =roleId;
    document.getElementById('tm-folder-id').value     =folderId||'';
    document.getElementById('tm-text').value          =t?.text        ||'';
    document.getElementById('tm-priority').value      =t?.priority    ||'';
    document.getElementById('tm-assigned').value      =t?.assignedTo  ||'';
    document.getElementById('tm-start').value         =toLocalDT(t?.startDate)  ||'';
    document.getElementById('tm-deadline').value      =toLocalDT(t?.deadline)   ||'';
    document.getElementById('tm-completed').value     =toLocalDT(t?.completedAt)||'';
    document.getElementById('tm-duration').value      =t?.duration    ||'';
    document.getElementById('tm-duration-unit').value =t?.durationUnit||'minutes';
    document.getElementById('tm-notes').value         =t?.notes       ||'';
    document.getElementById('tm-delete-btn').style.display    =t?'inline-flex':'none';
    document.getElementById('tm-duplicate-btn').style.display =t?'inline-flex':'none';
    const sel=document.getElementById('tm-folder-select');
    sel.innerHTML=`<option value="">— General Tasks —</option>`+(role?.taskFolders||[]).map(f=>`<option value="${f.id}">${esc(f.title)}</option>`).join('');
    sel.value=t?.folderId||folderId||'';
    // Populate team dropdown
    getTeamForDropdown().then(team => {
      const asel = document.getElementById('tm-assigned-select');
      if (asel) {
        asel.innerHTML = `<option value="">— Select from team —</option>` +
          team.map(m => `<option value="${esc(m.name)}">${esc(m.name)}${m.dept?' · '+esc(m.dept):''}</option>`).join('');
        // Pre-select if current assignee matches a team member
        const current = t?.assignedTo||'';
        const match = team.find(m => m.name === current);
        asel.value = match ? current : '';
      }
    });
    // Render subtasks
    renderSubtaskList(t?.subtasks||[]);
    document.getElementById('task-modal').classList.add('open');
    // Clear autosave indicator
    const ind = document.getElementById('tm-autosave-indicator');
    if (ind) { ind.textContent=''; ind.style.opacity='0'; }
    setTimeout(()=>document.getElementById('tm-text').focus(),100);
  }
  function collectTaskDataFromModal() {
    return {
      text:         document.getElementById('tm-text').value.trim(),
      priority:     document.getElementById('tm-priority').value||null,
      assignedTo:   document.getElementById('tm-assigned').value.trim()||null,
      startDate:    document.getElementById('tm-start').value||null,
      deadline:     document.getElementById('tm-deadline').value||null,
      completedAt:  document.getElementById('tm-completed').value||null,
      duration:     document.getElementById('tm-duration').value?parseFloat(document.getElementById('tm-duration').value):null,
      durationUnit: document.getElementById('tm-duration-unit').value||'minutes',
      folderId:     document.getElementById('tm-folder-select').value||null,
      notes:        document.getElementById('tm-notes').value.trim()||null,
    };
  }

  // Auto-save debounce
  let _autoSaveTimer = null;
  function tmAutoSave() {
    if (_autoSaveTimer) clearTimeout(_autoSaveTimer);
    _autoSaveTimer = setTimeout(async () => {
      const idx    = parseInt(document.getElementById('tm-idx').value);
      const roleId = document.getElementById('tm-role-id').value;
      if (!roleId) return;
      const text = document.getElementById('tm-text').value.trim();
      if (!text) return; // don't save empty
      const role = getRole(roleId); if (!role) return;
      const data = collectTaskDataFromModal();
      if (idx >= 0 && role.responsibilities[idx]) {
        const existing = role.responsibilities[idx];
        role.responsibilities[idx] = { ...existing, ...data };
      } else if (idx < 0) {
        // New task — save immediately to get an idx
        const newTask = { id: Date.now().toString(), done: false, subtasks: [], ...data };
        role.responsibilities.push(newTask);
        const newIdx = role.responsibilities.length - 1;
        document.getElementById('tm-idx').value = newIdx;
        await saveRoles();
        const ind = document.getElementById('tm-autosave-indicator');
        if (ind) { ind.textContent='✓ Saved'; ind.style.opacity='1'; setTimeout(()=>ind.style.opacity='0',2000); }
        return;
      }
      await saveRoles();
      const ind = document.getElementById('tm-autosave-indicator');
      if (ind) { ind.textContent='✓ Saved'; ind.style.opacity='1'; setTimeout(()=>ind.style.opacity='0',2000); }
    }, 600);
  }

  async function saveTask() {
    const text=document.getElementById('tm-text').value.trim(); if(!text){document.getElementById('tm-text').focus();return;}
    const idx=parseInt(document.getElementById('tm-idx').value); const roleId=document.getElementById('tm-role-id').value;
    const role=getRole(roleId); if(!role)return;
    const data = collectTaskDataFromModal();
    if(idx>=0&&role.responsibilities[idx]){
      const existing = role.responsibilities[idx];
      role.responsibilities[idx]={...existing,...data};
      if(role.responsibilities[idx].done&&!role.responsibilities[idx].completedAt) role.responsibilities[idx].completedAt=new Date().toISOString();
    } else {
      role.responsibilities.push({id:Date.now().toString(),done:false,subtasks:[],...data});
    }
    await saveRoles(); document.getElementById('task-modal').classList.remove('open'); render(); updateOverdueBadge(); toast(idx>=0?'Task updated ✓':'Task added ✓','success');
  }
  async function addQuickTask(roleId, folderId) {
    const inputId=folderId?`qt-${folderId}`:'qt-general'; const text=document.getElementById(inputId)?.value.trim(); if(!text)return;
    const role=getRole(roleId); if(!role)return;
    role.responsibilities.push({id:Date.now().toString(),text,done:false,folderId:folderId||null});
    await saveRoles(); render(); updateOverdueBadge();
  }
  async function toggleTask(roleId, idx) {
    const role=getRole(roleId); if(!role)return;
    role.responsibilities[idx].done=!role.responsibilities[idx].done;
    if(role.responsibilities[idx].done&&!role.responsibilities[idx].completedAt)role.responsibilities[idx].completedAt=new Date().toISOString();
    await saveRoles(); render(); updateOverdueBadge();
  }
  async function deleteTask(roleId, idx) {
    const role=getRole(roleId); if(!role)return;
    role.responsibilities.splice(idx,1); await saveRoles(); render();
  }
  async function deleteTaskFromModal() {
    const idx=parseInt(document.getElementById('tm-idx').value); const roleId=document.getElementById('tm-role-id').value;
    if(idx<0)return; document.getElementById('task-modal').classList.remove('open'); await deleteTask(roleId,idx);
  }

  // ── OneNote / Calendar ────────────────────────────────────────────────────────
  async function syncNotesToOneNote(roleId) {
    const status=await window.api.auth.status(); if(!status.loggedIn){toast('Sign in to Microsoft first','error');return;}
    const role=getRole(roleId); const syncSectionId=await window.api.store.get('sync.oneNoteSectionId');
    if(!syncSectionId){toast('Set a sync section in Settings','error');return;}
    toast('Syncing…','info');
    if(role.linkedPageId){const r=await window.api.onenote.updatePage(role.linkedPageId,role.notes||'');toast(r.success?'OneNote updated ✓':'Failed: '+r.error,r.success?'success':'error');}
    else{const content=`<p>${(role.notes||'').replace(/\n/g,'<br/>')}</p>`;const r=await window.api.onenote.createPage(syncSectionId,role.title,content);if(r.success){role.linkedPageId=r.page?.id;await saveRoles();toast('Created ✓','success');}else toast('Failed: '+r.error,'error');}
  }
  async function loadLinkedEvents() {
    const el=document.getElementById('linked-events-list'); if(!el||activeType!=='role')return;
    const status=await window.api.auth.status(); if(!status.loggedIn){el.innerHTML=`<span class="text-muted text-sm">Sign in to see calendar events</span>`;return;}
    const result=await window.api.calendar.getEvents(14); if(result.error){el.innerHTML=`<span class="text-muted text-sm">Could not load</span>`;return;}
    const linked=(result.events||[]).filter(e=>e.roleId===activeId);
    if(!linked.length){el.innerHTML=`<span class="text-muted text-sm">No meetings linked to this role</span>`;return;}
    el.innerHTML=linked.map(e=>`<div style="display:flex;align-items:center;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)"><span class="chip chip-info">📅</span><div><div style="font-size:12px">${esc(e.subject)}</div><div class="text-muted text-sm">${new Date(e.start).toLocaleString()}</div></div></div>`).join('');
  }

  render();
}
