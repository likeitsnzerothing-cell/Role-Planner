const { app, BrowserWindow, ipcMain, Notification, Tray, Menu, nativeImage, shell } = require('electron');
const path = require('path');
const Store = require('electron-store');
const cron = require('node-cron');
const authModule = require('./modules/auth');
const calendarModule = require('./modules/calendar');
const onenoteModule = require('./modules/onenote');
const notificationModule = require('./modules/notifications');

// ─── Global State ────────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
const store = new Store();
const isDev = process.argv.includes('--dev');

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    frame: false,          // custom titlebar
    backgroundColor: '#0e0e0e',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    show: false,
  });

  mainWindow.loadFile(path.join(__dirname, 'renderer', 'index.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('close', (e) => {
    if (!app.isQuiting) {
      e.preventDefault();
      mainWindow.hide();  // minimise to tray instead of closing
    }
  });

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

// ─── System Tray ─────────────────────────────────────────────────────────────
function createTray() {
  // Use a 16x16 blank image as fallback if no icon file present
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    { label: 'Open Role Planner', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Quit', click: () => { app.isQuiting = true; app.quit(); } },
  ]);
  tray.setToolTip('Role Planner');
  tray.setContextMenu(menu);
  tray.on('double-click', () => { mainWindow.show(); mainWindow.focus(); });
}

// ─── App Lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createTray();
  notificationModule.init(store, mainWindow);
  notificationModule.startScheduler(store, mainWindow);

  // Auto-backup on launch if enabled and folder is set
  const autoBackup  = store.get('backup.auto');
  const backupFolder = store.get('backup.lastFolder');
  if (autoBackup && backupFolder) {
    const fs   = require('fs');
    const path = require('path');
    try {
      const date     = new Date().toISOString().slice(0,10);
      const time     = new Date().toTimeString().slice(0,5).replace(':','-');
      const filename = `role-planner-backup-${date}-${time}.json`;
      const dest     = path.join(backupFolder, filename);
      const data = {
        roles:         store.get('roles')           || [],
        roleGroups:    store.get('roleGroups')       || [],
        notifications: store.get('notifications')   || [],
        localBlocks:   store.get('localcal.blocks') || [],
        exportedAt:    new Date().toISOString(),
        version:       '1.0.0',
      };
      fs.writeFileSync(dest, JSON.stringify(data, null, 2), 'utf8');
      store.set('backup.lastAt',   new Date().toISOString());
      store.set('backup.lastFile', filename);

      // Prune old backups
      const keepCount = store.get('backup.keepCount') || 10;
      const files = fs.readdirSync(backupFolder)
        .filter(f => f.startsWith('role-planner-backup-') && f.endsWith('.json'))
        .sort();
      if (files.length > keepCount) {
        files.slice(0, files.length - keepCount).forEach(f => {
          try { fs.unlinkSync(path.join(backupFolder, f)); } catch {}
        });
      }
    } catch (err) {
      console.error('Auto-backup failed:', err.message);
    }
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
  else mainWindow.show();
});

// ─── IPC: Window Controls ────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:maximize', () => {
  mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize();
});
ipcMain.on('window:close', () => mainWindow.hide());

// ─── IPC: Store (Roles & Tasks) ──────────────────────────────────────────────
ipcMain.handle('store:get', (_e, key) => store.get(key));
ipcMain.handle('store:set', (_e, key, value) => { store.set(key, value); return true; });
ipcMain.handle('store:delete', (_e, key) => { store.delete(key); return true; });

// ─── IPC: Auth ────────────────────────────────────────────────────────────────
ipcMain.handle('auth:login', async () => authModule.login(mainWindow));
ipcMain.handle('auth:logout', async () => authModule.logout(store));
ipcMain.handle('auth:status', async () => authModule.getStatus(store));
ipcMain.handle('auth:getToken', async () => authModule.getToken(store));

// ─── IPC: Calendar ───────────────────────────────────────────────────────────
ipcMain.handle('calendar:getEvents', async (_e, days) => {
  const token = await authModule.getToken(store);
  return calendarModule.getEvents(token, days);
});
ipcMain.handle('calendar:createEvent', async (_e, eventData) => {
  const token = await authModule.getToken(store);
  return calendarModule.createEvent(token, eventData);
});
ipcMain.handle('calendar:deleteEvent', async (_e, eventId) => {
  const token = await authModule.getToken(store);
  return calendarModule.deleteEvent(token, eventId);
});
ipcMain.handle('calendar:updateEvent', async (_e, eventId, eventData) => {
  const token = await authModule.getToken(store);
  return calendarModule.updateEvent(token, eventId, eventData);
});

