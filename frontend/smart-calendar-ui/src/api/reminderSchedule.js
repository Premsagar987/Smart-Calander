export const DUE_NOTIFICATION_GRACE_MS = 2 * 60_000

export function getDueReminderStages(dueAt, reminderMinutes, now = Date.now()) {
  if (!Number.isFinite(dueAt) || !Number.isInteger(reminderMinutes) || reminderMinutes < 0 || reminderMinutes > 10_080) {
    return []
  }

  const stages = []
  if (reminderMinutes > 0 && now >= dueAt - reminderMinutes * 60_000 && now < dueAt) {
    stages.push('before')
  }
  if (now >= dueAt && now <= dueAt + DUE_NOTIFICATION_GRACE_MS) {
    stages.push('due')
  }
  return stages
}

export function filterTasksByReminderView(tasks, view, now = Date.now()) {
  return tasks
    .filter((task) => {
      if (view === 'All') return true
      if (task.done) return false
      const dueAt = new Date(`${task.isoDate}T${String(task.time ?? '00:00').slice(0, 5)}:00`).getTime()
      if (!Number.isFinite(dueAt)) return false
      return view === 'Triggered' ? dueAt < now : dueAt >= now
    })
    .sort((first, second) => {
      const firstDue = new Date(`${first.isoDate}T${String(first.time ?? '00:00').slice(0, 5)}:00`).getTime()
      const secondDue = new Date(`${second.isoDate}T${String(second.time ?? '00:00').slice(0, 5)}:00`).getTime()
      return firstDue - secondDue
    })
}
