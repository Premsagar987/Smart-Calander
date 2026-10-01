import { getNextRecurringDate } from './taskRecurrence.js'

const DATABASE_NAME = 'smart-calendar-private-data'
const DATABASE_VERSION = 1
const ACCOUNT_STORE = 'accounts'
const KEY_ITERATIONS = 250_000
const activeKeys = new Map()
const accountQueues = new Map()

const emptyVault = () => ({
  schemaVersion: 1,
  tasks: [],
  preferences: { theme: 'light', fontSize: 'medium', defaultReminder: 5, remindersEnabled: true, playSound: true },
  categories: [],
  notifiedReminders: [],
  nextTaskId: 1,
})

function normalizeUsername(username) {
  return username.trim().toLowerCase()
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(ACCOUNT_STORE)) {
        request.result.createObjectStore(ACCOUNT_STORE, { keyPath: 'username' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('Could not open the local calendar database.'))
  })
}

async function readAccount(username) {
  const database = await openDatabase()
  try {
    return await new Promise((resolve, reject) => {
      const request = database.transaction(ACCOUNT_STORE, 'readonly').objectStore(ACCOUNT_STORE).get(username)
      request.onsuccess = () => resolve(request.result ?? null)
      request.onerror = () => reject(request.error ?? new Error('Could not read the local account.'))
    })
  } finally {
    database.close()
  }
}

async function writeAccount(account, createOnly = false) {
  const database = await openDatabase()
  try {
    await new Promise((resolve, reject) => {
      const transaction = database.transaction(ACCOUNT_STORE, 'readwrite')
      const accountStore = transaction.objectStore(ACCOUNT_STORE)
      if (createOnly) accountStore.add(account)
      else accountStore.put(account)
      transaction.oncomplete = resolve
      transaction.onerror = () => reject(transaction.error ?? new Error('Could not save local calendar data.'))
      transaction.onabort = () => reject(transaction.error ?? new Error('Saving local calendar data was cancelled.'))
    })
  } finally {
    database.close()
  }
}

async function deriveEncryptionKey(username, password, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey'])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: KEY_ITERATIONS, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

function bytesToBase64(bytes) {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function base64ToBytes(value) {
  return Uint8Array.from(atob(value), (character) => character.charCodeAt(0))
}

async function encryptVault(username, key, vault, previous = {}) {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    new TextEncoder().encode(JSON.stringify(vault)),
  )
  return {
    username,
    salt: previous.salt,
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  }
}

async function decryptVault(account, key) {
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(account.iv) },
      key,
      base64ToBytes(account.ciphertext),
    )
    return JSON.parse(new TextDecoder().decode(plaintext))
  } catch {
    throw new Error('That username or password is incorrect.')
  }
}

async function getKey(credentials) {
  const username = normalizeUsername(credentials.username)
  const key = activeKeys.get(username)
  if (!key) throw new Error('Sign in again to unlock your encrypted local calendar.')
  return { username, key }
}

async function updateVault(credentials, update) {
  const { username, key } = await getKey(credentials)
  const previousOperation = accountQueues.get(username) ?? Promise.resolve()
  const currentOperation = previousOperation.catch(() => {}).then(async () => {
    const account = await readAccount(username)
    if (!account) throw new Error('This local account no longer exists on this device.')
    const vault = await decryptVault(account, key)
    const result = await update(vault)
    await writeAccount({ ...await encryptVault(username, key, vault, account), salt: account.salt })
    return result
  })
  accountQueues.set(username, currentOperation)
  try {
    return await currentOperation
  } finally {
    if (accountQueues.get(username) === currentOperation) accountQueues.delete(username)
  }
}

