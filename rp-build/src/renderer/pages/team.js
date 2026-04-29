/**
 * team.js — Team directory with full drag+arrow reordering
 * Reorderable: department sections, members within departments
 */

const DEFAULT_TEAM = [
  { id:'1',  name:'Eddie Warren',       dept:'Management', company:'Warren Dev', email:'', jobRole:'Managing Director' },
  { id:'2',  name:'Charlie Warren',     dept:'Management', company:'Warren Dev', email:'', jobRole:'' },
  { id:'3',  name:'Joe Heraty',         dept:'', company:'', email:'', jobRole:'' },
  { id:'4',  name:'Chris Ball',         dept:'', company:'', email:'', jobRole:'' },
  { id:'5',  name:'Sy Brighton',        dept:'', company:'', email:'', jobRole:'' },
  { id:'6',  name:'Christine Albaniel', dept:'', company:'', email:'', jobRole:'' },
  { id:'7',  name:'Louis Wixon',        dept:'', company:'', email:'', jobRole:'' },
  { id:'8',  name:'Benet Thomas',       dept:'', company:'', email:'', jobRole:'' },
  { id:'9',  name:'Eisha Sami',         dept:'', company:'', email:'', jobRole:'' },
  { id:'10', name:'Khallum Bashir',     dept:'', company:'', email:'', jobRole:'' },
  { id:'11', name:'Mike Kerrison',      dept:'', company:'', email:'', jobRole:'' },
  { id:'12', name:'Niamh Mullarkey',    dept:'', company:'', email:'', jobRole:'' },
];

