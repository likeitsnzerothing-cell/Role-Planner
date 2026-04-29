/**
 * onenote.js — OneNote integration page
 */

async function render_onenote(container) {
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  let notebooks = [];
  let selectedNotebook = null;
  let selectedSection  = null;
  let pages = [];

  container.innerHTML = `
  <div class="page">
    <div class="page-header">
      <div><h1>OneNote</h1><div class="subtitle">Attach pages to roles, create notes, sync content</div></div>
    </div>
    <div class="tabs">
      <div class="tab active" data-tab="browse" onclick="onTab(this,'browse')">Browse</div>
      <div class="tab" data-tab="recent" onclick="onTab(this,'recent')">Recent</div>
      <div class="tab" data-tab="linked" onclick="onTab(this,'linked')">Linked to Roles</div>
    </div>
    <div id="one-body"></div>
  </div>
  ${createPageModalHtml()}`;

  window.onTab = (el, tab) => {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t===el));
    if (tab === 'browse') loadBrowse();
    if (tab === 'recent') loadRecent();
    if (tab === 'linked') loadLinked();
  };

  window.closeOneNoteModal = (e) => {
    if (!e||e.target===document.getElementById('one-modal'))
      document.getElementById('one-modal').classList.remove('open');
  };

  window.saveNewPage = saveNewPage;

  await loadBrowse();

  // ── Browse tab ────────────────────────────────────────────────────────────
  async function loadBrowse() {
    const body = document.getElementById('one-body');
    const status = await window.api.auth.status();
    if (!status.loggedIn) {
      body.innerHTML = `<div class="empty"><div class="empty-icon">📓</div><h3>Not signed in</h3><p>Sign in to Microsoft to access OneNote.</p></div>`;
      return;
    }

    body.innerHTML = `<div style="display:grid;grid-template-columns:200px 200px 1fr;gap:16px;height:calc(100vh - 260px)">
      <div id="nb-list" style="border-right:1px solid var(--border);overflow-y:auto"><div class="loading-screen" style="height:100px"><div class="spinner"></div></div></div>
      <div id="sec-list" style="border-right:1px solid var(--border);overflow-y:auto;padding:8px 0"><div class="text-muted text-sm" style="padding:8px 12px">Select a notebook</div></div>
      <div id="page-list" style="overflow-y:auto;padding:8px 0"><div class="text-muted text-sm" style="padding:8px 12px">Select a section</div></div>
    </div>`;

    const result = await window.api.onenote.getNotebooks();
    if (result.error) { document.getElementById('nb-list').innerHTML = `<div class="text-muted text-sm" style="padding:12px">Error: ${result.error}</div>`; return; }
    notebooks = result.notebooks || [];

    document.getElementById('nb-list').innerHTML = `
      <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);padding:8px 12px">Notebooks</div>
      ${notebooks.map(nb => `
        <div class="nav-item" data-nb="${nb.id}" onclick="selectNotebook('${nb.id}','${esc(nb.displayName)}')" style="font-size:12px;padding:8px 12px">
          📒 ${esc(nb.displayName)}
        </div>`).join('')}`;

    window.selectNotebook = async (id, name) => {
      document.querySelectorAll('[data-nb]').forEach(el => el.classList.toggle('active', el.dataset.nb===id));
      selectedNotebook = id;
      const secEl = document.getElementById('sec-list');
      secEl.innerHTML = `<div class="loading-screen" style="height:80px"><div class="spinner"></div></div>`;
      const r = await window.api.onenote.getSections(id);
      if (r.error) { secEl.innerHTML = `<div class="text-muted text-sm" style="padding:12px">Error: ${r.error}</div>`; return; }
      secEl.innerHTML = `
        <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);padding:8px 12px">Sections</div>
        ${(r.sections||[]).map(sec => `
          <div class="nav-item" data-sec="${sec.id}" onclick="selectSection('${sec.id}','${esc(sec.displayName)}')" style="font-size:12px;padding:8px 12px">
            📑 ${esc(sec.displayName)}
          </div>`).join('')}`;

      window.selectSection = async (secId, secName) => {
        document.querySelectorAll('[data-sec]').forEach(el => el.classList.toggle('active', el.dataset.sec===secId));
        selectedSection = secId;
        const pgEl = document.getElementById('page-list');
        pgEl.innerHTML = `<div class="loading-screen" style="height:80px"><div class="spinner"></div></div>`;
        const pr = await window.api.onenote.getPages(secId);
        if (pr.error) { pgEl.innerHTML = `<div class="text-muted text-sm" style="padding:12px">Error: ${pr.error}</div>`; return; }
        pages = pr.pages || [];
        pgEl.innerHTML = `
          <div style="display:flex;align-items:center;justify-content:space-between;padding:4px 12px 8px">
            <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--muted)">Pages</div>
            <button class="btn btn-ghost btn-sm" onclick="openCreatePageModal('${secId}')">＋ New Page</button>
          </div>
          ${pages.length === 0 ? `<div class="text-muted text-sm" style="padding:8px 12px">No pages</div>` :
            pages.map(pg => `
              <div style="padding:10px 12px;border-radius:4px;cursor:pointer;transition:background 0.1s" onmouseover="this.style.background='var(--card)'" onmouseout="this.style.background=''">
                <div style="display:flex;align-items:center;justify-content:space-between;gap:8px">
                  <span style="font-size:12px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">📄 ${esc(pg.title||'Untitled')}</span>
                  <div style="display:flex;gap:4px;flex-shrink:0">
                    <button class="btn btn-ghost btn-sm" onclick="attachToRole('${pg.id}','${esc(pg.title||'Untitled')}')">🔗 Link</button>
                    <button class="btn btn-ghost btn-sm" onclick="window.api.onenote.openInBrowser('${pg.links?.oneNoteWebUrl?.href||''}')">↗</button>
                  </div>
                </div>
                <div class="text-muted text-sm">${pg.lastModifiedDateTime ? new Date(pg.lastModifiedDateTime).toLocaleDateString() : ''}</div>
              </div>`).join('')}`;

        window.openCreatePageModal = (secId) => {
          const modal = document.getElementById('one-modal');
          modal.dataset.sectionId = secId;
          modal.classList.add('open');
          setTimeout(() => document.getElementById('om-title').focus(), 100);
        };

        window.attachToRole = async (pageId, pageTitle) => {
          const roles = await window.api.store.get('roles') || [];
          if (!roles.length) { toast('No roles yet', 'info'); return; }
          const roleTitle = await promptRoleSelect(roles);
          if (!roleTitle) return;
          const role = roles.find(r => r.title === roleTitle);
          if (!role) return;
          if (!role.linkedPageIds) role.linkedPageIds = [];
          if (!role.linkedPageIds.includes(pageId)) role.linkedPageIds.push(pageId);
          role.linkedPageId = pageId;
          await window.api.store.set('roles', roles);
          toast(`Linked "${pageTitle}" to ${roleTitle} ✓`, 'success');
        };
      };
    };
  }

  // ── Recent tab ─────────────────────────────────────────────────────────────
  async function loadRecent() {
    const body = document.getElementById('one-body');
    const status = await window.api.auth.status();
    if (!status.loggedIn) { body.innerHTML = `<div class="empty"><div class="empty-icon">📓</div><h3>Not signed in</h3></div>`; return; }
    body.innerHTML = `<div class="loading-screen" style="height:200px"><div class="spinner"></div></div>`;
    const result = await window.api.onenote.getRecentPages();
    if (result.error) { body.innerHTML = `<div class="empty"><div class="empty-icon">⚠</div><h3>${result.error}</h3></div>`; return; }
    const pg = result.pages || [];
    body.innerHTML = pg.length === 0
      ? `<div class="empty"><div class="empty-icon">📄</div><h3>No recent pages</h3></div>`
      : `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:16px">
          ${pg.map(p => `
            <div class="card" style="cursor:pointer" onclick="window.api.onenote.openInBrowser('${p.links?.oneNoteWebUrl?.href||''}')">
              <div class="card-body">
                <div style="font-size:14px;font-weight:500;margin-bottom:6px">📄 ${esc(p.title||'Untitled')}</div>
                <div class="text-muted text-sm">${p.parentNotebook?.displayName||''} › ${p.parentSection?.displayName||''}</div>
                <div class="text-muted text-sm" style="margin-top:4px">Modified ${p.lastModifiedDateTime ? new Date(p.lastModifiedDateTime).toLocaleDateString():''}</div>
              </div>
            </div>`).join('')}
        </div>`;
  }

  // ── Linked to roles tab ────────────────────────────────────────────────────
  async function loadLinked() {
    const body = document.getElementById('one-body');
    const roles = await window.api.store.get('roles') || [];
    const linked = roles.filter(r => r.linkedPageId);
    if (!linked.length) {
      body.innerHTML = `<div class="empty"><div class="empty-icon">🔗</div><h3>No linked pages</h3><p>Browse your notebooks and use the Link button to attach pages to roles.</p></div>`;
      return;
    }
    body.innerHTML = linked.map(r => `
      <div class="card" style="margin-bottom:12px">
        <div class="card-header">
          <h3>${esc(r.title)}</h3>
          <button class="btn btn-ghost btn-sm" onclick="syncRoleToOneNote('${r.id}')">↑ Sync Notes</button>
        </div>
        <div class="card-body">
          <div class="text-muted text-sm">OneNote Page ID: ${r.linkedPageId}</div>
          ${r.notes ? `<div style="margin-top:8px;font-size:12px;color:var(--muted);max-height:60px;overflow:hidden">${esc(r.notes.slice(0,200))}…</div>` : ''}
        </div>
      </div>`).join('');

    window.syncRoleToOneNote = async (roleId) => {
      const all = await window.api.store.get('roles') || [];
      const role = all.find(r => r.id === roleId);
      if (!role?.linkedPageId) return;
      const r = await window.api.onenote.updatePage(role.linkedPageId, role.notes || '');
      toast(r.success ? 'Synced ✓' : 'Error: ' + r.error, r.success ? 'success' : 'error');
    };
  }

  function createPageModalHtml() {
    return `
    <div class="modal-overlay" id="one-modal" onclick="closeOneNoteModal(event)">
      <div class="modal">
        <h2>New OneNote Page</h2>
        <div class="field"><label>Page Title</label><input id="om-title" type="text" placeholder="Page title"/></div>
        <div class="field"><label>Initial Content (optional)</label><textarea id="om-content" placeholder="Notes, agenda, links…"></textarea></div>
        <div class="field"><label>Link to Role (optional)</label>
          <select id="om-role"><option value="">— None —</option></select>
        </div>
        <div class="modal-footer">
          <button class="btn btn-ghost" onclick="closeOneNoteModal()">Cancel</button>
          <button class="btn btn-primary" onclick="saveNewPage()">Create Page</button>
        </div>
      </div>
    </div>`;
  }

  async function saveNewPage() {
    const title   = document.getElementById('om-title').value.trim();
    if (!title) { document.getElementById('om-title').focus(); return; }
    const content = document.getElementById('om-content').value;
    const roleId  = document.getElementById('om-role').value;
    const secId   = document.getElementById('one-modal').dataset.sectionId;
    if (!secId) { toast('No section selected', 'error'); return; }

    toast('Creating page…', 'info');
    const r = await window.api.onenote.createPage(secId, title, `<p>${content.replace(/\n/g,'<br/>')}</p>`);
    if (r.success) {
      if (roleId && r.page?.id) {
        const roles = await window.api.store.get('roles') || [];
        const role = roles.find(x => x.id === roleId);
        if (role) { role.linkedPageId = r.page.id; await window.api.store.set('roles', roles); }
      }
      document.getElementById('one-modal').classList.remove('open');
      toast('Page created ✓', 'success');
      loadBrowse();
    } else {
      toast('Error: ' + r.error, 'error');
    }
  }

  // Populate role dropdown in modal when opened
  const observer = new MutationObserver(async () => {
    const sel = document.getElementById('om-role');
    if (sel) {
      const roles = await window.api.store.get('roles') || [];
      sel.innerHTML = `<option value="">— None —</option>` + roles.map(r=>`<option value="${r.id}">${esc(r.title)}</option>`).join('');
    }
  });
  const modal = document.getElementById('one-modal');
  if (modal) observer.observe(modal, { attributeFilter: ['class'] });
}

// Simple prompt-style role picker
async function promptRoleSelect(roles) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.innerHTML = `
      <div class="modal" style="width:320px">
        <h2 style="font-size:18px">Link to Role</h2>
        <div style="display:flex;flex-direction:column;gap:6px;margin:16px 0">
          ${roles.map(r=>`<button class="btn btn-ghost" onclick="this.closest('.modal-overlay').dataset.choice='${r.title}';document.body.removeChild(this.closest('.modal-overlay'))">${r.title}</button>`).join('')}
        </div>
        <button class="btn btn-ghost" onclick="document.body.removeChild(this.closest('.modal-overlay'))">Cancel</button>
      </div>`;
    overlay.addEventListener('click', e => { if (e.target===overlay) { document.body.removeChild(overlay); resolve(null); }});
    document.body.appendChild(overlay);
    const mo = new MutationObserver(() => { if (!document.body.contains(overlay)) { mo.disconnect(); resolve(overlay.dataset.choice||null); }});
    mo.observe(document.body, { childList: true });
  });
}
