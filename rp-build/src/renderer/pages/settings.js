/**
 * settings.js — Settings page · v1.8.0
 */

async function render_settings(container) {
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function fmtDate(iso) { return iso ? new Date(iso).toLocaleString([],{dateStyle:'medium',timeStyle:'short'}) : 'Never'; }

  const backupCfg = await window.api.backup.getConfig();
  const dataPath  = await window.api.backup.getDataPath();
  const version   = await window.api.updater.getVersion();
  const theme     = await window.api.store.get('theme') || {};

  container.innerHTML = `
  <div class="page" style="max-width:700px">
    <div class="page-header"><div><h1>Settings</h1><div class="subtitle">Backup, appearance, and app info</div></div></div>

    <!-- ── Backup ── -->
    <div class="card" style="margin-bottom:24px;border-color:var(--accent)">
      <div class="card-header" style="border-bottom-color:var(--accent)">
        <h3 style="color:var(--accent)">💾 Backup & Restore</h3>
        ${backupCfg.lastAt ? `<span class="chip chip-success">Last backup: ${fmtDate(backupCfg.lastAt)}</span>` : `<span class="chip chip-danger">No backup yet</span>`}
      </div>
      <div class="card-body">

        <div style="background:var(--card);border-radius:6px;padding:12px 14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div>
            <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:3px">Live Data File</div>
            <div style="font-size:11px;color:var(--text);word-break:break-all">${esc(dataPath)}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="openDataFolder()">Open Folder</button>
        </div>

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div>
            <div style="font-size:12px;font-weight:500">Backup Folder</div>
            <div class="text-muted text-sm" id="backup-folder-label">${backupCfg.lastFolder ? esc(backupCfg.lastFolder) : 'Not set'}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="chooseBackupFolder()">Choose…</button>
        </div>

        <div style="display:flex;align-items:center;gap:8px;margin-bottom:16px">
          <label class="toggle-label" style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="auto-backup-toggle" ${backupCfg.autoBackup?'checked':''} onchange="setAutoBackup(this.checked)" style="accent-color:var(--accent)"/>
            <span>Auto-backup on launch</span>
          </label>
          <span class="text-muted text-sm" style="margin-left:auto">Keep last
            <input type="number" id="keep-count" value="${backupCfg.keepCount||10}" min="1" max="50" onchange="setKeepCount(this.value)"
              style="width:50px;background:var(--card);border:1px solid var(--border);border-radius:4px;color:var(--text);padding:2px 6px;font-family:inherit;font-size:11px;text-align:center"/>
            backups
          </span>
        </div>

        <div style="display:flex;gap:8px">
          <button class="btn btn-primary btn-sm" onclick="saveBackupNow()">Save Backup Now</button>
          <button class="btn btn-ghost btn-sm" onclick="restoreBackup()">Restore from Backup…</button>
          ${backupCfg.lastFolder ? `<button class="btn btn-ghost btn-sm" onclick="window.api.backup.openFolder('${esc(backupCfg.lastFolder)}')">Open Backup Folder</button>` : ''}
        </div>

        ${backupCfg.lastFile ? `<div class="text-muted text-sm" style="margin-top:10px">Last file: ${esc(backupCfg.lastFile)}</div>` : ''}
      </div>
    </div>

    <!-- ── Appearance ── -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header"><h3>🎨 Appearance</h3></div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <label class="field-label">Accent Colour</label>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
              <input type="color" id="accent-color" value="${theme.accent||'#e8c547'}" onchange="applyThemeColor('accent',this.value)"
                style="width:36px;height:28px;border:none;background:none;cursor:pointer;border-radius:4px"/>
              <span class="text-muted text-sm" id="accent-label">${theme.accent||'#e8c547'}</span>
            </div>
          </div>
          <div>
            <label class="field-label">Background</label>
            <div style="display:flex;align-items:center;gap:8px;margin-top:4px">
              <input type="color" id="bg-color" value="${theme.bg||'#0e0e0e'}" onchange="applyThemeColor('bg',this.value)"
                style="width:36px;height:28px;border:none;background:none;cursor:pointer;border-radius:4px"/>
              <span class="text-muted text-sm" id="bg-label">${theme.bg||'#0e0e0e'}</span>
            </div>
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" style="margin-top:12px" onclick="resetTheme()">Reset to Default</button>
      </div>
    </div>

    <!-- ── Updates ── -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header"><h3>🔄 Updates</h3></div>
      <div class="card-body">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <div style="font-size:12px;font-weight:500">Current Version</div>
            <div class="text-muted text-sm">v${esc(version)} · Role Planner by Warren Dev</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="checkForUpdates()">Check for Updates</button>
        </div>
        <div id="update-status" class="text-muted text-sm" style="margin-top:8px"></div>
      </div>
    </div>

    <!-- ── About ── -->
    <div class="card">
      <div class="card-header"><h3>ℹ About</h3></div>
      <div class="card-body">
        <div style="font-size:12px;line-height:2;color:var(--muted)">
          <div><span style="color:var(--text)">App</span> — Role Planner v${esc(version)}</div>
          <div><span style="color:var(--text)">Company</span> — Warren Dev</div>
          <div><span style="color:var(--text)">Author</span> — Eddie Warren</div>
          <div><span style="color:var(--text)">Data</span> — Stored locally, never uploaded</div>
        </div>
      </div>
    </div>

  </div>`;

  // ── Handlers ──────────────────────────────────────────────────────────────

  window.openDataFolder = async () => {
    const folder = dataPath.replace(/[^\\\/]*$/, '');
    await window.api.backup.openFolder(folder);
  };

  window.chooseBackupFolder = async () => {
    const folder = await window.api.backup.chooseFolder();
    if (!folder) return;
    await window.api.backup.setConfig({ lastFolder: folder });
    document.getElementById('backup-folder-label').textContent = folder;
    toast('Backup folder set', 'success');
  };

  window.setAutoBackup = async (val) => {
    await window.api.backup.setConfig({ autoBackup: val });
  };

  window.setKeepCount = async (val) => {
    await window.api.backup.setConfig({ keepCount: parseInt(val) || 10 });
  };

  window.saveBackupNow = async () => {
    const cfg = await window.api.backup.getConfig();
    if (!cfg.lastFolder) {
      const folder = await window.api.backup.chooseFolder();
      if (!folder) return;
      await window.api.backup.setConfig({ lastFolder: folder });
    }
    const c2 = await window.api.backup.getConfig();
    const result = await window.api.backup.saveNow(c2.lastFolder);
    if (result.success) toast(`Backup saved: ${result.filename}`, 'success');
    else toast(`Backup failed: ${result.error}`, 'error');
  };

  window.restoreBackup = async () => {
    const result = await window.api.backup.restoreFile();
    if (!result) return;
    if (result.success) toast('Restored successfully — please restart the app', 'success');
    else toast(`Restore failed: ${result.error}`, 'error');
  };

  window.applyThemeColor = async (key, value) => {
    document.getElementById(`${key}-label`).textContent = value;
    // Apply immediately so user sees it
    const varMap = { accent: '--accent', bg: '--bg' };
    if (varMap[key]) document.documentElement.style.setProperty(varMap[key], value);
    // Save flat key AND inside custom so both paths work
    const t = await window.api.store.get('theme') || {};
    t[key] = value;
    if (!t.custom) t.custom = {};
    t.custom[varMap[key]] = value;
    await window.api.store.set('theme', t);
    // Don't call loadAndApplyTheme here — it would re-read and may flicker
  };

  window.resetTheme = async () => {
    await window.api.store.delete('theme');
    if (window.themeEngine) await window.themeEngine.loadAndApplyTheme();
    toast('Theme reset', 'info');
    await render_settings(container);
  };

  window.checkForUpdates = async () => {
    const el = document.getElementById('update-status');
    el.textContent = 'Checking…';
    await window.api.updater.check();
    window.api.on('updater:not-available', () => { el.textContent = 'You are on the latest version.'; });
    window.api.on('updater:error', (msg) => { el.textContent = `Error: ${msg}`; });
  };
}