async function render_team(container) {
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  let team       = await window.api.store.get('team') || [];
  let deptOrder  = await window.api.store.get('team.deptOrder') || [];
  let filterDept = '';
  let searchQ    = '';
  let dragState  = {};

  if (!team.length) {
    team = DEFAULT_TEAM;
    await window.api.store.set('team', team);
  }

  async function saveTeam()      { await window.api.store.set('team', team); }
  async function saveDeptOrder() { await window.api.store.set('team.deptOrder', deptOrder); }

  // Get ordered list of departments
  function getOrderedDepts() {
    const allDepts = [...new Set(team.map(m => m.dept).filter(Boolean))];
    // Add any not yet in deptOrder
    for (const d of allDepts) { if (!deptOrder.includes(d)) deptOrder.push(d); }
    // Remove any no longer in use
    deptOrder = deptOrder.filter(d => allDepts.includes(d));
    return deptOrder;
  }

  function moveItem(arr, from, to) {
    const copy = [...arr];
    const [item] = copy.splice(from, 1);
    copy.splice(to, 0, item);
    return copy;
  }

  function arrowBtns(upFn, downFn, isFirst, isLast) {
    return `<div style="display:flex;flex-direction:column;gap:1px;flex-shrink:0">
      <button onclick="event.stopPropagation();${upFn}" ${isFirst?'disabled':''} title="Move up"
        style="background:none;border:none;color:${isFirst?'var(--border)':'var(--muted)'};cursor:${isFirst?'default':'pointer'};font-size:9px;line-height:1;padding:1px 3px">▲</button>
      <button onclick="event.stopPropagation();${downFn}" ${isLast?'disabled':''} title="Move down"
        style="background:none;border:none;color:${isLast?'var(--border)':'var(--muted)'};cursor:${isLast?'default':'pointer'};font-size:9px;line-height:1;padding:1px 3px">▼</button>
    </div>`;
  }

  function memberColor(id) {
    const colors = ['#e8c547','#c47a3a','#4a9a6a','#4a8aca','#c45a3a','#9a4aca','#ca4a7a','#4acaca','#7aca4a','#ca9a4a','#4a7aca','#ca4a9a'];
    return colors[parseInt(id||0) % colors.length];
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  function render() {
    const depts   = getOrderedDepts();
    const visible = team.filter(m => {
      const matchDept   = !filterDept || m.dept === filterDept;
      const matchSearch = !searchQ || m.name.toLowerCase().includes(searchQ.toLowerCase()) || (m.dept||'').toLowerCase().includes(searchQ.toLowerCase());
      return matchDept && matchSearch;
    });

    container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div><h1>Team</h1><div class="subtitle">Drag ⠿ or use ▲▼ to reorder members and departments</div></div>
        <button class="btn btn-primary" onclick="openMemberModal(null)">＋ Add Member</button>
      </div>

      <div style="display:flex;gap:10px;margin-bottom:20px;flex-wrap:wrap;align-items:center">
        <input type="text" placeholder="Search…" value="${esc(searchQ)}" oninput="teamSearch(this.value)"
               style="background:var(--card);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:'DM Mono',monospace;font-size:12px;padding:8px 12px;outline:none;width:220px"/>
        <select onchange="teamFilterDept(this.value)"
                style="background:var(--card);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:'DM Mono',monospace;font-size:12px;padding:8px 12px;outline:none">
          <option value="">All Departments</option>
          ${depts.map(d=>`<option value="${esc(d)}" ${filterDept===d?'selected':''}>${esc(d)}</option>`).join('')}
        </select>
        <span class="text-muted text-sm">${visible.length} of ${team.length} members</span>
      </div>

      <!-- Dept sections with drag reordering -->
      <div id="dept-list">
        ${renderDeptSections(depts, visible)}
      </div>

      <!-- Ungrouped -->
      ${renderUngrouped(visible)}

    </div>
    ${memberModalHtml(depts)}`;

    attachHandlers();
  }

  function renderDeptSections(depts, visible) {
    return depts.map((dept, di) => {
      const members = visible.filter(m => m.dept === dept);
      if (!members.length && searchQ) return '';
      const allMembers = team.filter(m => m.dept === dept);

      return `
      <div class="card" style="margin-bottom:16px"
           draggable="true"
           ondragstart="deptDragStart(event,'${esc(dept)}',${di})"
           ondragend="dragEnd(event)"
           ondragover="dragOver(event)"
           ondragleave="dragLeave(event)"
           ondrop="deptDrop(event,${di})">
        <!-- Dept header -->
        <div class="card-header" style="cursor:grab">
          <div style="display:flex;align-items:center;gap:10px;flex:1">
            <span style="color:var(--muted);font-size:12px;cursor:grab" title="Drag to reorder department">⠿</span>
            <h3 style="text-transform:none;letter-spacing:0;font-size:13px;color:var(--text)">${esc(dept)}</h3>
            <span class="chip chip-muted">${allMembers.length} members</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            ${arrowBtns(`moveDept(${di},'up')`, `moveDept(${di},'down')`, di===0, di===depts.length-1)}
          </div>
        </div>
        <!-- Members in this dept -->
        <div style="padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px" id="dept-members-${di}">
          ${members.map((m, mi) => renderMemberCard(m, mi, members.length, dept, di)).join('')}
        </div>
      </div>`;
    }).join('');
  }

  function renderUngrouped(visible) {
    const ungrouped = visible.filter(m => !m.dept);
    const allUngrouped = team.filter(m => !m.dept);
    if (!ungrouped.length) return '';
    return `
    <div class="card" style="margin-bottom:16px">
      <div class="card-header">
        <h3 style="text-transform:none;letter-spacing:0;font-size:13px;color:var(--text)">No Department</h3>
        <span class="chip chip-muted">${allUngrouped.length}</span>
      </div>
      <div style="padding:12px;display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px">
        ${ungrouped.map((m,mi) => renderMemberCard(m, mi, ungrouped.length, null, -1)).join('')}
      </div>
    </div>`;
  }

  function renderMemberCard(m, mi, total, dept, di) {
    const initials = m.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
    const color    = memberColor(m.id);
    const teamIdx  = team.findIndex(x=>x.id===m.id);
    const deptStr  = dept ? esc(dept) : 'null';

    return `
    <div draggable="true"
         ondragstart="memberDragStart(event,'${m.id}','${deptStr}',${mi})"
         ondragend="dragEnd(event)"
         ondragover="dragOver(event)"
         ondragleave="dragLeave(event)"
         ondrop="memberDrop(event,'${m.id}','${deptStr}')"
         class="card" style="cursor:pointer;transition:border-color 0.12s;border-color:var(--border)"
         onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'"
         onclick="openMemberModal('${m.id}')">
      <div style="display:flex;align-items:center;gap:10px;padding:12px">
        <span style="color:var(--muted);font-size:12px;cursor:grab;flex-shrink:0" title="Drag to reorder">⠿</span>
        <div style="width:36px;height:36px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#0e0e0e;flex-shrink:0">${initials}</div>
        <div style="min-width:0;flex:1">
          <div style="font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(m.name)}</div>
          ${m.jobRole ? `<div style="font-size:10px;color:var(--muted)">${esc(m.jobRole)}</div>` : ''}
          ${m.company ? `<div style="font-size:10px;color:var(--muted)">${esc(m.company)}</div>` : ''}
        </div>
        <div style="display:flex;flex-direction:column;gap:1px" onclick="event.stopPropagation()">
          ${arrowBtns(`moveMemberInDept('${m.id}','${deptStr}','up')`, `moveMemberInDept('${m.id}','${deptStr}','down')`, mi===0, mi===total-1)}
        </div>
      </div>
    </div>`;
  }

  // ── Drag handlers ──────────────────────────────────────────────────────────
  function attachHandlers() {
    window.teamSearch     = v => { searchQ=v; render(); };
    window.teamFilterDept = v => { filterDept=v; render(); };
    window.openMemberModal  = openMemberModal;
    window.closeMemberModal = e => { if(!e||e.target===document.getElementById('member-modal')) document.getElementById('member-modal').classList.remove('open'); };
    window.saveMember     = saveMember;
    window.deleteMember   = deleteMember;

    // Dept drag
    window.deptDragStart = (e, dept, idx) => {
      dragState = { type:'dept', dept, idx };
      setTimeout(() => e.target.style.opacity='0.4', 0);
    };
    window.deptDrop = async (e, toIdx) => {
      e.currentTarget.style.background='';
      if (dragState.type !== 'dept') return;
      deptOrder = moveItem(deptOrder, dragState.idx, toIdx);
      await saveDeptOrder(); render();
    };

    // Member drag
    window.memberDragStart = (e, memberId, dept, idx) => {
      dragState = { type:'member', memberId, dept, idx };
      setTimeout(() => e.target.style.opacity='0.4', 0);
    };
    window.memberDrop = async (e, toMemberId, dept) => {
      e.currentTarget.style.background='';
      if (dragState.type !== 'member' || dragState.memberId === toMemberId) return;
      // Reorder within the same dept group
      const deptMembers = team.filter(m => (m.dept||'null') === dept);
      const fromIdx = deptMembers.findIndex(m => m.id === dragState.memberId);
      const toIdx   = deptMembers.findIndex(m => m.id === toMemberId);
      if (fromIdx < 0 || toIdx < 0) return;
      const reordered = moveItem(deptMembers, fromIdx, toIdx);
      // Apply back to team array preserving other depts
      const others = team.filter(m => (m.dept||'null') !== dept);
      team = [...others, ...reordered];
      await saveTeam(); render();
    };

    // Arrow reorder: dept
    window.moveDept = async (idx, dir) => {
      const depts = getOrderedDepts();
      const newIdx = dir==='up' ? idx-1 : idx+1;
      if (newIdx < 0 || newIdx >= depts.length) return;
      deptOrder = moveItem(deptOrder, idx, newIdx);
      await saveDeptOrder(); render();
    };

    // Arrow reorder: member within dept
    window.moveMemberInDept = async (memberId, dept, dir) => {
      const deptMembers = team.filter(m => (m.dept||'null') === dept);
      const idx = deptMembers.findIndex(m => m.id === memberId);
      const newIdx = dir==='up' ? idx-1 : idx+1;
      if (newIdx < 0 || newIdx >= deptMembers.length) return;
      const reordered = moveItem(deptMembers, idx, newIdx);
      const others = team.filter(m => (m.dept||'null') !== dept);
      team = [...others, ...reordered];
      await saveTeam(); render();
    };

    // Shared drag visual
    window.dragOver  = e => { e.preventDefault(); e.currentTarget.style.background='rgba(232,197,71,0.06)'; };
    window.dragLeave = e => { e.currentTarget.style.background=''; };
    window.dragEnd   = e => { e.target.style.opacity='1'; document.querySelectorAll('[ondragover]').forEach(el=>el.style.background=''); };
  }

  // ── Member modal ────────────────────────────────────────────────────────────
  function memberModalHtml(depts) {
    return `
    <div class="modal-overlay" id="member-modal" onclick="closeMemberModal(event)">
      <div class="modal" style="width:480px">
        <h2 id="mm-title">Add Team Member</h2>
        <input type="hidden" id="mm-id"/>
        <div class="field"><label>Full Name</label><input id="mm-name" type="text" placeholder="e.g. Eddie Warren"/></div>
        <div class="field-row">
          <div class="field"><label>Department</label>
            <input id="mm-dept" type="text" placeholder="e.g. Management" list="dept-datalist"/>
            <datalist id="dept-datalist">${depts.map(d=>`<option value="${esc(d)}">`).join('')}</datalist>
            <div style="font-size:10px;color:var(--muted);margin-top:3px">Type new or pick existing</div>
          </div>
          <div class="field"><label>Company</label><input id="mm-company" type="text" placeholder="e.g. Warren Dev"/></div>
        </div>
        <div class="field"><label>Job Title / Role</label><input id="mm-role" type="text" placeholder="e.g. Managing Director"/></div>
        <div class="field"><label>Email (optional)</label><input id="mm-email" type="email" placeholder="e.g. eddie@warrendev.com"/></div>
        <div class="modal-footer">
          <button class="btn btn-danger" id="mm-delete" onclick="deleteMember()" style="margin-right:auto;display:none">✕ Remove</button>
          <button class="btn btn-ghost" onclick="closeMemberModal()">Cancel</button>
          <button class="btn btn-primary" onclick="saveMember()">Save</button>
        </div>
      </div>
    </div>`;
  }

  function openMemberModal(id) {
    const m = id ? team.find(x=>x.id===id) : null;
    document.getElementById('mm-title').textContent     = m ? 'Edit Member' : 'Add Team Member';
    document.getElementById('mm-id').value              = m?.id      || '';
    document.getElementById('mm-name').value            = m?.name    || '';
    document.getElementById('mm-dept').value            = m?.dept    || '';
    document.getElementById('mm-company').value         = m?.company || '';
    document.getElementById('mm-role').value            = m?.jobRole || '';
    document.getElementById('mm-email').value           = m?.email   || '';
    document.getElementById('mm-delete').style.display  = m ? 'inline-flex' : 'none';
    document.getElementById('member-modal').classList.add('open');
    setTimeout(() => document.getElementById('mm-name').focus(), 100);
  }

  async function saveMember() {
    const name = document.getElementById('mm-name').value.trim();
    if (!name) { document.getElementById('mm-name').focus(); return; }
    const id = document.getElementById('mm-id').value;
    const data = {
      id:      id || Date.now().toString(),
      name,
      dept:    document.getElementById('mm-dept').value.trim(),
      company: document.getElementById('mm-company').value.trim(),
      jobRole: document.getElementById('mm-role').value.trim(),
      email:   document.getElementById('mm-email').value.trim(),
    };
    if (id) { const idx=team.findIndex(m=>m.id===id); if(idx>=0) team[idx]=data; }
    else team.push(data);
    await saveTeam();
    document.getElementById('member-modal').classList.remove('open');
    render();
    toast(id ? 'Member updated ✓' : 'Member added ✓', 'success');
  }

  async function deleteMember() {
    const id = document.getElementById('mm-id').value;
    if (!confirm('Remove this team member?')) return;
    team = team.filter(m => m.id !== id);
    await saveTeam();
    document.getElementById('member-modal').classList.remove('open');
    render();
    toast('Member removed', 'info');
  }

  render();
}

// Exported helper for task assignee dropdowns
async function getTeamForDropdown() {
  let team = await window.api.store.get('team');
  if (!team || !team.length) {
    team = DEFAULT_TEAM;
    await window.api.store.set('team', team);
  }
  return team;
}
