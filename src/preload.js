const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {

  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close:    () => ipcRenderer.send('window:close'),
  },

  store: {
    get:    (key)        => ipcRenderer.invoke('store:get', key),
    set:    (key, value) => ipcRenderer.invoke('store:set', key, value),
    delete: (key)        => ipcRenderer.invoke('store:delete', key),
  },

  updater: {
    check:      () => ipcRenderer.invoke('updater:check'),
    download:   () => ipcRenderer.invoke('updater:download'),
    install:    () => ipcRenderer.invoke('updater:install'),
    getVersion: () => ipcRenderer.invoke('updater:getVersion'),
  },

  backup: {
    getDataPath:  ()           => ipcRenderer.invoke('backup:getDataPath'),
    chooseFolder: ()           => ipcRenderer.invoke('backup:chooseFolder'),
    saveNow:      (folderPath) => ipcRenderer.invoke('backup:saveNow', folderPath),
    getConfig:    ()           => ipcRenderer.invoke('backup:getConfig'),
    setConfig:    (config)     => ipcRenderer.invoke('backup:setConfig', config),
    openFolder:   (folderPath) => ipcRenderer.invoke('backup:openFolder', folderPath),
    restoreFile:  ()           => ipcRenderer.invoke('backup:restoreFile'),
  },

  notifications: {
    getAll:   ()                 => ipcRenderer.invoke('notifications:getAll'),
    save:     (notifications)    => ipcRenderer.invoke('notifications:save', notifications),
    testFire: (title, body)      => ipcRenderer.invoke('notifications:testFire', title, body),
    snooze:   (notifId, minutes) => ipcRenderer.invoke('notifications:snooze', notifId, minutes),
  },

  on:  (channel, callback) => {
    const allowed = ['notification:clicked', 'updater:available', 'updater:not-available',
                     'updater:progress', 'updater:downloaded', 'updater:error'];
    if (allowed.includes(channel)) ipcRenderer.on(channel, (_e, ...args) => callback(...args));
  },
  off: (channel) => ipcRenderer.removeAllListeners(channel),
});
