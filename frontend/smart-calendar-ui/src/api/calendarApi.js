import { localCalendarStore } from './localCalendarStore.js'

export const calendarApi = {
  register: (username, password) => localCalendarStore.register(username, password),
  verifyCredentials: (credentials) => localCalendarStore.verifyCredentials(credentials),
  listAllTasks: (credentials) => localCalendarStore.listAllTasks(credentials),
  getLocalData: (credentials) => localCalendarStore.getLocalData(credentials),
  createTask: (credentials, task) => localCalendarStore.createTask(credentials, task),
  updateTask: (credentials, id, task) => localCalendarStore.updateTask(credentials, id, task),
  setTaskCompleted: (credentials, id, completed) => localCalendarStore.setTaskCompleted(credentials, id, completed),
  deleteTask: (credentials, id) => localCalendarStore.deleteTask(credentials, id),
  savePreferences: (credentials, preferences) => localCalendarStore.savePreferences(credentials, preferences),
  saveCategories: (credentials, categories) => localCalendarStore.saveCategories(credentials, categories),
  markReminderNotified: (credentials, key) => localCalendarStore.markReminderNotified(credentials, key),
  hasReminderBeenNotified: (credentials, key) => localCalendarStore.hasReminderBeenNotified(credentials, key),
  lock: (credentials) => localCalendarStore.lock(credentials),
}
