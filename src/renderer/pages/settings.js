/**
 * settings.js — Settings page
 * Includes: Auth, Azure config, OneNote sync, Backup (Google Drive / any folder), Data, About
 */

async function render_settings(container) {
  function esc(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  function fmtDate(iso) { return iso ? new Date(iso).toLocaleString([],{dateStyle:'medium',timeStyle:'short'}) : 'Never'; }

  const msalConfig  = await window.api.store.get('msalConfig') || {};
  const syncSection = await window.api.store.get('sync.oneNoteSectionId') || '';
  const authStatus  = await window.api.auth.status();
  const backupCfg   = await window.api.backup.getConfig();
  const dataPath    = await window.api.backup.getDataPath();

  container.innerHTML = `
  <div class="page" style="max-width:700px">
    <div class="page-header"><div><h1>Settings</h1><div class="subtitle">App configuration, backup and Microsoft 365</div></div></div>

    <!-- ── Auth Status ── -->
    <div class="card" style="margin-bottom:24px;border-color:${authStatus.loggedIn?'var(--success)':'var(--border)'}">
      <div class="card-body" style="display:flex;align-items:center;justify-content:space-between;gap:16px">
        <div>
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:20px">${authStatus.loggedIn?'✅':'❌'}</span>
            <span style="font-size:13px;font-weight:500">${authStatus.loggedIn?'Signed in to Microsoft 365':'Not signed in'}</span>
          </div>
          ${authStatus.loggedIn && authStatus.user ? `<div class="text-muted text-sm" style="margin-top:4px">${esc(authStatus.user.name||'')} · ${esc(authStatus.user.preferred_username||'')}</div>` : ''}
        </div>
        <button class="btn ${authStatus.loggedIn?'btn-danger':'btn-primary'} btn-sm" onclick="handleAuthClick()">${authStatus.loggedIn?'Sign Out':'Sign In'}</button>
      </div>
    </div>

    <!-- ── Backup ── -->
    <div class="card" style="margin-bottom:24px;border-color:var(--accent)">
      <div class="card-header" style="border-bottom-color:var(--accent)">
        <h3 style="color:var(--accent)">💾 Backup & Restore</h3>
        ${backupCfg.lastAt ? `<span class="chip chip-success">Last backup: ${fmtDate(backupCfg.lastAt)}</span>` : `<span class="chip chip-danger">No backup yet</span>`}
      </div>
      <div class="card-body">

        <!-- Data file location -->
        <div style="background:var(--card);border-radius:6px;padding:12px 14px;margin-bottom:16px;display:flex;align-items:center;justify-content:space-between;gap:12px">
          <div>
            <div style="font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--muted);margin-bottom:3px">Live Data File</div>
            <div style="font-size:11px;color:var(--text);word-break:break-all">${esc(dataPath)}</div>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="window.api.backup.openFolder('${esc(dataPath.replace(/[^\\\/]*$/, ''))}')">Open Folder</button>
        </div>

        <!-- Backup folder -->
        <div style="margin-bottom:16px">
          <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);margin-bottom:8px">Backup Destination</div>
          <div style="display:flex;gap:8px;align-items:center">
            <div id="backup-folder-display" style="flex:1;background:var(--card);border:1px solid var(--border);border-radius:4px;padding:8px 12px;font-size:12px;color:${backupCfg.lastFolder?'var(--text)':'var(--muted)'}">
              ${backupCfg.lastFolder ? esc(backupCfg.lastFolder) : 'No folder selected — click to choose'}
            </div>
            <button class="btn btn-ghost btn-sm" onclick="chooseBackupFolder()">📁 Browse</button>
            ${backupCfg.lastFolder ? `<button class="btn btn-ghost btn-sm" onclick="window.api.backup.openFolder('${esc(backupCfg.lastFolder)}')">↗ Open</button>` : ''}
          </div>
          <div class="text-muted text-sm" style="margin-top:6px">
            💡 Set this to your <strong style="color:var(--text)">Google Drive</strong> folder (e.g. <code>C:\Users\ADMIN\Google Drive\Backups</code>) for automatic cloud backup
          </div>
        </div>

        <!-- Auto backup toggle -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--card);border-radius:6px;margin-bottom:16px">
          <div>
            <div style="font-size:12px;font-weight:500">Auto-backup on app launch</div>
            <div class="text-muted text-sm">Automatically saves a backup every time you open Role Planner</div>
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
            <input type="checkbox" id="auto-backup-toggle" ${backupCfg.autoBackup?'checked':''} onchange="toggleAutoBackup()" style="accent-color:var(--accent);width:16px;height:16px"/>
            <span style="font-size:12px;color:var(--muted)">${backupCfg.autoBackup?'On':'Off'}</span>
          </label>
        </div>

        <!-- Keep count -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--card);border-radius:6px;margin-bottom:20px">
          <div>
            <div style="font-size:12px;font-weight:500">Keep last N backups</div>
            <div class="text-muted text-sm">Older backups are automatically deleted to save space</div>
          </div>
          <select id="keep-count" onchange="saveKeepCount()" style="background:var(--surface);border:1px solid var(--border);border-radius:4px;color:var(--text);font-family:'DM Mono',monospace;font-size:12px;padding:6px 10px;outline:none">
            <option value="5"  ${backupCfg.keepCount===5 ?'selected':''}>5 backups</option>
            <option value="10" ${backupCfg.keepCount===10||!backupCfg.keepCount?'selected':''}>10 backups</option>
            <option value="20" ${backupCfg.keepCount===20?'selected':''}>20 backups</option>
            <option value="50" ${backupCfg.keepCount===50?'selected':''}>50 backups</option>
          </select>
        </div>

        <!-- Last backup info -->
        ${backupCfg.lastFile ? `
        <div style="padding:10px 14px;background:var(--card);border-radius:6px;margin-bottom:16px;border-left:3px solid var(--success)">
          <div style="font-size:10px;color:var(--muted);margin-bottom:2px">Last backup file</div>
          <div style="font-size:11px;color:var(--text)">${esc(backupCfg.lastFile)}</div>
          <div style="font-size:10px;color:var(--muted);margin-top:2px">${fmtDate(backupCfg.lastAt)}</div>
        </div>` : ''}

        <!-- Action buttons -->
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <button class="btn btn-primary" onclick="backupNow()">💾 Backup Now</button>
          <button class="btn btn-ghost" onclick="restoreBackup()">↩ Restore from Backup</button>
        </div>
      </div>
    </div>

    <!-- ── Appearance ── -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header"><h3>🎨 Appearance</h3></div>
      <div class="card-body" id="appearance-body">
        <div class="loading-screen" style="height:80px"><div class="spinner"></div></div>
      </div>
    </div>

    <!-- ── Azure ── -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header"><h3>Microsoft Azure App Registration</h3></div>
      <div class="card-body">
        <div style="background:var(--card);border-radius:6px;padding:16px;margin-bottom:20px;border-left:3px solid var(--accent)">
          <div style="font-size:12px;font-weight:500;margin-bottom:8px;color:var(--accent)">Setup Instructions</div>
          <div style="font-size:11px;color:var(--muted);line-height:2">
            1. Go to <strong style="color:var(--text)">portal.azure.com</strong> → Azure Active Directory → App Registrations → New Registration<br/>
            2. Name: <strong style="color:var(--text)">Role Planner</strong> · Redirect URI (Public client): <code style="color:var(--accent)">http://localhost:3737/auth/callback</code><br/>
            3. Copy <strong style="color:var(--text)">Application (client) ID</strong> and <strong style="color:var(--text)">Directory (tenant) ID</strong><br/>
            4. API Permissions → Add: <code style="color:var(--accent)">Calendars.ReadWrite</code>, <code style="color:var(--accent)">Notes.ReadWrite.All</code>, <code style="color:var(--accent)">User.Read</code><br/>
            5. Authentication → Advanced settings → Allow public client flows: <strong style="color:var(--text)">Yes</strong>
          </div>
        </div>
        <div class="field"><label>Application (Client) ID</label>
          <input id="cfg-clientId" type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" value="${esc(msalConfig.clientId||'')}"/>
        </div>
        <div class="field"><label>Directory (Tenant) ID</label>
          <input id="cfg-tenantId" type="text" placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx or 'common'" value="${esc(msalConfig.tenantId||'')}"/>
        </div>
        <div class="field"><label>Redirect URI</label>
          <input id="cfg-redirect" type="text" value="${esc(msalConfig.redirectUri||'http://localhost:3737/auth/callback')}"/>
        </div>
        <button class="btn btn-primary" onclick="saveMsalConfig()">Save Credentials</button>
      </div>
    </div>

    <!-- ── OneNote Sync ── -->
    <div class="card" style="margin-bottom:24px">
      <div class="card-header"><h3>OneNote Sync</h3></div>
      <div class="card-body">
        <p class="text-muted text-sm" style="margin-bottom:16px;line-height:1.8">
          Role notes are synced to OneNote as the source of truth — meaning a future mobile app can read the same data from the same Microsoft account.
        </p>
        <div class="field"><label>Sync Section ID</label>
          <input id="cfg-syncSection" type="text" placeholder="Paste a OneNote section ID" value="${esc(syncSection)}"/>
        </div>
        <div style="display:flex;gap:8px">
          <button class="btn btn-primary" onclick="saveSyncConfig()">Save</button>
          <button class="btn btn-ghost" onclick="navigate('onenote')">Browse Sections →</button>
        </div>
      </div>
    </div>

    <!-- ── About ── -->
    <div class="card">
      <div class="card-header"><h3>About</h3></div>
      <div class="card-body">
        <div style="display:flex;align-items:center;gap:20px;margin-bottom:16px">
          <div style="font-size:40px">◈</div>
          <div>
            <div style="font-family:'Playfair Display',serif;font-size:20px;font-weight:900;color:var(--accent)">Role Planner</div>
            <div style="font-size:11px;color:var(--muted);margin-top:2px">Version 1.7.0</div>
          </div>
        </div>
        <div style="background:var(--card);border-radius:6px;padding:14px;border-left:3px solid var(--accent)">
          <div style="font-size:12px;font-weight:500;margin-bottom:4px">Eddie Warren</div>
          <div style="font-size:11px;color:var(--muted)">Warren Dev</div>
          <div style="font-size:11px;color:var(--muted);margin-top:8px">Copyright © 2025 Eddie Warren / Warren Dev. All rights reserved.</div>
        </div>
        <div class="text-muted text-sm" style="margin-top:14px;line-height:2">
          Built with Electron + Microsoft Graph API<br/>
          Teams Calendar · OneNote · Windows Notifications · Local Calendar
        </div>
      </div>
    </div>

  </div>`;

  // ── Backup handlers ──────────────────────────────────────────────────────────
  window.chooseBackupFolder = async () => {
    const folder = await window.api.backup.chooseFolder();
    if (!folder) return;
    await window.api.backup.setConfig({ lastFolder: folder });
    toast('Backup folder set ✓', 'success');
    navigate('settings');
  };

  window.backupNow = async () => {
    const cfg = await window.api.backup.getConfig();
    if (!cfg.lastFolder) {
      toast('Choose a backup folder first', 'error');
      return;
    }
    toast('Backing up…', 'info');
    const result = await window.api.backup.saveNow(cfg.lastFolder);
    if (result.success) {
      toast(`Backed up ✓  ${result.filename}`, 'success');
      navigate('settings'); // refresh to show new last-backup time
    } else {
      toast('Backup failed: ' + result.error, 'error');
    }
  };

  window.restoreBackup = async () => {
    if (!confirm('Restoring will overwrite your current data. Make sure you have a recent backup first. Continue?')) return;
    const result = await window.api.backup.restoreFile();
    if (!result) return; // cancelled
    if (result.success) {
      toast(`Restored from backup (exported ${fmtDate(result.exportedAt)}) ✓`, 'success');
      navigate('roles');
    } else {
      toast('Restore failed: ' + result.error, 'error');
    }
  };

  window.toggleAutoBackup = async () => {
    const on = document.getElementById('auto-backup-toggle').checked;
    await window.api.backup.setConfig({ autoBackup: on });
    document.querySelector('#auto-backup-toggle + span').textContent = on ? 'On' : 'Off';
    toast(`Auto-backup ${on?'enabled':'disabled'}`, 'info');
  };

  window.saveKeepCount = async () => {
    const val = parseInt(document.getElementById('keep-count').value);
    await window.api.backup.setConfig({ keepCount: val });
    toast(`Will keep last ${val} backups`, 'info');
  };

  // ── Other handlers ────────────────────────────────────────────────────────────
  window.saveMsalConfig = async () => {
    const clientId    = document.getElementById('cfg-clientId').value.trim();
    const tenantId    = document.getElementById('cfg-tenantId').value.trim() || 'common';
    const redirectUri = document.getElementById('cfg-redirect').value.trim();
    if (!clientId) { toast('Client ID is required', 'error'); return; }
    await window.api.store.set('msalConfig', { clientId, tenantId, redirectUri });
    toast('Credentials saved ✓', 'success');
  };

  // ── Appearance ────────────────────────────────────────────────────────────────
  async function renderAppearance() {
    const settings = await window.api.store.get('theme') || {};
    const mode     = settings.mode   || 'dark';
    const font     = settings.font   || 'DM Mono';
    const custom   = settings.custom || {};
    const { THEMES, FONTS, PRESETS } = window.themeEngine;

    const body = document.getElementById('appearance-body');
    if (!body) return;

    body.innerHTML = `
      <!-- Mode -->
      <div style="margin-bottom:20px">
        <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);margin-bottom:10px">Colour Mode</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          ${['dark','light','system'].map(m => `
            <div onclick="setMode('${m}')" id="mode-${m}"
                 style="padding:12px 20px;border-radius:6px;cursor:pointer;border:2px solid ${mode===m?'var(--accent)':'var(--border)'};background:${mode===m?'rgba(232,197,71,0.08)':'var(--card)'};transition:all 0.15s;text-align:center;min-width:90px">
              <div style="font-size:18px;margin-bottom:4px">${m==='dark'?'🌙':m==='light'?'☀️':'⚙️'}</div>
              <div style="font-size:12px;font-weight:500;color:${mode===m?'var(--accent)':'var(--text)'}">${m.charAt(0).toUpperCase()+m.slice(1)}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Accent presets -->
      <div style="margin-bottom:20px">
        <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);margin-bottom:10px">Accent Colour</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:10px">
          ${PRESETS.map(p => `
            <div onclick="setAccentPreset('${p.accent}')" title="${esc(p.name)}"
                 style="width:32px;height:32px;border-radius:50%;background:${p.accent};cursor:pointer;border:3px solid ${(custom['--accent']||THEMES[mode==='system'?(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):mode]?.['--accent']||'#e8c547')===p.accent?'#fff':'transparent'};transition:border 0.1s;box-shadow:0 0 0 1px rgba(0,0,0,0.2)"></div>`).join('')}
          <div style="display:flex;align-items:center;gap:6px;margin-left:4px">
            <input type="color" id="accent-picker" value="${custom['--accent']||'#e8c547'}" oninput="previewAccent(this.value)" onchange="setAccentCustom(this.value)"
                   style="width:32px;height:32px;border:none;border-radius:50%;cursor:pointer;background:none;padding:0" title="Custom colour"/>
            <span style="font-size:11px;color:var(--muted)">Custom</span>
          </div>
        </div>
      </div>

      <!-- Font -->
      <div style="margin-bottom:20px">
        <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);margin-bottom:10px">Font</div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:8px">
          ${Object.keys(FONTS).map(f => `
            <div onclick="setFont('${f}')"
                 style="padding:12px 14px;border-radius:6px;cursor:pointer;border:2px solid ${font===f?'var(--accent)':'var(--border)'};background:${font===f?'rgba(232,197,71,0.08)':'var(--card)'};transition:all 0.15s">
              <div style="font-family:${FONTS[f].body};font-size:14px;margin-bottom:3px;color:${font===f?'var(--accent)':'var(--text)'}">Aa Bb Cc</div>
              <div style="font-size:10px;color:var(--muted)">${f}</div>
            </div>`).join('')}
        </div>
      </div>

      <!-- Custom colours -->
      <div style="margin-bottom:20px">
        <div style="font-size:9px;letter-spacing:3px;text-transform:uppercase;color:var(--muted);margin-bottom:10px">Custom Colours</div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          ${[
            { key:'--bg',      label:'Background'    },
            { key:'--sidebar-bg', label:'Sidebar'    },
            { key:'--card',    label:'Cards'         },
            { key:'--text',    label:'Text'          },
            { key:'--accent',  label:'Accent'        },
          ].map(({key,label}) => {
            const resolvedMode2 = mode==='system'?(window.matchMedia('(prefers-color-scheme:dark)').matches?'dark':'light'):mode;
            const baseVal = THEMES[resolvedMode2]?.[key] || '#000000';
            const curVal  = custom[key] || baseVal;
            return `
            <div style="display:flex;align-items:center;gap:10px;padding:10px 12px;background:var(--card);border-radius:6px;border:1px solid var(--border)">
              <input type="color" value="${esc(curVal)}" oninput="previewVar('${key}',this.value)" onchange="setCustomVar('${key}',this.value)"
                     style="width:28px;height:28px;border:none;border-radius:4px;cursor:pointer;padding:0;background:none"/>
              <div>
                <div style="font-size:12px">${label}</div>
                <div style="font-size:10px;color:var(--muted)" id="var-val-${key.replace('--','')}">${curVal}</div>
              </div>
              <button onclick="resetVar('${key}')" class="btn btn-ghost btn-sm" style="margin-left:auto;font-size:10px;padding:2px 8px">↺</button>
            </div>`;
          }).join('')}
        </div>
      </div>

      <!-- Reset -->
      <div style="display:flex;gap:10px">
        <button class="btn btn-ghost" onclick="resetTheme()">↺ Reset to defaults</button>
        <div style="font-size:11px;color:var(--muted);align-self:center">Changes apply instantly and are saved automatically</div>
      </div>`;

    // Attach handlers
    window.setMode = async (m) => {
      const s = await window.api.store.get('theme')||{};
      s.mode = m; await window.themeEngine.saveTheme(s);
      renderAppearance();
    };

    window.setFont = async (f) => {
      const s = await window.api.store.get('theme')||{};
      s.font = f; await window.themeEngine.saveTheme(s);
      renderAppearance();
    };

    window.setAccentPreset = async (color) => {
      const s = await window.api.store.get('theme')||{};
      if (!s.custom) s.custom = {};
      s.custom['--accent'] = color;
      await window.themeEngine.saveTheme(s);
      renderAppearance();
    };

    window.setAccentCustom = async (color) => {
      const s = await window.api.store.get('theme')||{};
      if (!s.custom) s.custom = {};
      s.custom['--accent'] = color;
      await window.themeEngine.saveTheme(s);
    };

    window.previewAccent = (color) => {
      document.documentElement.style.setProperty('--accent', color);
    };

    window.previewVar = (key, val) => {
      document.documentElement.style.setProperty(key, val);
      const el = document.getElementById('var-val-' + key.replace('--',''));
      if (el) el.textContent = val;
    };

    window.setCustomVar = async (key, val) => {
      const s = await window.api.store.get('theme')||{};
      if (!s.custom) s.custom = {};
      s.custom[key] = val;
      await window.themeEngine.saveTheme(s);
    };

    window.resetVar = async (key) => {
      const s = await window.api.store.get('theme')||{};
      if (s.custom) delete s.custom[key];
      await window.themeEngine.saveTheme(s);
      renderAppearance();
    };

    window.resetTheme = async () => {
      if (!confirm('Reset all appearance settings to defaults?')) return;
      await window.api.store.set('theme', {});
      window.themeEngine.applyTheme({});
      renderAppearance();
      toast('Theme reset ✓', 'info');
    };
  }

  renderAppearance();

  window.saveSyncConfig = async () => {
    const sectionId = document.getElementById('cfg-syncSection').value.trim();
    await window.api.store.set('sync.oneNoteSectionId', sectionId);
    toast('Sync section saved ✓', 'success');
  };
}