export const localCalendarStore = {
  async register(username, password) {
    const normalizedUsername = normalizeUsername(username)
    if (!/^[a-zA-Z0-9_-]{3,32}$/.test(username)) {
      throw new Error('Use 3–32 letters, numbers, underscores, or hyphens for your username.')
    }
    if (password.length < 8 || password.length > 72) {
      throw new Error('Your password must be between 8 and 72 characters.')
    }
    if (await readAccount(normalizedUsername)) throw new Error('An account with that username already exists on this device.')

    const salt = crypto.getRandomValues(new Uint8Array(16))
    const key = await deriveEncryptionKey(normalizedUsername, password, salt)
    const account = await encryptVault(normalizedUsername, key, emptyVault())
    account.salt = bytesToBase64(salt)
    try {
      await writeAccount(account, true)
    } catch (error) {
      if (error.name === 'ConstraintError') {
        throw new Error('An account with that username already exists on this device.', { cause: error })
      }
      throw error
    }
    activeKeys.set(normalizedUsername, key)
    return { username: normalizedUsername }
  },

  async verifyCredentials(credentials) {
    const username = normalizeUsername(credentials.username)
    const account = await readAccount(username)
    if (!account) throw new Error('No local account with that username exists on this device. Create an account to get started.')
    const key = await deriveEncryptionKey(username, credentials.password, base64ToBytes(account.salt))
    await decryptVault(account, key)
    activeKeys.set(username, key)
    return { username }
  },

  async listAllTasks(credentials) {
    return updateVault(credentials, async (vault) => vault.tasks)
  },

  async getLocalData(credentials) {
    return updateVault(credentials, async (vault) => ({
      tasks: vault.tasks,
      preferences: { ...emptyVault().preferences, ...vault.preferences },
      categories: vault.categories,
    }))
  },

  async createTask(credentials, task) {
    return updateVault(credentials, async (vault) => {
      const savedTask = {
        ...task,
        id: vault.nextTaskId++,
        completed: false,
        status: 'Pending',
      }
      vault.tasks.push(savedTask)
      return savedTask
    })
  },

  async setTaskCompleted(credentials, id, completed) {
    return updateVault(credentials, async (vault) => {
      const task = vault.tasks.find((item) => item.id === id)
      if (!task) throw new Error('Task not found in this local account.')
      task.completed = completed
      task.status = completed ? 'Completed' : 'Pending'
      let nextTask = null
      if (completed) {
        const nextDate = getNextRecurringDate(task.date, task.repeat)
        if (nextDate) {
          nextTask = {
            ...task,
            id: vault.nextTaskId++,
            date: nextDate,
            completed: false,
            status: 'Pending',
          }
          vault.tasks.push(nextTask)
        }
      }
      return { task, nextTask }
    })
  },

  async updateTask(credentials, id, updates) {
    return updateVault(credentials, async (vault) => {
      const task = vault.tasks.find((item) => item.id === id)
      if (!task) throw new Error('Task not found in this local account.')
      Object.assign(task, updates, {
        id: task.id,
        completed: task.completed,
        status: task.status,
      })
      return task
    })
  },

  async deleteTask(credentials, id) {
    return updateVault(credentials, async (vault) => {
      const index = vault.tasks.findIndex((item) => item.id === id)
      if (index === -1) throw new Error('Task not found in this local account.')
      vault.tasks.splice(index, 1)
    })
  },

  async savePreferences(credentials, preferences) {
    return updateVault(credentials, async (vault) => {
      vault.preferences = { ...vault.preferences, ...preferences }
      return vault.preferences
    })
  },

  async saveCategories(credentials, categories) {
    return updateVault(credentials, async (vault) => {
      vault.categories = categories
      return vault.categories
    })
  },

  async markReminderNotified(credentials, reminderKey) {
    return updateVault(credentials, async (vault) => {
      vault.notifiedReminders ??= []
      if (vault.notifiedReminders.includes(reminderKey)) return false
      vault.notifiedReminders.push(reminderKey)
      return true
    })
  },

  async hasReminderBeenNotified(credentials, reminderKey) {
    return updateVault(credentials, async (vault) => {
      vault.notifiedReminders ??= []
      return vault.notifiedReminders.includes(reminderKey)
    })
  },

  lock(credentials) {
    if (credentials?.username) activeKeys.delete(normalizeUsername(credentials.username))
  },
}
