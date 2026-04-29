const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, shell, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');
const { autoUpdater } = require('electron-updater');
const notificationModule = require('./modules/notifications');

// ─── Global State ─────────────────────────────────────────────────────────────
let mainWindow = null;
let tray = null;
const store = new Store();
const isDev = process.argv.includes('--dev');

// ─── Auto Updater ─────────────────────────────────────────────────────────────
function setupAutoUpdater() {
  if (isDev) return; // Don't check for updates in dev mode

  autoUpdater.autoDownload = false; // Ask user first

  autoUpdater.on('update-available', (info) => {
    mainWindow.webContents.send('updater:available', info);
  });

  autoUpdater.on('update-not-available', () => {
    mainWindow.webContents.send('updater:not-available');
  });

  autoUpdater.on('download-progress', (progress) => {
    mainWindow.webContents.send('updater:progress', progress);
  });

  autoUpdater.on('update-downloaded', () => {
    mainWindow.webContents.send('updater:downloaded');
  });

  autoUpdater.on('error', (err) => {
    mainWindow.webContents.send('updater:error', err.message);
  });

  // Check on launch, then every 4 hours
  autoUpdater.checkForUpdates();
  setInterval(() => autoUpdater.checkForUpdates(), 4 * 60 * 60 * 1000);
}

// ─── Window ───────────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 900,
    minHeight: 600,
    frame: false,
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
      mainWindow.hide();
    }
  });

  if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
}

// ─── System Tray ─────────────────────────────────────────────────────────────
function createTray() {
  const icon = nativeImage.createEmpty();
  tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    { label: 'Open Role Planner', click: () => { mainWindow.show(); mainWindow.focus(); } },
    { type: 'separator' },
    { label: 'Check for Updates', click: () => { if (!isDev) autoUpdater.checkForUpdates(); } },
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
  setupAutoUpdater();

  // Auto-backup on launch
  const autoBackup = store.get('backup.auto');
  const backupFolder = store.get('backup.lastFolder');
  if (autoBackup && backupFolder) {
    const fs = require('fs');
    try {
      const date = new Date().toISOString().slice(0, 10);
      const time = new Date().toTimeString().slice(0, 5).replace(':', '-');
      const filename = `role-planner-backup-${date}-${time}.json`;
      const dest = path.join(backupFolder, filename);
      const data = {
        roles: store.get('roles') || [],
        roleGroups: store.get('roleGroups') || [],
        notifications: store.get('notifications') || [],
        localBlocks: store.get('localcal.blocks') || [],
        exportedAt: new Date().toISOString(),
        version: app.getVersion(),
      };
      fs.writeFileSync(dest, JSON.stringify(data, null, 2), 'utf8');
      store.set('backup.lastAt', new Date().toISOString());
      store.set('backup.lastFile', filename);

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

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); else mainWindow.show(); });

// ─── IPC: Window Controls ─────────────────────────────────────────────────────
ipcMain.on('window:minimize', () => mainWindow.minimize());
ipcMain.on('window:maximize', () => { mainWindow.isMaximized() ? mainWindow.unmaximize() : mainWindow.maximize(); });
ipcMain.on('window:close', () => mainWindow.hide());

// ─── IPC: Store ───────────────────────────────────────────────────────────────
ipcMain.handle('store:get', (_e, key) => store.get(key));
ipcMain.handle('store:set', (_e, key, value) => { store.set(key, value); return true; });
ipcMain.handle('store:delete', (_e, key) => { store.delete(key); return true; });

// ─── IPC: Auto Updater ────────────────────────────────────────────────────────
ipcMain.handle('updater:check', () => { if (!isDev) autoUpdater.checkForUpdates(); });
ipcMain.handle('updater:download', () => autoUpdater.downloadUpdate());
ipcMain.handle('updater:install', () => { app.isQuiting = true; autoUpdater.quitAndInstall(); });
ipcMain.handle('updater:getVersion', () => app.getVersion());

// ─── IPC: Backup ──────────────────────────────────────────────────────────────
ipcMain.handle('backup:getDataPath', () => store.path);

ipcMain.handle('backup:chooseFolder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Choose Backup Folder',
    properties: ['openDirectory', 'createDirectory'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  return result.filePaths[0];
});

ipcMain.handle('backup:saveNow', async (_e, folderPath) => {
  const fs = require('fs');
  try {
    const date = new Date().toISOString().slice(0, 10);
    const time = new Date().toTimeString().slice(0, 5).replace(':', '-');
    const filename = `role-planner-backup-${date}-${time}.json`;
    const dest = path.join(folderPath, filename);
    const data = {
      roles: store.get('roles') || [],
      roleGroups: store.get('roleGroups') || [],
      notifications: store.get('notifications') || [],
      localBlocks: store.get('localcal.blocks') || [],
      exportedAt: new Date().toISOString(),
      version: app.getVersion(),
    };
    fs.writeFileSync(dest, JSON.stringify(data, null, 2), 'utf8');
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
  lastAt: store.get('backup.lastAt') || null,
  lastFile: store.get('backup.lastFile') || null,
  autoBackup: store.get('backup.auto') || false,
  keepCount: store.get('backup.keepCount') || 10,
}));

ipcMain.handle('backup:setConfig', (_e, config) => {
  if (config.lastFolder !== undefined) store.set('backup.lastFolder', config.lastFolder);
  if (config.autoBackup !== undefined) store.set('backup.auto', config.autoBackup);
  if (config.keepCount !== undefined) store.set('backup.keepCount', config.keepCount);
  return { success: true };
});

ipcMain.handle('backup:openFolder', (_e, folderPath) => shell.openPath(folderPath));

ipcMain.handle('backup:restoreFile', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    title: 'Restore from Backup',
    filters: [{ name: 'JSON Backup', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (result.canceled || !result.filePaths.length) return null;
  const fs = require('fs');
  try {
    const raw = fs.readFileSync(result.filePaths[0], 'utf8');
    const data = JSON.parse(raw);
    if (data.roles) store.set('roles', data.roles);
    if (data.roleGroups) store.set('roleGroups', data.roleGroups);
    if (data.notifications) store.set('notifications', data.notifications);
    if (data.localBlocks) store.set('localcal.blocks', data.localBlocks);
    return { success: true, exportedAt: data.exportedAt };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

// ─── IPC: Notifications ───────────────────────────────────────────────────────
ipcMain.handle('notifications:getAll', () => notificationModule.getAll(store));
ipcMain.handle('notifications:save', (_e, notifications) => notificationModule.saveAll(store, notifications));
ipcMain.handle('notifications:testFire', (_e, title, body) => notificationModule.fire(title, body, mainWindow));
ipcMain.handle('notifications:snooze', (_e, notifId, minutes) => notificationModule.snooze(store, notifId, minutes, mainWindow));
