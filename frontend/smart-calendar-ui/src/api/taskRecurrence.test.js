import assert from 'node:assert/strict'
import test from 'node:test'
import { getNextRecurringDate } from './taskRecurrence.js'

test('advances daily tasks across month and year boundaries', () => {
  assert.equal(getNextRecurringDate('2026-12-31', 'Daily'), '2027-01-01')
})

test('advances weekly tasks by seven calendar days', () => {
  assert.equal(getNextRecurringDate('2026-10-02', 'Weekly'), '2026-10-09')
})

test('returns no next date for a non-recurring or invalid task', () => {
  assert.equal(getNextRecurringDate('2026-10-02', 'None'), null)
  assert.equal(getNextRecurringDate('2026-02-30', 'Daily'), null)
})
