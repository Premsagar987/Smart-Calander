const { app, BrowserWindow, Menu, Notification, Tray, nativeImage, ipcMain, safeStorage, protocol, net } = require('electron')
const fs = require('node:fs')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

protocol.registerSchemesAsPrivileged([
  { scheme: 'smart-calendar', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } },
])
const preferencesPath = () => path.join(app.getPath('userData'), 'preferences.json')
const historyPath = () => path.join(app.getPath('userData'), 'notified-reminders.json')
const credentialsPath = () => path.join(app.getPath('userData'), 'credentials.enc')
const REMINDER_CHECK_INTERVAL_MS = 10_000
const notifiedReminders = new Set()
let preferences = { remindersEnabled: true }
let mainWindow
let tray
let isQuitting = false
let lastReminderError = ''
let savedCredentials = null
let reminderUsername = ''
let reminderTasks = []

app.setAppUserModelId('com.smartcalendar.desktop')

function readJsonFile(filePath, fallback) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'))
  } catch (error) {
    if (error.code !== 'ENOENT') {
      console.error(`Could not read ${path.basename(filePath)}:`, error)
    }
    return fallback
  }
}

function loadSavedCredentials() {
  const encryptedCredentials = readJsonFile(credentialsPath(), null)
  if (encryptedCredentials?.value && safeStorage.isEncryptionAvailable()) {
    try {
      savedCredentials = JSON.parse(safeStorage.decryptString(Buffer.from(encryptedCredentials.value, 'base64')))
    } catch (error) {
      console.error('Could not decrypt the saved desktop sign-in:', error)
      savedCredentials = null
    }
  }
}

function saveCredentials(credentials) {
  if (!credentials || typeof credentials.username !== 'string' || typeof credentials.password !== 'string') {
    throw new Error('Valid sign-in credentials are required.')
  }
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Secure credential storage is not available on this device.')
  }

  savedCredentials = { username: credentials.username, password: credentials.password }
  const encrypted = safeStorage.encryptString(JSON.stringify(savedCredentials)).toString('base64')
  writeJsonFile(credentialsPath(), { value: encrypted })
  lastReminderError = ''
  return true
}

function clearCredentials() {
  savedCredentials = null
  reminderUsername = ''
  reminderTasks = []
  try {
    fs.rmSync(credentialsPath(), { force: true })
  } catch (error) {
    console.error('Could not clear the saved desktop sign-in:', error)
    throw error
  }
  notifiedReminders.clear()
  saveNotifiedHistory()
  return true
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8')
}

function loadPersistentState() {
  const storedPreferences = readJsonFile(preferencesPath(), {})
  preferences = {
    remindersEnabled: storedPreferences.remindersEnabled !== false,
    playSound: storedPreferences.playSound !== false,
  }
  loadSavedCredentials()

  const storedHistory = readJsonFile(historyPath(), [])
  if (Array.isArray(storedHistory)) {
    for (const reminderKey of storedHistory) {
      if (typeof reminderKey === 'string') notifiedReminders.add(reminderKey)
    }
  }
}

function saveNotifiedHistory() {
  writeJsonFile(historyPath(), [...notifiedReminders])
}

