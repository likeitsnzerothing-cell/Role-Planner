const { contextBridge, ipcRenderer } = require('electron');

// Expose a safe, typed API to the renderer process
contextBridge.exposeInMainWorld('api', {

  // ── Window Controls ────────────────────────────────────────────────────────
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close:    () => ipcRenderer.send('window:close'),
  },

  // ── Local Store ────────────────────────────────────────────────────────────
  store: {
    get:    (key)        => ipcRenderer.invoke('store:get', key),
    set:    (key, value) => ipcRenderer.invoke('store:set', key, value),
    delete: (key)        => ipcRenderer.invoke('store:delete', key),
  },

  // ── Auth ───────────────────────────────────────────────────────────────────
  auth: {
    login:    ()  => ipcRenderer.invoke('auth:login'),
    logout:   ()  => ipcRenderer.invoke('auth:logout'),
    status:   ()  => ipcRenderer.invoke('auth:status'),
    getToken: ()  => ipcRenderer.invoke('auth:getToken'),
  },

  // ── Calendar ───────────────────────────────────────────────────────────────
  calendar: {
    getEvents:   (days)               => ipcRenderer.invoke('calendar:getEvents', days),
    createEvent: (eventData)          => ipcRenderer.invoke('calendar:createEvent', eventData),
    deleteEvent: (eventId)            => ipcRenderer.invoke('calendar:deleteEvent', eventId),
    updateEvent: (eventId, eventData) => ipcRenderer.invoke('calendar:updateEvent', eventId, eventData),
  },

  // ── OneNote ────────────────────────────────────────────────────────────────
  onenote: {
    getNotebooks:  ()                          => ipcRenderer.invoke('onenote:getNotebooks'),
    getSections:   (notebookId)                => ipcRenderer.invoke('onenote:getSections', notebookId),
    getPages:      (sectionId)                 => ipcRenderer.invoke('onenote:getPages', sectionId),
    createPage:    (sectionId, title, content) => ipcRenderer.invoke('onenote:createPage', sectionId, title, content),
    updatePage:    (pageId, content)           => ipcRenderer.invoke('onenote:updatePage', pageId, content),
    getRecentPages:()                          => ipcRenderer.invoke('onenote:getRecentPages'),
    openInBrowser: (webUrl)                    => ipcRenderer.invoke('onenote:openInBrowser', webUrl),
  },

  // ── Backup ─────────────────────────────────────────────────────────────────
  backup: {
    getDataPath:  ()             => ipcRenderer.invoke('backup:getDataPath'),
    chooseFolder: ()             => ipcRenderer.invoke('backup:chooseFolder'),
    saveNow:      (folderPath)   => ipcRenderer.invoke('backup:saveNow', folderPath),
    getConfig:    ()             => ipcRenderer.invoke('backup:getConfig'),
    setConfig:    (config)       => ipcRenderer.invoke('backup:setConfig', config),
    openFolder:   (folderPath)   => ipcRenderer.invoke('backup:openFolder', folderPath),
    restoreFile:  ()             => ipcRenderer.invoke('backup:restoreFile'),
  },

  // ── Notifications ──────────────────────────────────────────────────────────
  notifications: {
    getAll:    ()                    => ipcRenderer.invoke('notifications:getAll'),
    save:      (notifications)       => ipcRenderer.invoke('notifications:save', notifications),
    testFire:  (title, body)         => ipcRenderer.invoke('notifications:testFire', title, body),
    snooze:    (notifId, minutes)    => ipcRenderer.invoke('notifications:snooze', notifId, minutes),
  },

  // ── Event Listeners (main → renderer) ─────────────────────────────────────
  on: (channel, callback) => {
    const allowed = ['notification:clicked', 'auth:changed', 'calendar:updated'];
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_e, ...args) => callback(...args));
    }
  },
  off: (channel) => ipcRenderer.removeAllListeners(channel),
});
