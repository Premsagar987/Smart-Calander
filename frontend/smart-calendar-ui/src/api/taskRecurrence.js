export function getNextRecurringDate(dateValue, repeat) {
  if (!['Daily', 'Weekly'].includes(repeat)) return null

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateValue))
  if (!match) return null

  const [, year, month, day] = match.map(Number)
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null

  date.setDate(date.getDate() + (repeat === 'Daily' ? 1 : 7))
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}