function createTrayIcon() {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><rect x="2" y="2" width="28" height="28" rx="8" fill="#174d31"/><path d="M16 7v9l6 4" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/><circle cx="16" cy="16" r="10" fill="none" stroke="#72d794" stroke-width="2.5"/></svg>'
  return nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`)
}

function showMainWindow() {
  if (!mainWindow) {
    createMainWindow()
  }
  mainWindow.show()
  mainWindow.focus()
}

function createMainWindow(show = true) {
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 720,
    minHeight: 560,
    show,
    autoHideMenuBar: true,
    backgroundColor: '#f5f7f2',
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })

  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow.hide()
    }
  })
  mainWindow.on('closed', () => {
    mainWindow = null
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isLocalPage = app.isPackaged
      ? url.startsWith('smart-calendar://app/')
      : url.startsWith('http://127.0.0.1:5173')
    if (!isLocalPage) event.preventDefault()
  })

  if (app.isPackaged) {
    mainWindow.loadURL('smart-calendar://app/index.html')
  } else {
    mainWindow.loadURL('http://127.0.0.1:5173')
  }
}

function createTray() {
  tray = new Tray(createTrayIcon())
  tray.setToolTip('Smart Calendar is running in the background')
  updateTrayMenu()
  tray.on('click', showMainWindow)
  tray.on('double-click', showMainWindow)
}

function updateTrayMenu() {
  if (!tray) return
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Smart Calendar', click: showMainWindow },
    {
      label: 'Task notifications',
      type: 'checkbox',
      checked: preferences.remindersEnabled,
      click: (item) => updateReminderPreference(item.checked),
    },
    { type: 'separator' },
    {
      label: 'Quit Smart Calendar',
      click: () => {
        isQuitting = true
        app.quit()
      },
    },
  ]))
}

function updateReminderPreference(enabled) {
  preferences.remindersEnabled = Boolean(enabled)
  writeJsonFile(preferencesPath(), preferences)
  updateTrayMenu()
  return { ...preferences }
}

function updatePlaySoundPreference(enabled) {
  preferences.playSound = Boolean(enabled)
  writeJsonFile(preferencesPath(), preferences)
  return preferences.playSound
}

function taskIsCompleted(task) {
  return task.completed === true || String(task.status || '').toLowerCase() === 'completed'
}

function getTaskDate(task) {
  const dateValue = String(task.date || task.dueDate || '').slice(0, 10)
  const timeValue = String(task.time || '00:00').slice(0, 8)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) || !/^\d{2}:\d{2}(:\d{2})?$/.test(timeValue)) return null

  const [year, month, day] = dateValue.split('-').map(Number)
  const [hours, minutes, seconds = 0] = timeValue.split(':').map(Number)
  const dueAt = new Date(year, month - 1, day, hours, minutes, seconds)
  return Number.isNaN(dueAt.getTime()) ? null : dueAt
}

function notifyForTask(task, dueAt, stage) {
  if (!Notification.isSupported()) {
    throw new Error('Desktop notifications are not supported on this system.')
  }
  const key = `${reminderUsername}:${task.id}:${dueAt.getTime()}:${stage}`
  if (notifiedReminders.has(key)) return
  const startTime = dueAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const category = task.category ? ` · ${task.category}` : ''
  const notification = new Notification({
    title: stage === 'due' ? 'Task starting now' : 'Upcoming task',
    body: stage === 'due'
      ? `${task.title || 'Untitled task'} is scheduled now${category}`
      : `${task.title || 'Untitled task'} starts at ${startTime}${category}`,
    silent: !preferences.playSound,
  })
  notification.on('click', showMainWindow)
  notification.show()
  notifiedReminders.add(key)
  saveNotifiedHistory()
}

async function checkTaskReminders() {
  if (!preferences.remindersEnabled || !reminderUsername) return
  try {
    const { getDueReminderStages } = await import('../src/api/reminderSchedule.js')
    const now = Date.now()
    for (const task of reminderTasks) {
      if (!task || task.id == null || taskIsCompleted(task)) continue
      const dueAt = getTaskDate(task)
      if (!dueAt) continue
      const stages = getDueReminderStages(dueAt.getTime(), Number(task.reminder ?? 5), now)
      for (const stage of stages) {
        try {
          notifyForTask(task, dueAt, stage)
          lastReminderError = ''
        } catch (error) {
          lastReminderError = error.message
          console.error(`Could not show ${stage} notification for task ${task.id}:`, error)
        }
      }
    }
  } catch (error) {
    lastReminderError = error.message
    console.error('Could not check desktop task reminders:', error)
  }
}

function registerIpcHandlers() {
  ipcMain.handle('auth:get-saved-credentials', () => savedCredentials)
  ipcMain.handle('auth:set-credentials', (_event, credentials) => saveCredentials(credentials))
  ipcMain.handle('auth:clear-credentials', clearCredentials)
  ipcMain.handle('preferences:get', () => ({
    ...preferences,
    launchAtLogin: app.isPackaged && app.getLoginItemSettings().openAtLogin,
    isPackaged: app.isPackaged,
  }))
  ipcMain.handle('reminders:set-tasks', (_event, username, tasks, reminderPreferences) => {
    if (typeof username !== 'string' || !Array.isArray(tasks) || !reminderPreferences || typeof reminderPreferences !== 'object') {
      throw new Error('A username, local task list, and reminder preferences are required.')
    }
    reminderUsername = username
    reminderTasks = tasks
    preferences.remindersEnabled = reminderPreferences.remindersEnabled !== false
    preferences.playSound = reminderPreferences.playSound !== false
    updateTrayMenu()
    return true
  })
  ipcMain.handle('preferences:set-reminders', (_event, enabled) => updateReminderPreference(enabled))
  ipcMain.handle('preferences:set-play-sound', (_event, enabled) => updatePlaySoundPreference(enabled))
  ipcMain.handle('preferences:set-launch-at-login', (_event, enabled) => {
    if (!app.isPackaged) throw new Error('Launch at login is available after installing the desktop app.')
    app.setLoginItemSettings({ openAtLogin: Boolean(enabled) })
    return app.getLoginItemSettings().openAtLogin
  })
  ipcMain.handle('notifications:test', () => {
    if (!Notification.isSupported()) throw new Error('Desktop notifications are not supported on this system.')
    new Notification({
      title: 'Smart Calendar notifications are on',
      body: 'You will be notified before your upcoming tasks.',
    }).show()
    return true
  })
}

const hasSingleInstance = app.requestSingleInstanceLock()
if (!hasSingleInstance) {
  app.quit()
} else {
  app.on('second-instance', showMainWindow)

  app.whenReady().then(() => {
    const buildDirectory = path.resolve(__dirname, '..', 'dist')
    protocol.handle('smart-calendar', (request) => {
      const requestedPath = path.resolve(buildDirectory, `.${decodeURIComponent(new URL(request.url).pathname)}`)
      if (!requestedPath.startsWith(`${buildDirectory}${path.sep}`)) {
        return new Response('Not found', { status: 404 })
      }
      return net.fetch(pathToFileURL(requestedPath).toString())
    })
    loadPersistentState()
    registerIpcHandlers()
    createTray()
    const openedAtLogin = app.isPackaged && app.getLoginItemSettings().wasOpenedAtLogin
    createMainWindow(!openedAtLogin)
    void checkTaskReminders()
    setInterval(() => { void checkTaskReminders() }, REMINDER_CHECK_INTERVAL_MS)
  })
}

app.on('before-quit', () => {
  isQuitting = true
})

app.on('window-all-closed', () => {
  if (isQuitting) app.quit()
})
