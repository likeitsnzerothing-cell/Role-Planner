/**
 * localcalendar.js — Built-in Calendar (no Microsoft required)
 * Features: month/week view, time blocks, task deadlines/starts, role colours, recurring blocks
 */

async function render_localcalendar(container) {
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ── State ──────────────────────────────────────────────────────────────────
  let view      = 'month'; // 'month' | 'week'
  let today     = new Date();
  let current   = new Date(today.getFullYear(), today.getMonth(), 1);
  let weekStart = getWeekStart(today);
  let blocks    = await window.api.store.get('localcal.blocks') || [];
  let roles     = await window.api.store.get('roles') || [];

  // Role colour palette
  const ROLE_COLORS = [
    '#e8c547','#c47a3a','#4a9a6a','#4a8aca','#c45a3a',
    '#9a4aca','#ca4a7a','#4acaca','#7aca4a','#ca9a4a'
  ];
  function roleColor(roleId) {
    const idx = roles.findIndex(r => r.id === roleId);
    return ROLE_COLORS[idx % ROLE_COLORS.length] || '#7a7570';
  }
  function roleName(roleId) {
    return roles.find(r => r.id === roleId)?.title || '';
  }

  async function saveBlocks() { await window.api.store.set('localcal.blocks', blocks); }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function getWeekStart(d) {
    const day = new Date(d);
    day.setHours(0,0,0,0);
    day.setDate(day.getDate() - day.getDay() + 1); // Monday start
    return day;
  }

  function isSameDay(a, b) {
    return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate();
  }

  function isToday(d) { return isSameDay(d, today); }

  function fmtTime(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});
  }

  function fmtDateShort(iso) {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString([],{month:'short',day:'numeric'});
  }

  // Expand recurring blocks into concrete instances for a date range
  function getBlocksForDay(date) {
    const dayStr = date.toDateString();
    const dow    = date.getDay(); // 0=Sun,1=Mon...
    const result = [];

    for (const b of blocks) {
      // One-off block
      if (!b.recurring) {
        if (b.date && new Date(b.date).toDateString() === dayStr) result.push(b);
        continue;
      }
      // Recurring
      if (b.recurDays && b.recurDays.includes(dow)) {
        // Check start/end range
        const from = b.recurFrom ? new Date(b.recurFrom) : null;
        const to   = b.recurTo   ? new Date(b.recurTo)   : null;
        if (from && date < from) continue;
        if (to   && date > to)   continue;
        result.push({ ...b, date: date.toISOString().slice(0,10) });
      }
    }
    return result;
  }

  // Get task events (deadlines + starts) for a day
  function getTaskEventsForDay(date) {
    const events = [];
    for (const role of roles) {
      for (const t of (role.responsibilities||[])) {
        if (t.done) continue;
        if (t.startDate && isSameDay(new Date(t.startDate), date)) {
          events.push({ type:'start', text: t.text, roleId: role.id, time: t.startDate });
        }
        if (t.deadline && isSameDay(new Date(t.deadline), date)) {
          events.push({ type:'deadline', text: t.text, roleId: role.id, time: t.deadline });
        }
      }
    }
    return events;
  }

  // ── Main render ────────────────────────────────────────────────────────────
  function render() {
    container.innerHTML = `
    <div class="page" style="padding-bottom:0">
      <div class="page-header">
        <div>
          <h1>Calendar</h1>
          <div class="subtitle">Built-in planner — no Microsoft account needed</div>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <button class="btn btn-ghost btn-sm" onclick="calNav(-1)">← Prev</button>
          <button class="btn btn-ghost btn-sm" onclick="calToday()">Today</button>
          <button class="btn btn-ghost btn-sm" onclick="calNav(1)">Next →</button>
          <div style="width:1px;height:20px;background:var(--border)"></div>
          <button class="btn ${view==='month'?'btn-primary':'btn-ghost'} btn-sm" onclick="setView('month')">Month</button>
          <button class="btn ${view==='week'?'btn-primary':'btn-ghost'} btn-sm" onclick="setView('week')">Week</button>
          <div style="width:1px;height:20px;background:var(--border)"></div>
          <button class="btn btn-ghost btn-sm" onclick="openManageBlocks()">☰ Manage</button>
          <button class="btn btn-primary btn-sm" onclick="openBlockModal(null)">＋ Block Time</button>
        </div>
      </div>

      <!-- Role legend -->
      ${roles.length ? `
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px">
        ${roles.map((r,i) => `
          <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted)">
            <div style="width:10px;height:10px;border-radius:2px;background:${ROLE_COLORS[i%ROLE_COLORS.length]}"></div>
            ${esc(r.title)}
          </div>`).join('')}
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted)">
          <div style="width:10px;height:10px;border-radius:2px;background:var(--success);opacity:0.7"></div> Task Start
        </div>
        <div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--muted)">
          <div style="width:10px;height:10px;border-radius:2px;background:var(--danger);opacity:0.7"></div> Deadline
        </div>
      </div>` : ''}

      <div id="cal-view">${view === 'month' ? renderMonth() : renderWeek()}</div>
    </div>
    ${blockModalHtml()}`;

    window.calNav       = (dir) => { navigate_cal(dir); };
    window.calToday     = () => { current = new Date(today.getFullYear(), today.getMonth(), 1); weekStart = getWeekStart(today); render(); };
    window.setView      = (v) => { view = v; render(); };
    window.openBlockModal = openBlockModal;
    window.saveBlock    = saveBlock;
    window.deleteBlock  = deleteBlock;
    window.closeBlockModal = (e) => { if (!e||e.target===document.getElementById('block-modal')) document.getElementById('block-modal').classList.remove('open'); };
  }

  function navigate_cal(dir) {
    if (view === 'month') {
      current = new Date(current.getFullYear(), current.getMonth() + dir, 1);
    } else {
      weekStart = new Date(weekStart.getTime() + dir * 7 * 86400000);
    }
    render();
  }

  // ── Month View ─────────────────────────────────────────────────────────────
  function renderMonth() {
    const year  = current.getFullYear();
    const month = current.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month+1, 0).getDate();
    const startOffset = (firstDay === 0 ? 6 : firstDay - 1); // Monday start

    const monthName = current.toLocaleString('default',{month:'long',year:'numeric'});
    const DAY_NAMES = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

    let cells = '';
    let cellCount = 0;

    // Leading empty cells
    for (let i = 0; i < startOffset; i++) {
      cells += `<div style="min-height:100px;background:var(--surface);border:1px solid var(--border);opacity:0.3"></div>`;
      cellCount++;
    }

    // Day cells
    for (let d = 1; d <= daysInMonth; d++) {
      const date     = new Date(year, month, d);
      const todayCell = isToday(date);
      const dayBlocks = getBlocksForDay(date);
      const taskEvts  = getTaskEventsForDay(date);
      const isWeekend = date.getDay() === 0 || date.getDay() === 6;

      cells += `
      <div style="min-height:100px;background:${todayCell?'rgba(232,197,71,0.05)':'var(--surface)'};border:1px solid ${todayCell?'var(--accent)':'var(--border)'};padding:6px;cursor:pointer;transition:background 0.1s;position:relative"
           onmouseover="this.style.background='var(--card)'" onmouseout="this.style.background='${todayCell?'rgba(232,197,71,0.05)':'var(--surface)'}'"
           onclick="openBlockModal('${date.toISOString().slice(0,10)}')">
        <div style="font-size:11px;font-weight:${todayCell?'700':'400'};color:${todayCell?'var(--accent)':isWeekend?'var(--muted)':'var(--text)'};margin-bottom:4px">
          ${d}${todayCell?' ◈':''}
        </div>
        ${taskEvts.slice(0,2).map(e => `
          <div style="font-size:9px;padding:2px 5px;border-radius:2px;margin-bottom:2px;background:${e.type==='deadline'?'rgba(196,90,58,0.2)':'rgba(74,154,106,0.2)'};color:${e.type==='deadline'?'var(--danger)':'var(--success)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${esc(e.text)}">
            ${e.type==='deadline'?'⏰':'▶'} ${esc(e.text.slice(0,18))}
          </div>`).join('')}
        ${dayBlocks.slice(0,3).map(b => `
          <div style="font-size:9px;padding:2px 5px;border-radius:2px;margin-bottom:2px;background:${roleColor(b.roleId)}22;border-left:2px solid ${roleColor(b.roleId)};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)" title="${esc(b.title)}">
            ${b.startTime||''} ${esc((b.title||'').slice(0,16))}
          </div>`).join('')}
        ${(dayBlocks.length + taskEvts.length) > 4 ? `<div style="font-size:9px;color:var(--muted)">+${dayBlocks.length+taskEvts.length-4} more</div>` : ''}
      </div>`;
      cellCount++;
    }

    // Trailing empty cells to complete grid
    const remaining = cellCount % 7 === 0 ? 0 : 7 - (cellCount % 7);
    for (let i = 0; i < remaining; i++) {
      cells += `<div style="min-height:100px;background:var(--surface);border:1px solid var(--border);opacity:0.3"></div>`;
    }

    return `
    <div style="text-align:center;font-family:'Playfair Display',serif;font-size:20px;font-weight:700;margin-bottom:16px;color:var(--text)">${monthName}</div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:2px">
      ${DAY_NAMES.map(d=>`<div style="text-align:center;font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);padding:4px">${d}</div>`).join('')}
    </div>
    <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">${cells}</div>`;
  }

  // ── Week View ──────────────────────────────────────────────────────────────
  function renderWeek() {
    const HOURS = Array.from({length:24},(_,i)=>i);
    const days  = Array.from({length:7},(_,i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return d;
    });

    const weekLabel = `${days[0].toLocaleDateString([],{month:'short',day:'numeric'})} – ${days[6].toLocaleDateString([],{month:'short',day:'numeric',year:'numeric'})}`;

    // Collect all events for the week
    const dayEvents = days.map(d => {
      const blks = getBlocksForDay(d);
      const tevts = getTaskEventsForDay(d);
      return { blks, tevts };
    });

    return `
    <div style="text-align:center;font-family:'Playfair Display',serif;font-size:20px;font-weight:700;margin-bottom:16px;color:var(--text)">${weekLabel}</div>
    <div style="display:grid;grid-template-columns:50px repeat(7,1fr);border:1px solid var(--border);border-radius:6px;overflow:hidden">

      <!-- Header row -->
      <div style="background:var(--surface);border-bottom:1px solid var(--border);border-right:1px solid var(--border)"></div>
      ${days.map(d => `
        <div style="background:var(--surface);border-bottom:1px solid var(--border);border-right:1px solid var(--border);padding:8px 4px;text-align:center">
          <div style="font-size:9px;letter-spacing:2px;text-transform:uppercase;color:var(--muted)">${d.toLocaleString('default',{weekday:'short'})}</div>
          <div style="font-size:16px;font-weight:${isToday(d)?'700':'400'};color:${isToday(d)?'var(--accent)':'var(--text)'}">${d.getDate()}</div>
        </div>`).join('')}

      <!-- Hour rows (7am–8pm for readability) -->
      ${Array.from({length:14},(_,h)=>h+7).map(hour => `
        <div style="border-right:1px solid var(--border);border-bottom:1px solid var(--border);padding:2px 4px;font-size:9px;color:var(--muted);background:var(--surface);text-align:right">
          ${hour.toString().padStart(2,'0')}:00
        </div>
        ${days.map((d,di) => {
          const hourBlocks = dayEvents[di].blks.filter(b => {
            if (!b.startTime) return false;
            const bh = parseInt(b.startTime.split(':')[0]);
            return bh === hour;
          });
          const hourTaskEvts = dayEvents[di].tevts.filter(e => {
            if (!e.time) return false;
            return new Date(e.time).getHours() === hour;
          });
          return `
          <div style="border-right:1px solid var(--border);border-bottom:1px solid var(--border);min-height:44px;padding:2px;background:${isToday(d)?'rgba(232,197,71,0.03)':'transparent'};cursor:pointer;position:relative"
               onclick="openBlockModal('${d.toISOString().slice(0,10)}','${hour.toString().padStart(2,'0')}:00')">
            ${hourTaskEvts.map(e=>`
              <div style="font-size:9px;padding:2px 4px;border-radius:2px;margin-bottom:1px;background:${e.type==='deadline'?'rgba(196,90,58,0.25)':'rgba(74,154,106,0.25)'};color:${e.type==='deadline'?'var(--danger)':'var(--success)'};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                ${e.type==='deadline'?'⏰':'▶'} ${esc(e.text.slice(0,14))}
              </div>`).join('')}
            ${hourBlocks.map(b=>`
              <div style="font-size:9px;padding:2px 4px;border-radius:2px;margin-bottom:1px;background:${roleColor(b.roleId)}33;border-left:2px solid ${roleColor(b.roleId)};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)" title="${esc(b.title)}">
                ${b.startTime}${b.endTime?'–'+b.endTime:''} ${esc((b.title||'').slice(0,12))}
              </div>`).join('')}
          </div>`;
        }).join('')}`).join('')}
    </div>`;
  }

  // ── Block Modal ────────────────────────────────────────────────────────────
  function blockModalHtml() {
    const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    return `
    <div class="modal-overlay" id="block-modal" onclick="closeBlockModal(event)">
      <div class="modal" style="width:520px">
        <h2 id="bm-title">Block Out Time</h2>
        <input type="hidden" id="bm-id"/>

        <div class="field">
          <label>Title / Description</label>
          <input id="bm-text" type="text" placeholder="e.g. Deep work, Meeting prep, Lunch…"/>
        </div>

        <div class="field">
          <label>Link to Role (optional)</label>
          <select id="bm-role">
            <option value="">— None —</option>
            ${roles.map(r=>`<option value="${r.id}">${esc(r.title)}</option>`).join('')}
          </select>
        </div>

        <div style="background:var(--card);border-radius:6px;padding:14px;margin-bottom:16px">
          <label style="display:flex;align-items:center;gap:10px;cursor:pointer;font-size:12px;margin-bottom:12px">
            <input type="checkbox" id="bm-recurring" onchange="toggleRecurring()" style="accent-color:var(--accent)"/>
            <span style="font-weight:500">Recurring block</span>
          </label>

          <!-- One-off fields -->
          <div id="bm-oneoff">
            <div class="field-row">
              <div class="field"><label>Date</label><input id="bm-date" type="date"/></div>
              <div class="field"><label>Start Time</label><input id="bm-start" type="time"/></div>
            </div>
            <div class="field"><label>End Time</label><input id="bm-end" type="time"/></div>
          </div>

          <!-- Recurring fields -->
          <div id="bm-recur" style="display:none">
            <div class="field">
              <label>Repeat on days</label>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                ${DAY_LABELS.map((d,i)=>`
                  <label style="display:flex;align-items:center;gap:4px;cursor:pointer;font-size:11px;padding:4px 8px;border:1px solid var(--border);border-radius:4px">
                    <input type="checkbox" value="${i}" class="recur-day" style="accent-color:var(--accent)"/> ${d}
                  </label>`).join('')}
              </div>
            </div>
            <div class="field-row">
              <div class="field"><label>Start Time</label><input id="bm-rstart" type="time"/></div>
              <div class="field"><label>End Time</label><input id="bm-rend" type="time"/></div>
            </div>
            <div class="field-row">
              <div class="field"><label>From Date (optional)</label><input id="bm-rfrom" type="date"/></div>
              <div class="field"><label>Until Date (optional)</label><input id="bm-rto" type="date"/></div>
            </div>
          </div>
        </div>

        <div class="field">
          <label>Notes (optional)</label>
          <textarea id="bm-notes" style="min-height:60px" placeholder="Any extra details…"></textarea>
        </div>

        <div class="modal-footer">
          <button class="btn btn-danger" id="bm-delete" onclick="deleteBlock()" style="margin-right:auto;display:none">✕ Delete</button>
          <button class="btn btn-ghost" onclick="closeBlockModal()">Cancel</button>
          <button class="btn btn-primary" onclick="saveBlock()">Save Block</button>
        </div>
      </div>
    </div>`;
  }

  function openBlockModal(dateStr, timeStr, existingId) {
    const modal = document.getElementById('block-modal');
    const existing = existingId ? blocks.find(b=>b.id===existingId) : null;

    document.getElementById('bm-title').textContent = existing ? 'Edit Block' : 'Block Out Time';
    document.getElementById('bm-id').value    = existing?.id || '';
    document.getElementById('bm-text').value  = existing?.title || '';
    document.getElementById('bm-role').value  = existing?.roleId || '';
    document.getElementById('bm-notes').value = existing?.notes || '';
    document.getElementById('bm-delete').style.display = existing ? 'inline-flex' : 'none';

    const isRecurring = existing?.recurring || false;
    document.getElementById('bm-recurring').checked = isRecurring;
    document.getElementById('bm-oneoff').style.display = isRecurring ? 'none' : 'block';
    document.getElementById('bm-recur').style.display  = isRecurring ? 'block' : 'none';

    // One-off
    document.getElementById('bm-date').value  = existing?.date      || dateStr || '';
    document.getElementById('bm-start').value = existing?.startTime || timeStr || '';
    document.getElementById('bm-end').value   = existing?.endTime   || '';

    // Recurring
    document.querySelectorAll('.recur-day').forEach(cb => {
      cb.checked = existing?.recurDays?.includes(parseInt(cb.value)) || false;
    });
    document.getElementById('bm-rstart').value = existing?.startTime || timeStr || '';
    document.getElementById('bm-rend').value   = existing?.endTime   || '';
    document.getElementById('bm-rfrom').value  = existing?.recurFrom || '';
    document.getElementById('bm-rto').value    = existing?.recurTo   || '';

    modal.classList.add('open');
    setTimeout(() => document.getElementById('bm-text').focus(), 100);
  }

  window.toggleRecurring = () => {
    const on = document.getElementById('bm-recurring').checked;
    document.getElementById('bm-oneoff').style.display = on ? 'none' : 'block';
    document.getElementById('bm-recur').style.display  = on ? 'block' : 'none';
  };

  async function saveBlock() {
    const title = document.getElementById('bm-text').value.trim();
    if (!title) { document.getElementById('bm-text').focus(); return; }

    const isRecurring = document.getElementById('bm-recurring').checked;
    const existingId  = document.getElementById('bm-id').value;

    const block = {
      id:        existingId || Date.now().toString(),
      title,
      roleId:    document.getElementById('bm-role').value || null,
      notes:     document.getElementById('bm-notes').value.trim() || null,
      recurring: isRecurring,
    };

    if (isRecurring) {
      block.recurDays  = [...document.querySelectorAll('.recur-day:checked')].map(cb=>parseInt(cb.value));
      block.startTime  = document.getElementById('bm-rstart').value || null;
      block.endTime    = document.getElementById('bm-rend').value   || null;
      block.recurFrom  = document.getElementById('bm-rfrom').value  || null;
      block.recurTo    = document.getElementById('bm-rto').value    || null;
    } else {
      block.date       = document.getElementById('bm-date').value   || null;
      block.startTime  = document.getElementById('bm-start').value  || null;
      block.endTime    = document.getElementById('bm-end').value    || null;
    }

    if (existingId) {
      const idx = blocks.findIndex(b=>b.id===existingId);
      if (idx >= 0) blocks[idx] = block; else blocks.push(block);
    } else {
      blocks.push(block);
    }

    await saveBlocks();
    document.getElementById('block-modal').classList.remove('open');
    render();
    toast(existingId ? 'Block updated ✓' : 'Block added ✓', 'success');
  }

  async function deleteBlock() {
    const id = document.getElementById('bm-id').value;
    if (!id) return;
    blocks = blocks.filter(b=>b.id!==id);
    await saveBlocks();
    document.getElementById('block-modal').classList.remove('open');
    render();
    toast('Block removed', 'info');
  }


  // ── Manage Blocks panel ──────────────────────────────────────────────────────
  window.openManageBlocks = () => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.id = 'manage-blocks-overlay';
    overlay.onclick = e => { if (e.target===overlay) overlay.remove(); };

    function moveItem(arr, from, to) {
      const copy=[...arr]; const [item]=copy.splice(from,1); copy.splice(to,0,item); return copy;
    }

    function renderManageList() {
      const sorted = [...blocks];
      return sorted.map((b,i) => `
        <div draggable="true"
             id="mb-row-${i}"
             ondragstart="mbDragStart(event,${i})"
             ondragend="mbDragEnd(event)"
             ondragover="mbDragOver(event)"
             ondragleave="mbDragLeave(event)"
             ondrop="mbDrop(event,${i})"
             style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--border);transition:background 0.1s"
             onmouseover="this.style.background='var(--card)'" onmouseout="this.style.background=''">
          <span style="cursor:grab;color:var(--muted);font-size:14px">⠿</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:12px;font-weight:500">${esc(b.title)}</div>
            <div style="font-size:10px;color:var(--muted)">${b.recurring?'Recurring':'One-off'} ${b.startTime?'· '+b.startTime:''} ${b.endTime?'– '+b.endTime:''}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:1px">
            <button onclick="mbMoveUp(${i})" ${i===0?'disabled':''} style="background:none;border:none;color:${i===0?'var(--border)':'var(--muted)'};cursor:${i===0?'default':'pointer'};font-size:9px;padding:1px 3px">▲</button>
            <button onclick="mbMoveDown(${i})" ${i===sorted.length-1?'disabled':''} style="background:none;border:none;color:${i===sorted.length-1?'var(--border)':'var(--muted)'};cursor:${i===sorted.length-1?'default':'pointer'};font-size:9px;padding:1px 3px">▼</button>
          </div>
          <button onclick="openBlockModal(null,null,'${b.id}');document.getElementById('manage-blocks-overlay').remove()"
                  class="btn btn-ghost btn-sm">✎</button>
        </div>`).join('');
    }

    function refreshPanel() {
      const list = document.getElementById('mb-list');
      if (list) list.innerHTML = renderManageList();
      // Re-attach drag handlers
      attachMbHandlers();
    }

    function attachMbHandlers() {
      let _drag = null;
      window.mbDragStart  = (e,i) => { _drag=i; setTimeout(()=>e.target.style.opacity='0.4',0); };
      window.mbDragEnd    = e     => { e.target.style.opacity='1'; };
      window.mbDragOver   = e     => { e.preventDefault(); e.currentTarget.style.background='rgba(232,197,71,0.06)'; };
      window.mbDragLeave  = e     => { e.currentTarget.style.background=''; };
      window.mbDrop       = async (e,toIdx) => {
        e.currentTarget.style.background='';
        if (_drag===null||_drag===toIdx) return;
        blocks = moveItem(blocks, _drag, toIdx);
        await saveBlocks(); refreshPanel(); render();
      };
      window.mbMoveUp   = async i => { if(i===0) return; blocks=moveItem(blocks,i,i-1); await saveBlocks(); refreshPanel(); render(); };
      window.mbMoveDown = async i => { if(i>=blocks.length-1) return; blocks=moveItem(blocks,i,i+1); await saveBlocks(); refreshPanel(); render(); };
    }

    overlay.innerHTML = `
      <div class="modal" style="width:520px;max-height:80vh;overflow:hidden;display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px">
          <h2 style="margin:0">Manage Time Blocks</h2>
          <button class="btn btn-ghost btn-sm" onclick="document.getElementById('manage-blocks-overlay').remove()">✕ Close</button>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-bottom:12px">Drag ⠿ or use ▲▼ to reorder. ${blocks.length} total blocks.</div>
        <div id="mb-list" style="overflow-y:auto;flex:1;border:1px solid var(--border);border-radius:6px">
          ${blocks.length===0
            ? '<div style="padding:20px;text-align:center;color:var(--muted);font-size:12px">No blocks yet</div>'
            : renderManageList()}
        </div>
      </div>`;

    document.body.appendChild(overlay);
    attachMbHandlers();
  };

  render();
}