// ─── IPC: OneNote ─────────────────────────────────────────────────────────────
ipcMain.handle('onenote:getNotebooks', async () => {
  const token = await authModule.getToken(store);
  return onenoteModule.getNotebooks(token);
});
ipcMain.handle('onenote:getPages', async (_e, sectionId) => {
  const token = await authModule.getToken(store);
  return onenoteModule.getPages(token, sectionId);
});
ipcMain.handle('onenote:getSections', async (_e, notebookId) => {
  const token = await authModule.getToken(store);
  return onenoteModule.getSections(token, notebookId);
});
ipcMain.handle('onenote:createPage', async (_e, sectionId, title, content) => {
  const token = await authModule.getToken(store);
  return onenoteModule.createPage(token, sectionId, title, content);
});
ipcMain.handle('onenote:updatePage', async (_e, pageId, content) => {
  const token = await authModule.getToken(store);
  return onenoteModule.updatePage(token, pageId, content);
});
ipcMain.handle('onenote:getRecentPages', async () => {
  const token = await authModule.getToken(store);
  return onenoteModule.getRecentPages(token);
});
ipcMain.handle('onenote:openInBrowser', async (_e, webUrl) => {
  shell.openExternal(webUrl);
});

// ─── IPC: Backup ──────────────────────────────────────────────────────────────
ipcMain.handle('backup:getDataPath', () => {
  return store.path;
});

ipcMain.handle('backup:chooseFolder', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose Backup Folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('backup:saveNow', async (_e, folderPath) => {
  const fs   = require('fs');
  const path = require('path');
  try {
    const date     = new Date().toISOString().slice(0, 10);
    const time     = new Date().toTimeString().slice(0, 5).replace(':', '-');
    const filename = `role-planner-backup-${date}-${time}.json`;
    const dest     = path.join(folderPath, filename);

    const data = {
      roles:         store.get('roles')         || [],
      roleGroups:    store.get('roleGroups')     || [],
      notifications: store.get('notifications') || [],
      localBlocks:   store.get('localcal.blocks') || [],
      exportedAt:    new Date().toISOString(),
      version:       '1.0.0',
    };

    fs.writeFileSync(dest, JSON.stringify(data, null, 2), 'utf8');

    // Save last backup info
    store.set('backup.lastFolder', folderPath);
    store.set('backup.lastAt', new Date().toISOString());
    store.set('backup.lastFile', filename);

    return { success: true, path: dest, filename };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('backup:getConfig', () => ({
  lastFolder: store.get('backup.lastFolder') || null,
  lastAt:     store.get('backup.lastAt')     || null,
  lastFile:   store.get('backup.lastFile')   || null,
  autoBackup: store.get('backup.auto')       || false,
  keepCount:  store.get('backup.keepCount')  || 10,
}));

ipcMain.handle('backup:setConfig', (_e, config) => {
  if (config.lastFolder !== undefined) store.set('backup.lastFolder', config.lastFolder);
  if (config.autoBackup !== undefined) store.set('backup.auto',       config.autoBackup);
  if (config.keepCount  !== undefined) store.set('backup.keepCount',  config.keepCount);
  return { success: true };
});

ipcMain.handle('backup:openFolder', (_e, folderPath) => {
  shell.openPath(folderPath);
});

ipcMain.handle('backup:restoreFile', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Restore from Backup',
    filters: [{ name: 'JSON Backup', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const fs   = require('fs');
  try {
    const raw  = fs.readFileSync(result.filePaths[0], 'utf8');
    const data = JSON.parse(raw);
    if (data.roles)         store.set('roles',            data.roles);
    if (data.roleGroups)    store.set('roleGroups',       data.roleGroups);
    if (data.notifications) store.set('notifications',   data.notifications);
    if (data.localBlocks)   store.set('localcal.blocks', data.localBlocks);
    return { success: true, exportedAt: data.exportedAt };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── IPC: Notifications ───────────────────────────────────────────────────────
ipcMain.handle('notifications:getAll', () => notificationModule.getAll(store));
ipcMain.handle('notifications:save', (_e, notifications) => notificationModule.saveAll(store, notifications));
ipcMain.handle('notifications:testFire', (_e, title, body) => {
  notificationModule.fire(title, body, mainWindow);
});
ipcMain.handle('notifications:snooze', (_e, notifId, minutes) => {
  notificationModule.snooze(store, notifId, minutes, mainWindow);
});
