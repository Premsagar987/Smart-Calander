import assert from 'node:assert/strict'
import test from 'node:test'
import { DUE_NOTIFICATION_GRACE_MS, filterTasksByReminderView, getDueReminderStages } from './reminderSchedule.js'

const dueAt = Date.UTC(2026, 9, 1, 12)

test('fires a five-minute reminder at its scheduled time', () => {
  assert.deepEqual(getDueReminderStages(dueAt, 5, dueAt - 5 * 60_000), ['before'])
})

test('fires a late pre-task reminder while the task is still upcoming', () => {
  assert.deepEqual(getDueReminderStages(dueAt, 5, dueAt - 60_000), ['before'])
})

test('fires a separate alert at the task start time', () => {
  assert.deepEqual(getDueReminderStages(dueAt, 5, dueAt), ['due'])
})

test('fires an at-time-only reminder without an early alert', () => {
  assert.deepEqual(getDueReminderStages(dueAt, 0, dueAt), ['due'])
  assert.deepEqual(getDueReminderStages(dueAt, 0, dueAt - 1), [])
})

test('allows a short grace window for a delayed scheduler check', () => {
  assert.deepEqual(getDueReminderStages(dueAt, 5, dueAt + DUE_NOTIFICATION_GRACE_MS), ['due'])
  assert.deepEqual(getDueReminderStages(dueAt, 5, dueAt + DUE_NOTIFICATION_GRACE_MS + 1), [])
})

test('separates upcoming, triggered, and all task reminder views', () => {
  const tasks = [
    { id: 1, isoDate: '2026-10-01', time: '13:00:00', done: false },
    { id: 2, isoDate: '2026-10-01', time: '11:00:00', done: false },
    { id: 3, isoDate: '2026-10-01', time: '14:00:00', done: true },
  ]
  const now = new Date(2026, 9, 1, 12).getTime()

  assert.deepEqual(filterTasksByReminderView(tasks, 'Upcoming', now).map(({ id }) => id), [1])
  assert.deepEqual(filterTasksByReminderView(tasks, 'Triggered', now).map(({ id }) => id), [2])
  assert.deepEqual(filterTasksByReminderView(tasks, 'All', now).map(({ id }) => id), [2, 1, 3])
})
