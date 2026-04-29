/**
 * calendar.js — Teams Calendar page
 */

async function render_calendar(container) {
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  async function loadAndRender() {
    container.innerHTML = `<div class="page">
      <div class="page-header">
        <div><h1>Calendar</h1><div class="subtitle">Teams & Outlook events — next 14 days</div></div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-ghost btn-sm" onclick="refreshCalendar()">↻ Refresh</button>
          <button class="btn btn-primary btn-sm" onclick="openNewEventModal(null)">＋ New Meeting</button>
        </div>
      </div>
      <div id="cal-body"><div class="loading-screen" style="height:200px"><div class="spinner"></div></div></div>
    </div>
    ${eventModalHtml()}`;

    window.refreshCalendar    = loadEvents;
    window.openNewEventModal  = openNewEventModal;
    window.saveEvent          = saveEvent;
    window.deleteEvent        = deleteCalEvent;
    window.closeEventModal    = (e) => { if (!e||e.target===document.getElementById('event-modal')) document.getElementById('event-modal').classList.remove('open'); };
    await loadEvents();
  }

  async function loadEvents() {
    const body = document.getElementById('cal-body');
    if (!body) return;
    const status = await window.api.auth.status();
    if (!status.loggedIn) {
      body.innerHTML = `<div class="empty"><div class="empty-icon">📅</div><h3>Not signed in</h3><p>Sign in to Microsoft to view your Teams calendar.</p></div>`;
      return;
    }
    body.innerHTML = `<div class="loading-screen" style="height:200px"><div class="spinner"></div></div>`;
    const result = await window.api.calendar.getEvents(14);
    if (result.error) {
      body.innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><h3>Failed to load</h3><p>${result.message||result.error}</p></div>`;
      return;
    }
    // Cache for notifications
    await window.api.store.set('calendar.cache', { events: result.events, fetchedAt: Date.now() });

    const events = result.events || [];
    if (!events.length) {
      body.innerHTML = `<div class="empty"><div class="empty-icon">📅</div><h3>No upcoming events</h3><p>Your calendar is clear for the next 14 days.</p></div>`;
      return;
    }

    // Group by date
    const groups = {};
    for (const e of events) {
      const d = e.start ? new Date(e.start).toDateString() : 'Unknown';
      if (!groups[d]) groups[d] = [];
      groups[d].push(e);
    }

    const roles = await window.api.store.get('roles') || [];

    body.innerHTML = Object.entries(groups).map(([day, evts]) => `
      <div style="margin-bottom:24px">
        <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);margin-bottom:10px;padding-bottom:6px;border-bottom:1px solid var(--border)">${day}</div>
        ${evts.map(e => {
          const linkedRole = roles.find(r => r.id === e.roleId);
          const start = e.start ? new Date(e.start) : null;
          const end   = e.end   ? new Date(e.end)   : null;
          const dur   = start && end ? Math.round((end-start)/60000) : null;
          return `
          <div class="card" style="margin-bottom:10px;cursor:pointer" onclick="openEditEvent('${e.id}')">
            <div style="padding:14px 18px;display:flex;align-items:center;gap:16px">
              <div style="text-align:center;min-width:52px;background:var(--card);border-radius:4px;padding:6px">
                <div style="font-size:18px;font-weight:700;color:var(--accent);line-height:1">${start?start.getHours().toString().padStart(2,'0')+':'+start.getMinutes().toString().padStart(2,'0'):'?'}</div>
                <div style="font-size:9px;color:var(--muted)">${dur?dur+'m':''}</div>
              </div>
              <div style="flex:1;min-width:0">
                <div style="font-size:13px;font-weight:500;margin-bottom:3px">${esc(e.subject)}</div>
                <div style="display:flex;gap:10px;flex-wrap:wrap">
                  ${e.location ? `<span class="text-muted text-sm">📍 ${esc(e.location)}</span>` : ''}
                  ${e.attendees?.length ? `<span class="text-muted text-sm">👥 ${e.attendees.length} attendees</span>` : ''}
                  ${linkedRole ? `<span class="chip chip-accent">${esc(linkedRole.title)}</span>` : ''}
                  ${e.webLink ? `<a href="#" onclick="event.stopPropagation();window.api.onenote.openInBrowser('${e.webLink}')" class="chip chip-info">Join Teams</a>` : ''}
                </div>
              </div>
              <button onclick="event.stopPropagation();deleteEvent('${e.id}')" class="btn btn-danger btn-sm">✕</button>
            </div>
          </div>`;
        }).join('')}
      </div>`).join('');

    window.openEditEvent = (id) => {
      const evt = events.find(e => e.id === id);
      if (evt) openNewEventModal(null, evt);
    };
  }

  function eventModalHtml() {
    return `
    <div class="modal-overlay" id="event-modal" onclick="closeEventModal(event)">
      <div class="modal">
        <h2 id="event-modal-title">New Meeting</h2>
        <input type="hidden" id="em-id"/>
        <div class="field"><label>Title</label><input id="em-subject" type="text" placeholder="Meeting subject"/></div>
        <div class="field-row">
          <div class="field"><label>Start</label><input id="em-start" type="datetime-local"/></div>
          <div class="field"><label>End</label><input id="em-end" type="datetime-local"/></div>
        </div>
        <div class="field"><label>Location / Teams link</label><input id="em-location" type="text" placeholder="Room or leave blank for Teams online"/></div>
        <div class="field"><label>Description</label><textarea id="em-body" placeholder="Agenda, notes…"></textarea></div>
        <div class="field"><label>Link to Role</label>
          <select id="em-role"><option value="">— None —</option></select>
        </div>
        <div class="field">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="em-teams" checked style="accent-color:var(--accent)"/>
            Create as Teams meeting
          </label>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeEventModal()">Cancel</button>
          <button class="btn btn-primary" onclick="saveEvent()">Save</button>
        </div>
      </div>
    </div>`;
  }

  async function openNewEventModal(roleId, existingEvent) {
    const modal = document.getElementById('event-modal');
    if (!modal) return;

    // Populate role dropdown
    const roles = await window.api.store.get('roles') || [];
    const sel = document.getElementById('em-role');
    sel.innerHTML = `<option value="">— None —</option>` +
      roles.map(r => `<option value="${r.id}">${esc(r.title)}</option>`).join('');

    document.getElementById('event-modal-title').textContent = existingEvent ? 'Edit Event' : 'New Meeting';
    document.getElementById('em-id').value       = existingEvent?.id || '';
    document.getElementById('em-subject').value  = existingEvent?.subject || '';
    document.getElementById('em-location').value = existingEvent?.location || '';
    document.getElementById('em-body').value     = existingEvent?.preview || '';
    sel.value = existingEvent?.roleId || roleId || '';

    const now   = new Date();
    const inHr  = new Date(now.getTime() + 3600000);
    const toLocal = d => new Date(d.getTime() - d.getTimezoneOffset()*60000).toISOString().slice(0,16);
    document.getElementById('em-start').value = existingEvent?.start ? toLocal(new Date(existingEvent.start)) : toLocal(now);
    document.getElementById('em-end').value   = existingEvent?.end   ? toLocal(new Date(existingEvent.end))   : toLocal(inHr);

    modal.classList.add('open');
  }

  async function saveEvent() {
    const id      = document.getElementById('em-id').value;
    const subject = document.getElementById('em-subject').value.trim();
    if (!subject) { document.getElementById('em-subject').focus(); return; }

    const data = {
      subject,
      start:           document.getElementById('em-start').value,
      end:             document.getElementById('em-end').value,
      location:        document.getElementById('em-location').value.trim(),
      body:            document.getElementById('em-body').value,
      roleId:          document.getElementById('em-role').value || null,
      isOnlineMeeting: document.getElementById('em-teams').checked,
      timeZone:        Intl.DateTimeFormat().resolvedOptions().timeZone,
    };

    const status = await window.api.auth.status();
    if (!status.loggedIn) { toast('Sign in to Microsoft first', 'error'); return; }

    toast(id ? 'Updating…' : 'Creating…', 'info');
    const result = id
      ? await window.api.calendar.updateEvent(id, data)
      : await window.api.calendar.createEvent(data);

    if (result.success) {
      document.getElementById('event-modal').classList.remove('open');
      toast(id ? 'Event updated ✓' : 'Meeting created ✓', 'success');
      await loadEvents();
    } else {
      toast('Error: ' + (result.message||result.error), 'error');
    }
  }

  async function deleteCalEvent(id) {
    if (!confirm('Delete this event?')) return;
    const result = await window.api.calendar.deleteEvent(id);
    if (result.success) { toast('Event deleted', 'info'); await loadEvents(); }
    else toast('Error: ' + result.error, 'error');
  }

  await loadAndRender();
}
