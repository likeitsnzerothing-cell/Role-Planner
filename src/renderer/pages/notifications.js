/**
 * notifications.js — Reminders page
 * Manages all 4 notification types: scheduled, pre-meeting, overdue, manual.
 */

async function render_notifications(container) {
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  let notifs = await window.api.notifications.getAll() || [];

  async function save() {
    await window.api.notifications.save(notifs);
  }

  function render() {
    container.innerHTML = `
    <div class="page">
      <div class="page-header">
        <div><h1>Reminders</h1><div class="subtitle">Windows desktop notifications for tasks and meetings</div></div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="testNotif()">🔔 Test</button>
          <button class="btn btn-primary btn-sm" onclick="openAddModal()">＋ Add Reminder</button>
        </div>
      </div>

      <!-- Types explanation -->
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:28px">
        ${[
          { icon:'⏰', label:'Scheduled', desc:'Daily at a set time', type:'scheduled' },
          { icon:'📅', label:'Pre-Meeting', desc:'Before calendar events', type:'pre-meeting' },
          { icon:'⚠️', label:'Overdue', desc:'When tasks are past due', type:'overdue' },
          { icon:'🔁', label:'Manual Snooze', desc:'Remind me in X minutes', type:'manual' },
        ].map(t => `
          <div class="card" style="cursor:pointer;border-color:${notifs.some(n=>n.type===t.type&&n.enabled)?'var(--accent)':'var(--border)'}" onclick="openAddModal('${t.type}')">
            <div class="card-body" style="text-align:center;padding:14px 10px">
              <div style="font-size:24px;margin-bottom:6px">${t.icon}</div>
              <div style="font-size:12px;font-weight:500">${t.label}</div>
              <div class="text-muted text-sm" style="margin-top:3px">${t.desc}</div>
              <div style="margin-top:8px">
                <span class="chip ${notifs.filter(n=>n.type===t.type).length?'chip-accent':'chip-muted'}">${notifs.filter(n=>n.type===t.type).length} active</span>
              </div>
            </div>
          </div>`).join('')}
      </div>

      <!-- Reminder list -->
      ${notifs.length === 0
        ? `<div class="empty"><div class="empty-icon">🔔</div><h3>No reminders</h3><p>Add a reminder to get Windows desktop notifications.</p></div>`
        : `<div style="display:flex;flex-direction:column;gap:8px" id="notif-list">
            ${notifs.map((n,i) => `
              <div class="card" draggable="true"
                   ondragstart="notifDragStart(event,${i})"
                   ondragend="notifDragEnd(event)"
                   ondragover="notifDragOver(event)"
                   ondragleave="notifDragLeave(event)"
                   ondrop="notifDrop(event,${i})">
                <div style="padding:14px 18px;display:flex;align-items:center;gap:12px">
                  <span style="color:var(--muted);font-size:14px;cursor:grab;flex-shrink:0" title="Drag to reorder">⠿</span>
                  <div style="font-size:22px">${typeIcon(n.type)}</div>
                  <div style="flex:1">
                    <div style="display:flex;align-items:center;gap:10px">
                      <span style="font-size:13px;font-weight:500">${esc(n.title)}</span>
                      <span class="chip ${n.type==='scheduled'?'chip-accent':n.type==='pre-meeting'?'chip-info':n.type==='overdue'?'chip-danger':'chip-orange'}">${n.type}</span>
                    </div>
                    <div class="text-muted text-sm" style="margin-top:3px">${typeDescription(n)}</div>
                  </div>
                  <div style="display:flex;align-items:center;gap:8px">
                    <div style="display:flex;flex-direction:column;gap:1px">
                      <button onclick="moveNotif(${i},'up')" ${i===0?'disabled':''} style="background:none;border:none;color:${i===0?'var(--border)':'var(--muted)'};cursor:${i===0?'default':'pointer'};font-size:9px;padding:1px 3px">▲</button>
                      <button onclick="moveNotif(${i},'down')" ${i===notifs.length-1?'disabled':''} style="background:none;border:none;color:${i===notifs.length-1?'var(--border)':'var(--muted)'};cursor:${i===notifs.length-1?'default':'pointer'};font-size:9px;padding:1px 3px">▼</button>
                    </div>
                    ${n.type==='manual' ? `<button class="btn btn-ghost btn-sm" onclick="openSnoozeModal(${i})">⏰ Snooze</button>` : ''}
                    <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:11px;color:var(--muted)">
                      <input type="checkbox" ${n.enabled?'checked':''} onchange="toggleNotif(${i})" style="accent-color:var(--accent)"/> On
                    </label>
                    <button class="btn btn-danger btn-sm" onclick="deleteNotif(${i})">✕</button>
                  </div>
                </div>
              </div>`).join('')}
          </div>`}
    </div>
    ${addModalHtml()}
    ${snoozeModalHtml()}`;

    window.testNotif     = () => window.api.notifications.testFire('Role Planner', 'This is a test notification ✓');
    window.toggleNotif   = async (i) => { notifs[i].enabled = !notifs[i].enabled; await save(); render(); };
    window.deleteNotif   = async (i) => { notifs.splice(i,1); await save(); render(); };
    window.openAddModal  = (type) => {
      const modal = document.getElementById('notif-add-modal');
      if (type) document.getElementById('nm-type').value = type;
      updateTypeFields();
      modal.classList.add('open');
    };
    window.closeAddModal = (e) => { if (!e||e.target===document.getElementById('notif-add-modal')) document.getElementById('notif-add-modal').classList.remove('open'); };
    window.saveNotif     = saveNotif;
    window.updateTypeFields = updateTypeFields;
    window.openSnoozeModal = openSnoozeModal;

    // Notification reorder
    let _notifDrag = null;
    window.notifDragStart  = (e,i)  => { _notifDrag=i; setTimeout(()=>e.target.style.opacity='0.4',0); };
    window.notifDragEnd    = e      => { e.target.style.opacity='1'; };
    window.notifDragOver   = e      => { e.preventDefault(); e.currentTarget.style.background='rgba(232,197,71,0.06)'; };
    window.notifDragLeave  = e      => { e.currentTarget.style.background=''; };
    window.notifDrop       = async (e,toIdx) => {
      e.currentTarget.style.background='';
      if (_notifDrag===null||_notifDrag===toIdx) return;
      const copy=[...notifs]; const [item]=copy.splice(_notifDrag,1); copy.splice(toIdx,0,item);
      notifs=copy; await save(); render();
    };
    window.moveNotif = async (i,dir) => {
      const to = dir==='up'?i-1:i+1;
      if (to<0||to>=notifs.length) return;
      const copy=[...notifs]; const [item]=copy.splice(i,1); copy.splice(to,0,item);
      notifs=copy; await save(); render();
    };
    window.closeSnoozeModal = (e) => { if (!e||e.target===document.getElementById('snooze-modal')) document.getElementById('snooze-modal').classList.remove('open'); };
    window.doSnooze = doSnooze;
  }

  function typeIcon(type) {
    return { scheduled:'⏰', 'pre-meeting':'📅', overdue:'⚠️', manual:'🔁' }[type] || '🔔';
  }

  function typeDescription(n) {
    if (n.type === 'scheduled')   return `Fires daily at ${n.time || '09:00'}`;
    if (n.type === 'pre-meeting') return `${n.minutesBefore||15} minutes before calendar events`;
    if (n.type === 'overdue')     return `Fires once per day for each overdue task`;
    if (n.type === 'manual')      return `Manual snooze reminders`;
    return '';
  }

  function addModalHtml() {
    return `
    <div class="modal-overlay" id="notif-add-modal" onclick="closeAddModal(event)">
      <div class="modal">
        <h2>Add Reminder</h2>
        <div class="field">
          <label>Reminder Type</label>
          <select id="nm-type" onchange="updateTypeFields()">
            <option value="scheduled">⏰ Scheduled — daily at a time</option>
            <option value="pre-meeting">📅 Pre-Meeting — before calendar events</option>
            <option value="overdue">⚠️ Overdue — when tasks are past due</option>
            <option value="manual">🔁 Manual Snooze</option>
          </select>
        </div>
        <div class="field"><label>Label</label><input id="nm-title" type="text" placeholder="e.g. Morning check-in"/></div>
        <div class="field"><label>Message (optional)</label><input id="nm-body" type="text" placeholder="Reminder body text"/></div>
        <div id="nm-type-fields"></div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeAddModal()">Cancel</button>
          <button class="btn btn-primary" onclick="saveNotif()">Add Reminder</button>
        </div>
      </div>
    </div>`;
  }

  function snoozeModalHtml() {
    return `
    <div class="modal-overlay" id="snooze-modal" onclick="closeSnoozeModal(event)">
      <div class="modal" style="width:360px">
        <h2>Snooze Reminder</h2>
        <input type="hidden" id="snooze-idx"/>
        <div class="field"><label>Remind me in…</label>
          <select id="snooze-mins">
            <option value="5">5 minutes</option>
            <option value="10">10 minutes</option>
            <option value="15" selected>15 minutes</option>
            <option value="30">30 minutes</option>
            <option value="60">1 hour</option>
            <option value="120">2 hours</option>
          </select>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeSnoozeModal()">Cancel</button>
          <button class="btn btn-primary" onclick="doSnooze()">Set Snooze</button>
        </div>
      </div>
    </div>`;
  }

  function updateTypeFields() {
    const type = document.getElementById('nm-type')?.value;
    const el   = document.getElementById('nm-type-fields');
    if (!el) return;
    if (type === 'scheduled') {
      el.innerHTML = `<div class="field"><label>Time (24h)</label><input id="nm-time" type="time" value="09:00"/></div>`;
    } else if (type === 'pre-meeting') {
      el.innerHTML = `<div class="field"><label>Minutes before meeting</label><input id="nm-minutes" type="number" value="15" min="1" max="120"/></div>`;
    } else {
      el.innerHTML = '';
    }
  }

  async function saveNotif() {
    const type  = document.getElementById('nm-type').value;
    const title = document.getElementById('nm-title').value.trim() || typeDescription({ type });
    const body  = document.getElementById('nm-body').value.trim();

    const notif = { id: Date.now().toString(), type, title, body, enabled: true };
    if (type === 'scheduled')   notif.time          = document.getElementById('nm-time')?.value || '09:00';
    if (type === 'pre-meeting') notif.minutesBefore = parseInt(document.getElementById('nm-minutes')?.value||'15');

    notifs.push(notif);
    await save();
    document.getElementById('notif-add-modal').classList.remove('open');
    render();
    toast('Reminder added ✓', 'success');
  }

  function openSnoozeModal(i) {
    document.getElementById('snooze-idx').value = i;
    document.getElementById('snooze-modal').classList.add('open');
  }

  async function doSnooze() {
    const i       = parseInt(document.getElementById('snooze-idx').value);
    const minutes = parseInt(document.getElementById('snooze-mins').value);
    const notif   = notifs[i];
    const result  = await window.api.notifications.snooze(notif.id, minutes);
    document.getElementById('snooze-modal').classList.remove('open');
    toast(`Reminder set for ${minutes} min from now`, 'success');
  }

  render();
}
