const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('desktopApp', {
  getSavedCredentials: () => ipcRenderer.invoke('auth:get-saved-credentials'),
  setCredentials: (credentials) => ipcRenderer.invoke('auth:set-credentials', credentials),
  clearCredentials: () => ipcRenderer.invoke('auth:clear-credentials'),
  getPreferences: () => ipcRenderer.invoke('preferences:get'),
  setReminderTasks: (username, tasks, preferences) => ipcRenderer.invoke('reminders:set-tasks', username, tasks, preferences),
  setRemindersEnabled: (enabled) => ipcRenderer.invoke('preferences:set-reminders', enabled),
  setPlaySound: (enabled) => ipcRenderer.invoke('preferences:set-play-sound', enabled),
  setLaunchAtLogin: (enabled) => ipcRenderer.invoke('preferences:set-launch-at-login', enabled),
  showTestNotification: () => ipcRenderer.invoke('notifications:test'),
})
