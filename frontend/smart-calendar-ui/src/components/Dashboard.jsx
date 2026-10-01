import { useEffect, useState } from 'react'
import './Dashboard.css'
import { calendarApi } from '../api/calendarApi.js'
import { localCalendarStore } from '../api/localCalendarStore.js'
import { filterTasksByReminderView, getDueReminderStages } from '../api/reminderSchedule.js'

const navigation = [
  ['⌂', 'Dashboard'], ['▦', 'Calendar'], ['✓', 'Tasks'], ['＋', 'Add Task'],
  ['♧', 'Reminders'], ['◷', 'Completed'], ['◔', 'Statistics'], ['▤', 'Categories'], ['⚙', 'Settings'],
]

const defaultCategories = ['Work', 'Personal', 'Study', 'College', 'Health', 'Errands', 'Exercise', 'Shopping']
const categoryColors = ['blue', 'orange', 'green', 'purple', 'pink']
const chartColors = ['#4e8fc7', '#d7923b', '#5a9a68', '#8870bd', '#c8758a']
const defaultPreferences = { theme: 'light', fontSize: 'medium', defaultReminder: 5, remindersEnabled: true, playSound: true }

const dateToInput = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const taskTimestamp = (task) => {
  const [, taskTime = '12:00 PM'] = task.date.split(', ')
  const [clock, period] = taskTime.split(' ')
  const [rawHours, minutes = '00'] = clock.split(':')
  let hours = Number(rawHours)
  if (period === 'PM' && hours < 12) hours += 12
  if (period === 'AM' && hours === 12) hours = 0
  return new Date(`${task.isoDate}T${String(hours).padStart(2, '0')}:${minutes}:00`).getTime()
}

const normalizeTask = (task) => {
  if (!task) return null

  const dateValue = task.date ?? task.dueDate
  const timeValue = task.time ?? '00:00:00'
  const parsedDate = dateValue ? new Date(`${dateValue}T${timeValue}`) : new Date()

  const formattedDate = Number.isNaN(parsedDate.getTime())
    ? 'No date'
    : `${parsedDate.toLocaleDateString('en-US', { day: '2-digit', month: 'short' })}, ${parsedDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}`

  return {
    id: Number(task.id),
    title: task.title ?? 'Untitled Task',
    date: formattedDate,
    isoDate: Number.isNaN(parsedDate.getTime()) ? '' : dateToInput(parsedDate),
    category: task.category ?? 'Personal',
    priority: task.priority ?? 'Medium',
    done: Boolean(task.completed ?? (task.status === 'Completed')),
    status: task.status ?? (task.completed ? 'Completed' : 'Pending'),
    description: task.description ?? '',
    time: task.time ?? '00:00:00',
    reminder: Number(task.reminder ?? 5),
    repeat: ['Daily', 'Weekly'].includes(task.repeat) ? task.repeat : 'None',
  }
}

const parseDateToIso = (dateText) => {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateText ?? '')) return dateText
  if (!dateText) return dateToInput(new Date())
  const [day, month, year] = dateText.split('/')
  if (!day || !month || !year) return dateToInput(new Date())
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const parseTimeToIso = (timeText) => {
  if (!timeText) return '00:00:00'
  const [rawTime, meridiem] = timeText.trim().split(' ')
  const [hoursRaw, minutesRaw = '00'] = rawTime.split(':')
  let hours = Number(hoursRaw)
  const minutes = Number(minutesRaw)

  if (meridiem === 'PM' && hours < 12) hours += 12
  if (meridiem === 'AM' && hours === 12) hours = 0

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`
}

const parseReminderValue = (value) => {
  const reminder = Number(value)
  return Number.isInteger(reminder) && reminder >= 0 && reminder <= 10080 ? reminder : 5
}

const mapFormToTask = (form) => ({
  title: form.title,
  description: form.notes ?? '',
  date: parseDateToIso(form.date),
  time: parseTimeToIso(form.time),
  category: form.category,
  priority: form.priority,
  status: 'Pending',
  reminder: parseReminderValue(form.reminder),
  repeat: ['Daily', 'Weekly'].includes(form.repeat) ? form.repeat : 'None',
  completed: false,
})

function WindowTitle() {
  return (
    <div className="window-title">
      <span className="app-logo">◔</span> SMART CALENDAR
      <div><span>−</span><span>□</span><span>×</span></div>
    </div>
  )
}

function Sidebar({ page, setPage, username, onLogout }) {
  return (
    <aside className="sidebar">
      <WindowTitle />
      <nav>
        {navigation.map(([icon, label]) => (
          <button className={page === label ? 'active' : ''} onClick={() => setPage(label)} key={label}>
            <span>{icon}</span>
            {label}
          </button>
        ))}
      </nav>
      <div className="sidebar-account">
        <span className="sidebar-avatar">{username.slice(0, 1).toUpperCase()}</span>
        <span className="sidebar-username">{username}</span>
        <button className="logout-button" type="button" onClick={onLogout} aria-label="Sign out" title="Sign out">↪</button>
      </div>
    </aside>
  )
}

function Badge({ children, priority }) {
  return <span className={`badge ${priority?.toLowerCase()}`}>{priority === 'High' ? '●' : priority === 'Medium' ? '●' : '●'} {children}</span>
}

function TaskRow({ task, onToggle, onDelete, onEdit }) {
  return (
    <article className="task-row">
      <button
        type="button"
        className={`round-check${task.done ? ' checked' : ''}`}
        onClick={() => onToggle(task.id, !task.done)}
        aria-label={`${task.done ? 'Reopen' : 'Complete'} ${task.title}`}
        aria-pressed={task.done}
        title={task.done ? 'Mark as pending' : 'Mark as completed'}
      >
        {task.done ? '✓' : ''}
      </button>
      <div>
        <strong className={task.done ? 'task-title-completed' : ''}>{task.title}</strong>
        <small>{task.date}</small>
      </div>
      <Badge priority={task.priority}>{task.priority}</Badge>
      {onEdit && <button type="button" className="edit-button" onClick={() => onEdit(task)} aria-label={`Edit ${task.title}`} title="Edit task">✎</button>}
      {onDelete && (
        <button type="button" className="delete-button" onClick={() => onDelete(task.id)} aria-label={`Delete ${task.title}`}>
          ×
        </button>
      )}
    </article>
  )
}

function DashboardPage({ tasks, setPage, onAddForDate, month, setMonth, selectedDate, setSelectedDate }) {
  const [time, setTime] = useState(new Date())

  useEffect(() => {
    const id = setInterval(() => setTime(new Date()), 1000)
    return () => clearInterval(id)
  }, [])

  const selectedTasks = tasks
    .filter((task) => task.isoDate === selectedDate)
    .sort((first, second) => taskTimestamp(first) - taskTimestamp(second))
  const upcomingTasks = tasks
    .filter((task) => taskTimestamp(task) >= time.getTime())
    .sort((first, second) => taskTimestamp(first) - taskTimestamp(second))
  const greeting = time.getHours() < 12 ? 'Good morning' : time.getHours() < 18 ? 'Good afternoon' : 'Good evening'
  const addForSelectedDate = () => onAddForDate(selectedDate)

  return (
    <div className="dashboard-page">
      <section className="dashboard-welcome">
        <div>
          <span className="dashboard-kicker">{time.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
          <h1>{greeting}.<br /><span>Make today count.</span></h1>
          <p>A little clarity goes a long way. Here’s what’s on your calendar.</p>
        </div>
        <button className="primary-button" type="button" onClick={addForSelectedDate}>＋ Add a task</button>
        <div className="welcome-orbit" aria-hidden="true" />
      </section>
      <section className="dashboard-stats" aria-label="Task summary">
        <article className="dashboard-stat"><span>ON YOUR SELECTED DAY</span><strong>{selectedTasks.length}</strong><small>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</small></article>
        <article className="dashboard-stat"><span>COMING UP</span><strong>{upcomingTasks.length}</strong><small>Open tasks from today onward</small></article>
        <article className="dashboard-stat"><span>TIME NOW</span><strong className="dashboard-clock">{time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</strong><small>Your local time</small></article>
      </section>
      <div className="dashboard-columns">
        <section className="dashboard-panel day-agenda">
          <div className="dashboard-panel-heading"><div><span className="dashboard-kicker">YOUR AGENDA</span><h2>{selectedDate === dateToInput(new Date()) ? 'Today’s plan' : new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2></div><button className="text-button" type="button" onClick={() => setPage('Tasks')}>All tasks →</button></div>
          {selectedTasks.length ? <div className="agenda-list">{selectedTasks.map((task) => <article className="agenda-item" key={task.id}><span className={`agenda-mark ${task.priority.toLowerCase()}`} /><time>{task.date.split(', ')[1]}</time><div><strong>{task.title}</strong><small>{task.category}</small></div><Badge priority={task.priority}>{task.priority}</Badge></article>)}</div> : <div className="agenda-empty"><span>✦</span><strong>A little breathing room.</strong><p>No tasks are planned for this day yet.</p><button className="text-button" type="button" onClick={addForSelectedDate}>Plan something for this day →</button></div>}
        </section>
        <aside className="dashboard-panel dashboard-calendar-panel">
          <div className="dashboard-panel-heading"><div><span className="dashboard-kicker">YOUR CALENDAR</span><h2>Pick a day</h2></div><button className="text-button" type="button" onClick={() => setPage('Calendar')}>Full calendar →</button></div>
          <MiniCalendar month={month} setMonth={setMonth} tasks={tasks} selectedDate={selectedDate} setSelectedDate={setSelectedDate} onAddForDate={onAddForDate} />
        </aside>
      </div>
      <section className="up-next-panel"><div className="dashboard-panel-heading"><div><span className="dashboard-kicker">AHEAD OF YOU</span><h2>Coming up next</h2></div><button className="text-button" type="button" onClick={() => setPage('Reminders')}>See reminders →</button></div>{upcomingTasks.length ? <div className="up-next-list">{upcomingTasks.slice(0, 3).map((task) => <article key={task.id}><span>{new Date(`${task.isoDate}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span><div><strong>{task.title}</strong><small>{task.category} · {task.date.split(', ')[1]}</small></div><Badge priority={task.priority}>{task.priority}</Badge></article>)}</div> : <p className="muted-empty">Your schedule is clear. Add a task whenever you’re ready.</p>}</section>
    </div>
  )
}

function MiniCalendar({ month, setMonth, tasks, selectedDate, setSelectedDate, onAddForDate }) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstDay = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstDay + 1
    return day > 0 && day <= daysInMonth ? new Date(year, monthIndex, day) : null
  })
  const today = dateToInput(new Date())
  return (
    <section className="mini-cal">
      <div className="calendar-top">
        <button type="button" aria-label="Previous month" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}>‹</button>
        <strong>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong>
        <button type="button" aria-label="Next month" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}>›</button>
      </div>
      <div className="days-head">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <span key={day}>{day.slice(0, 1)}</span>
        ))}
      </div>
      <div className="days-grid">
        {cells.map((date, index) => {
          if (!date) return <span className="calendar-blank" key={`blank-${index}`} />
          const dateKey = dateToInput(date)
          const dayHasTasks = tasks.some((task) => task.isoDate === dateKey && !task.done)
          return <button type="button" key={dateKey} className={`calendar-day${dateKey === today ? ' is-today' : ''}${dateKey === selectedDate ? ' selected-day' : ''}`} onClick={() => setSelectedDate(dateKey)} onDoubleClick={() => onAddForDate(dateKey)} aria-label={`${date.toLocaleDateString()}${dayHasTasks ? ', has tasks' : ''}, double click to add a task`} title={dayHasTasks ? 'Tasks scheduled' : 'Double-click to add a task'}>
            {date.getDate()}{dayHasTasks && <i className="calendar-dot" />}
          </button>
        })}
      </div>
      <p className="calendar-hint">Select a day to see its plan · double-click to add</p>
    </section>
  )
}

function CalendarPage({ tasks, onAddForDate, month, setMonth, selectedDate, setSelectedDate }) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstDay = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstDay + 1
    return day > 0 && day <= daysInMonth ? new Date(year, monthIndex, day) : null
  })
  const dayTasks = tasks.filter((task) => task.isoDate === selectedDate).sort((first, second) => taskTimestamp(first) - taskTimestamp(second))
  return (
    <section className="calendar-page">
      <div className="calendar-page-heading"><div><span className="dashboard-kicker">MAKE SPACE FOR WHAT MATTERS</span><h1>Your calendar</h1><p>Select any date to see what you have planned or add a task.</p></div><button className="primary-button" type="button" onClick={() => onAddForDate(selectedDate)}>＋ Add task</button></div>
      <div className="calendar-page-toolbar">
        <div className="calendar-month-controls"><button className="calendar-nav-button" type="button" aria-label="Previous month" onClick={() => setMonth(new Date(year, monthIndex - 1, 1))}>‹</button><h2>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</h2><button className="calendar-nav-button" type="button" aria-label="Next month" onClick={() => setMonth(new Date(year, monthIndex + 1, 1))}>›</button><button className="text-button" type="button" onClick={() => { const now = new Date(); setMonth(now); setSelectedDate(dateToInput(now)) }}>Today</button></div>
        <span className="calendar-month-total">{tasks.filter((task) => task.isoDate?.startsWith(`${year}-${String(monthIndex + 1).padStart(2, '0')}`) && !task.done).length} tasks this month</span>
      </div>
      <div className="calendar-workspace">
      <div className="big-calendar">
        <div className="calendar-week">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <b key={day}>{day}</b>
          ))}
        </div>
        <div className="calendar-cells">
          {cells.map((date, index) => {
            if (!date) return <div className="calendar-empty-cell" key={`empty-${index}`} />
            const dateKey = dateToInput(date)
            const dateTasks = tasks.filter((task) => task.isoDate === dateKey && !task.done)
            return <button type="button" key={dateKey} className={`calendar-cell${dateKey === dateToInput(new Date()) ? ' is-today' : ''}${dateKey === selectedDate ? ' is-selected' : ''}`} onClick={() => setSelectedDate(dateKey)} onDoubleClick={() => onAddForDate(dateKey)} aria-label={`${date.toLocaleDateString()}, ${dateTasks.length} tasks; double-click to add`}>
              <span className="calendar-cell-date">{date.getDate()}</span>
              {dateTasks.slice(0, 2).map((task) => <span className={`calendar-task-chip ${task.priority.toLowerCase()}`} key={task.id}>{task.date.split(', ')[1]} {task.title}</span>)}
              {dateTasks.length > 2 && <small className="calendar-more">+{dateTasks.length - 2} more</small>}
              {!dateTasks.length && <span className="calendar-add-hint">＋ Add task</span>}
            </button>
          })}
        </div>
      </div>
      <aside className="selected-day-panel"><span className="dashboard-kicker">YOUR DAY</span><h2>{new Date(`${selectedDate}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2><p>{dayTasks.length ? `${dayTasks.length} planned ${dayTasks.length === 1 ? 'task' : 'tasks'}` : 'Nothing planned just yet.'}</p><button className="primary-button" type="button" onClick={() => onAddForDate(selectedDate)}>＋ Add a task</button><div className="selected-day-tasks">{dayTasks.length ? dayTasks.map((task) => <article key={task.id}><span className={`agenda-mark ${task.priority.toLowerCase()}`} /><div><strong>{task.title}</strong><small>{task.date.split(', ')[1]} · {task.category}</small></div></article>) : <div className="agenda-empty"><span>✦</span><p>Keep the day open, or add something worth remembering.</p></div>}</div></aside>
      </div>
    </section>
  )
}

function AddTaskPage({ addTask, setPage, initialDate, returnPage, categories, defaultReminder, initialTask }) {
  const taskDate = initialTask?.isoDate ?? initialDate
  const [form, setForm] = useState({
    title: initialTask?.title ?? '',
    date: taskDate,
    time: String(initialTask?.time ?? '09:00').slice(0, 5),
    category: initialTask?.category ?? categories[0] ?? 'Work',
    priority: initialTask?.priority ?? 'Medium',
    reminder: String(initialTask?.reminder ?? defaultReminder),
    repeat: initialTask?.repeat ?? 'None',
    notes: initialTask?.description ?? '',
    customReminder: '20',
  })
  const [formError, setFormError] = useState('')

  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))

  const save = async (event) => {
    event.preventDefault()
    if (!form.title.trim()) {
      setFormError('Enter a task name before saving.')
      return
    }
    setFormError('')
    try {
      const reminder = form.reminder === 'custom' ? Number(form.customReminder) : Number(form.reminder)
      if (!Number.isInteger(reminder) || reminder < 0 || reminder > 10080) {
        setFormError('Choose a reminder between the task time and 7 days before it.')
        return
      }
      await addTask({ ...form, reminder }, initialTask?.id)
      setPage(returnPage)
    } catch (error) {
      setFormError(error.message)
    }
  }

  return (
    <form className="form-page" onSubmit={save}>
      <span className="dashboard-kicker">MAKE IT HAPPEN</span>
      <h2>{initialTask ? 'Edit task' : 'Add a task'}</h2>
      <p className="form-intro">Choose when it belongs on your calendar. We’ll take care of the reminder.</p>
      <label>
        Task name
        <input name="title" value={form.title} onChange={change} placeholder="What would you like to get done?" required autoFocus />
      </label>

      <div className="two-fields">
        <label>
          Date
          <input type="date" name="date" value={form.date} onChange={change} required />
        </label>
        <label>
          Time
          <input type="time" name="time" value={form.time} onChange={change} required />
        </label>
      </div>

      <div className="two-fields">
        <label>
          Category
          <select name="category" value={form.category} onChange={change}>
            {categories.map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>
        <label>
          Priority
          <select name="priority" value={form.priority} onChange={change}>
            <option>High</option>
            <option>Medium</option>
            <option>Low</option>
          </select>
        </label>
      </div>

      <div className="two-fields">
        <label>
          Reminder
          <select name="reminder" value={form.reminder} onChange={change}>
            <option value="0">At time</option>
            <option value="5">5 minutes before</option>
            <option value="10">10 minutes before</option>
            <option value="15">15 minutes before</option>
            <option value="30">30 minutes before</option>
            <option value="60">1 hour before</option>
            <option value="1440">1 day before</option>
            <option value="custom">Custom</option>
          </select>
        </label>
        <label>
          Repeat
          <select name="repeat" value={form.repeat} onChange={change}>
            <option>None</option>
            <option>Daily</option>
            <option>Weekly</option>
          </select>
        </label>
      </div>

      {form.reminder === 'custom' && (
        <label>
          Custom reminder (minutes before)
          <input type="number" name="customReminder" min="1" max="10080" value={form.customReminder} onChange={change} required />
        </label>
      )}

      <label>
        Notes <span className="optional-label">OPTIONAL</span>
        <textarea name="notes" value={form.notes} onChange={change} placeholder="Add a few details to help you get started..." />
      </label>

      {formError && <p className="settings-error" role="alert">{formError}</p>}
      <div className="form-actions">
        <button type="button" className="minor-button" onClick={() => setPage(returnPage)}>Cancel</button>
        <button type="submit" className="save-button">{initialTask ? 'Save Changes' : 'Save Task'}</button>
      </div>
    </form>
  )
}

function TasksPage({ tasks, onToggle, onDelete, onEdit, category, onClearCategory }) {
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')

  const visibleTasks = tasks.filter((task) => {
    if (category && task.category.toLowerCase() !== category.toLowerCase()) return false
    const matchesText = `${task.title} ${task.category}`.toLowerCase().includes(query.toLowerCase())
    if (!matchesText) return false

    if (filter === 'Pending') return !task.done
    if (filter === 'Completed') return task.done
    return true
  })

  return (
    <section className="list-page">
      <div className="category-tasks-heading">
        <div>
          {category && <span className="dashboard-kicker">CATEGORY</span>}
          <h2>{category ? `${category} Tasks` : 'All Tasks'}</h2>
        </div>
        {category && <button type="button" className="minor-button" onClick={onClearCategory}>← All Categories</button>}
      </div>
      <div className="tabs">
        {['All', 'Pending', 'Completed'].map((tab) => (
          <button type="button" key={tab} className={filter === tab ? 'selected' : ''} onClick={() => setFilter(tab)}>
            {tab}
          </button>
        ))}
      </div>
      <input className="search" placeholder="⌕  Search tasks..." value={query} onChange={(event) => setQuery(event.target.value)} />
      {visibleTasks.length ? visibleTasks.map((task) => <TaskRow key={task.id} task={task} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />) : <p className="muted-empty">No matching tasks in this view.</p>}
    </section>
  )
}

function RemindersPage({ tasks, onToggle }) {
  const [filter, setFilter] = useState('Upcoming')
  const [now, setNow] = useState(0)
  useEffect(() => {
    const initialUpdate = window.setTimeout(() => setNow(Date.now()), 0)
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => {
      window.clearTimeout(initialUpdate)
      window.clearInterval(timer)
    }
  }, [])
  const filteredTasks = filterTasksByReminderView(tasks, filter, now)

  return (
    <section className="list-page">
      <h2>Reminders</h2>
      <div className="tabs">
        {['Upcoming', 'Triggered', 'All'].map((tab) => (
          <button type="button" key={tab} className={filter === tab ? 'selected' : ''} aria-pressed={filter === tab} onClick={() => setFilter(tab)}>{tab}</button>
        ))}
      </div>
      {filteredTasks.length ? filteredTasks.map((task) => (
        <TaskRow key={task.id} task={task} onToggle={onToggle} />
      )) : <p className="muted-empty">{filter === 'Upcoming' ? 'No upcoming reminders.' : filter === 'Triggered' ? 'No triggered reminders.' : 'No reminders yet.'}</p>}
    </section>
  )
}

function CompletedPage({ tasks, onToggle, onDelete, onEdit }) {
  const complete = tasks.filter((task) => task.done)

  return (
    <section className="list-page">
      <h2>Completed Tasks</h2>
      {complete.length ? (
        complete.map((task) => <TaskRow key={task.id} task={task} onToggle={onToggle} onEdit={onEdit} onDelete={onDelete} />)
      ) : (
        <p className="muted-empty">Complete a task to see it here.</p>
      )}
    </section>
  )
}

function StatisticsPage({ tasks }) {
  const [now, setNow] = useState(0)
  const completed = tasks.filter((task) => task.done).length
  const pending = tasks.length - completed
  const statusCounts = [
    { label: 'Completed', count: completed, color: 'green' },
    { label: 'Pending', count: pending, color: 'amber' },
  ]
  const missed = tasks.filter((task) => {
    if (!now || task.done || !task.isoDate) return false
    const dueAt = new Date(`${task.isoDate}T${parseTimeToIso(task.time)}`).getTime()
    return Number.isFinite(dueAt) && dueAt < now
  }).length
  const completionRate = tasks.length ? Math.round((completed / tasks.length) * 100) : 0
  const categoryCounts = [...tasks.reduce((counts, task) => {
    const category = task.category || 'Uncategorized'
    counts.set(category, (counts.get(category) ?? 0) + 1)
    return counts
  }, new Map())].sort((first, second) => second[1] - first[1])
  const categoryTotal = categoryCounts.reduce((total, [, count]) => total + count, 0)
  const chartSegments = categoryCounts.reduce((chart, [, count], index) => {
    const nextOffset = chart.offset + (categoryTotal ? (count / categoryTotal) * 100 : 0)
    return {
      offset: nextOffset,
      segments: [...chart.segments, `${chartColors[index % chartColors.length]} ${chart.offset}% ${nextOffset}%`],
    }
  }, { offset: 0, segments: [] }).segments

  useEffect(() => {
    const updateNow = () => setNow(Date.now())
    const initialUpdate = window.setTimeout(updateNow, 0)
    const interval = window.setInterval(updateNow, 60_000)
    return () => {
      window.clearTimeout(initialUpdate)
      window.clearInterval(interval)
    }
  }, [])

  return (
    <section className="stats-page">
      <h2>Statistics</h2>
      <div className="stat-cards">
        <div>
          <small>Completed</small>
          <b className="green-text">{completed}</b>
          <span>Tasks finished</span>
        </div>
        <div>
          <small>Pending</small>
          <b className="yellow-text">{pending}</b>
          <span>Still on your list</span>
        </div>
        <div>
          <small>Missed</small>
          <b className="red-text">{missed}</b>
          <span>Past-due, unfinished</span>
        </div>
      </div>

      <section className="card rate">
        <small>Completion Rate</small>
        <b>{completionRate}%</b>
        <div
          className="completion-track"
          role="img"
          aria-label={`${completionRate}% completion rate: ${completed} completed, ${pending} pending`}
        >
          <i style={{ width: `${completionRate}%` }} />
        </div>
        <p>{completed} of {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} completed</p>
      </section>

      <section className="card status-chart">
        <h3>Task Status</h3>
        {tasks.length ? (
          <>
            <div className="status-chart-bar" role="img" aria-label={`${completed} completed, ${pending} pending`}>
              {statusCounts.filter(({ count }) => count > 0).map(({ label, count, color }) => (
                <span
                  key={label}
                  className={`status-chart-segment ${color}`}
                  style={{ width: `${(count / tasks.length) * 100}%` }}
                  title={`${label}: ${count}`}
                />
              ))}
            </div>
            <div className="status-chart-legend">
              {statusCounts.map(({ label, count, color }) => (
                <div key={label}><span className={`legend-dot ${color}`} /><span>{label}</span><strong>{count}</strong></div>
              ))}
            </div>
          </>
        ) : <p className="muted-empty">Create a task to see your task status chart.</p>}
      </section>

      <section className="card overview">
        <h3>Task Overview</h3>
        {categoryCounts.length ? (
          <div className="statistics-breakdown">
            <div
              className="donut"
              role="img"
              aria-label={`Task categories: ${categoryCounts.map(([category, count]) => `${category}, ${count} tasks`).join('; ')}`}
              style={{ background: `conic-gradient(${chartSegments.join(', ')})` }}
            >
              <span>{categoryTotal}<small>tasks</small></span>
            </div>
            <div className="statistics-legend">
              {categoryCounts.map(([category, count], index) => (
                <p key={category}><span className={`legend-dot ${categoryColors[index % categoryColors.length]}`} />{category}<strong>{count} · {Math.round((count / categoryTotal) * 100)}%</strong></p>
              ))}
            </div>
          </div>
        ) : <p className="muted-empty">Create a task to see your category breakdown.</p>}
      </section>
    </section>
  )
}

function CategoriesPage({ tasks, customCategories, onAddCategory, onSelectCategory }) {
  const [newCategory, setNewCategory] = useState('')
  const [formError, setFormError] = useState('')
  const categories = [...new Set([...defaultCategories, ...customCategories, ...tasks.map((task) => task.category).filter(Boolean)])]
  const addCategory = async (event) => {
    event.preventDefault()
    const category = newCategory.trim()
    if (!category) {
      setFormError('Enter a category name.')
      return
    }
    if (categories.some((existing) => existing.toLowerCase() === category.toLowerCase())) {
      setFormError('That category already exists.')
      return
    }
    try {
      await onAddCategory(category)
      setNewCategory('')
      setFormError('')
    } catch (error) {
      setFormError(error.message)
    }
  }

  return (
    <section className="categories-page">
      <h2>Categories</h2>
      <p className="category-intro">Organize your plans by the categories you use.</p>
      <div className="category-grid">
        {categories.map((name, index) => {
          const count = tasks.filter((task) => String(task.category ?? '').toLowerCase() === name.toLowerCase()).length
          const color = categoryColors[index % categoryColors.length]
          return (
            <button className="category category-card" key={name} type="button" onClick={() => onSelectCategory(name)} aria-label={`Show ${count} ${count === 1 ? 'task' : 'tasks'} in ${name}`}>
              <span className={color}>▦</span>
              <div>
                <strong>{name}</strong>
                <small>{count} {count === 1 ? 'task' : 'tasks'}</small>
              </div>
              <span className="category-card-arrow" aria-hidden="true">→</span>
            </button>
          )
        })}
      </div>
      <form className="category-create" onSubmit={addCategory}>
        <label htmlFor="new-category">Add a category</label>
        <div><input id="new-category" value={newCategory} onChange={(event) => setNewCategory(event.target.value)} maxLength={40} placeholder="e.g. Projects" /><button type="submit" className="primary-button">＋ Add Category</button></div>
        {formError && <p className="settings-error" role="alert">{formError}</p>}
      </form>
    </section>
  )
}

function SettingsPage({ preferences, onPreferenceChange, installPrompt, onInstall }) {
  const [settings, setSettings] = useState({ start: false })
  const [isPackaged, setIsPackaged] = useState(false)
  const [desktopError, setDesktopError] = useState('')
  const desktopApp = window.desktopApp

  useEffect(() => {
    desktopApp?.getPreferences().then((desktopPreferences) => {
      setIsPackaged(desktopPreferences.isPackaged)
      setSettings((current) => ({
        ...current,
        start: desktopPreferences.launchAtLogin,
      }))
    }).catch((error) => {
      console.error('Could not load desktop preferences:', error)
      setDesktopError(error.message)
    })
  }, [desktopApp])

  const toggleNotifications = async () => {
    setDesktopError('')
    try {
      const enabled = !preferences.remindersEnabled
      if (enabled && !desktopApp) {
        if (!('Notification' in window)) throw new Error('This browser does not support notifications.')
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission()
          if (permission !== 'granted') throw new Error('Allow notifications in your browser settings to receive task reminders.')
        } else if (Notification.permission !== 'granted') {
          throw new Error('Allow notifications in your browser settings to receive task reminders.')
        }
      }
      if (desktopApp) await desktopApp.setRemindersEnabled(enabled)
      await onPreferenceChange('remindersEnabled', enabled)
    } catch (error) {
      console.error('Could not update reminder preferences:', error)
      setDesktopError(error.message)
    }
  }

  const togglePlaySound = async () => {
    setDesktopError('')
    try {
      const enabled = !preferences.playSound
      if (desktopApp) await desktopApp.setPlaySound(enabled)
      await onPreferenceChange('playSound', enabled)
    } catch (error) {
      console.error('Could not update notification sound preferences:', error)
      setDesktopError(error.message)
    }
  }

  const savePreference = async (key, value) => {
    setDesktopError('')
    try {
      await onPreferenceChange(key, value)
    } catch (error) {
      setDesktopError(error.message)
    }
  }

  const toggleDesktopSetting = async () => {
    const nextValue = !settings.start
    setDesktopError('')
    try {
      const savedValue = await desktopApp?.setLaunchAtLogin(nextValue)
      setSettings((current) => ({ ...current, start: savedValue ?? nextValue }))
    } catch (error) {
      console.error('Could not update startup preferences:', error)
      setDesktopError(error.message)
    }
  }

  const sendTestNotification = async () => {
    setDesktopError('')
    try {
      if (desktopApp) await desktopApp.showTestNotification()
      else if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Smart Calendar notifications are on', { body: 'Your task reminders are enabled.' })
      } else {
        throw new Error('Enable browser notifications before sending a test.')
      }
    } catch (error) {
      console.error('Could not show a test notification:', error)
      setDesktopError(error.message)
    }
  }

  return (
    <section className="settings-page">
      <h2>Settings</h2>
      <div className="settings-preference">
        <div><strong>Dark mode</strong><small>Use a darker color palette throughout the app.</small></div>
        <button type="button" className={preferences.theme === 'dark' ? 'toggle on' : 'toggle'} onClick={() => void savePreference('theme', preferences.theme === 'dark' ? 'light' : 'dark')} aria-label="Toggle dark mode" aria-pressed={preferences.theme === 'dark'}><i /></button>
      </div>
      {desktopApp && <h4>
        Start on Windows Startup
        <button type="button" className={settings.start ? 'toggle on' : 'toggle'} onClick={() => void toggleDesktopSetting()} disabled={!isPackaged} aria-label="Start Smart Calendar when Windows starts"><i /></button>
      </h4>}
      <h4>
        Task Notifications
        <button type="button" className={preferences.remindersEnabled ? 'toggle on' : 'toggle'} onClick={() => void toggleNotifications()} aria-label="Enable task notifications" aria-pressed={preferences.remindersEnabled}><i /></button>
      </h4>
      {!desktopApp && <p className="settings-help">In a web browser, reminders are checked while this app is open. Allow browser notifications to receive them.</p>}
      {desktopApp && !isPackaged && <p className="muted-empty">Install the desktop app to enable Windows startup.</p>}
      {desktopError && <p className="settings-error" role="alert">{desktopError}</p>}
      <button type="button" className="minor-button" onClick={sendTestNotification}>Send test notification</button>
      <h3>Reminders</h3>
      <label>
        Default Reminder Time
        <select value={preferences.defaultReminder} onChange={(event) => void savePreference('defaultReminder', Number(event.target.value))}>
          <option value={0}>At task time</option>
          <option value={5}>5 minutes before</option>
          <option value={10}>10 minutes before</option>
          <option value={15}>15 minutes before</option>
          <option value={30}>30 minutes before</option>
          <option value={60}>1 hour before</option>
          <option value={1440}>1 day before</option>
        </select>
      </label>
      <h4>
        Play Sound
        <button type="button" className={preferences.playSound ? 'toggle on' : 'toggle'} onClick={() => void togglePlaySound()} aria-label="Play notification sound" aria-pressed={preferences.playSound}><i /></button>
      </h4>
      <h3>Appearance</h3>
      {installPrompt && <button type="button" className="minor-button install-app-button" onClick={async () => { await installPrompt.prompt(); onInstall() }}>Install Smart Calendar</button>}
      <label>
        Font Size
        <select value={preferences.fontSize} onChange={(event) => void savePreference('fontSize', event.target.value)}>
          <option value="small">Small</option>
          <option value="medium">Medium</option>
          <option value="large">Large</option>
        </select>
      </label>
    </section>
  )
}

function Notice({ task, onClose }) {
  return (
    <div className="modal-wrap">
      <section className="notice">
        <button type="button" className="close" onClick={onClose}>×</button>
        <span className="notice-icon">✓</span>
        <h2>Great!</h2>
        <p>You have completed</p>
        <strong>{task.title}</strong>
        <button type="button" className="save-button" onClick={onClose}>Mark Another as Complete</button>
      </section>
    </div>
  )
}

function AuthPage({ onAuthenticate, initialError = '' }) {
  const [mode, setMode] = useState('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState(initialError)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    if (mode === 'signup') {
      if (!/^[A-Za-z0-9_-]{3,32}$/.test(username)) {
        setError('Use 3–32 letters, numbers, underscores, or hyphens for your username.')
        return
      }
      if (password.length < 8 || password.length > 72) {
        setError('Your password must be between 8 and 72 characters.')
        return
      }
      if (password !== confirmPassword) {
        setError('Those passwords do not match.')
        return
      }
    } else if (!username.trim() || !password) {
      setError('Enter your username and password to continue.')
      return
    }

    setIsSubmitting(true)
    try {
      await onAuthenticate(mode, username.trim(), password)
    } catch (submitError) {
      setError(submitError.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  const changeMode = (nextMode) => {
    setMode(nextMode)
    setPassword('')
    setConfirmPassword('')
    setError('')
  }

  return (
    <main className="auth-screen">
      <section className="auth-card">
        <div className="auth-brand"><span className="auth-brand-mark">◔</span><span>SMART CALENDAR</span></div>
        <div className="auth-intro">
          <span className="dashboard-kicker">{mode === 'login' ? 'A CLEARER DAY STARTS HERE' : 'MAKE SPACE FOR WHAT MATTERS'}</span>
          <h1>{mode === 'login' ? 'Welcome back.' : 'Create your space.'}</h1>
          <p>{mode === 'login' ? 'Unlock the private calendar stored on this device.' : 'Create an encrypted calendar stored only on this device.'}</p>
        </div>
        <div className="auth-tabs" role="tablist" aria-label="Account access">
          <button type="button" role="tab" aria-selected={mode === 'login'} className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')}>Sign in</button>
          <button type="button" role="tab" aria-selected={mode === 'signup'} className={mode === 'signup' ? 'active' : ''} onClick={() => changeMode('signup')}>Create account</button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label>Username
            <input name="username" autoComplete="username" value={username} onChange={(event) => setUsername(event.target.value)} placeholder="Your username" required autoFocus />
          </label>
          <label>Password
            <input name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={mode === 'login' ? 'Your password' : 'At least 8 characters'} required />
          </label>
          {mode === 'signup' && <label>Confirm password
            <input name="confirmPassword" type="password" autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Type your password again" required />
          </label>}
          {error && <p className="auth-error" role="alert">{error}</p>}
          <button className="auth-submit" type="submit" disabled={isSubmitting}>{isSubmitting ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}<span>→</span></button>
        </form>
        <p className="auth-privacy">Your password encrypts your local calendar. It is never sent to a server.</p>
      </section>
      <aside className="auth-aside">
        <div className="auth-aside-art" aria-hidden="true"><div className="auth-orbit auth-orbit-one" /><div className="auth-orbit auth-orbit-two" /><span>✦</span></div>
        <div><span className="dashboard-kicker">LESS RUSH. MORE ROOM.</span><h2>A calm place<br />for your plans.</h2><p>Capture what matters, make a little progress, and let reminders take care of the rest.</p></div>
        <div className="auth-aside-footer"><span>PLAN WITH INTENTION</span><span>•</span><span>ONE DAY AT A TIME</span></div>
      </aside>
    </main>
  )
}

function Dashboard() {
  const [page, setPage] = useState('Dashboard')
  const [tasks, setTasks] = useState([])
  const [notice, setNotice] = useState(null)
  const [taskDate, setTaskDate] = useState(dateToInput(new Date()))
  const [taskReturnPage, setTaskReturnPage] = useState('Dashboard')
  const [editingTask, setEditingTask] = useState(null)
  const [calendarMonth, setCalendarMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(dateToInput(new Date()))
  const [credentials, setCredentials] = useState(null)
  const [authReady, setAuthReady] = useState(false)
  const [authError, setAuthError] = useState('')
  const [appError, setAppError] = useState('')
  const [userPreferences, setUserPreferences] = useState(defaultPreferences)
  const [customCategories, setCustomCategories] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('')
  const [installPrompt, setInstallPrompt] = useState(null)
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const desktopApp = window.desktopApp

  useEffect(() => {
    const updateConnectionState = () => setIsOnline(navigator.onLine)
    window.addEventListener('online', updateConnectionState)
    window.addEventListener('offline', updateConnectionState)
    return () => {
      window.removeEventListener('online', updateConnectionState)
      window.removeEventListener('offline', updateConnectionState)
    }
  }, [])

  const navigateToPage = (nextPage) => {
    if (nextPage === 'Tasks') setSelectedCategory('')
    if (nextPage !== 'Add Task') setEditingTask(null)
    setPage(nextPage)
  }

  const showCategoryTasks = (category) => {
    setSelectedCategory(category)
    setPage('Tasks')
  }

  const restoreUserData = async (accountCredentials) => {
    try {
      const accountData = await calendarApi.getLocalData(accountCredentials)
      const savedPreferences = accountData.preferences
      setTasks(accountData.tasks.map(normalizeTask).filter(Boolean))
      setUserPreferences({
        ...defaultPreferences,
        ...savedPreferences,
        theme: savedPreferences.theme === 'dark' ? 'dark' : 'light',
        fontSize: ['small', 'medium', 'large'].includes(savedPreferences.fontSize) ? savedPreferences.fontSize : 'medium',
        defaultReminder: Number.isInteger(savedPreferences.defaultReminder) && savedPreferences.defaultReminder >= 0 && savedPreferences.defaultReminder <= 1440
          ? savedPreferences.defaultReminder
          : 5,
      })
      setCustomCategories(Array.isArray(accountData.categories) ? accountData.categories.filter((category) => typeof category === 'string') : [])
      setAppError('')
    } catch (error) {
      console.error('Could not restore calendar preferences:', error)
      throw error
    }
  }

  const updateUserPreference = async (key, value) => {
    const nextPreferences = { ...userPreferences, [key]: value }
    try {
      await calendarApi.savePreferences(credentials, nextPreferences)
      setUserPreferences(nextPreferences)
    } catch (error) {
      console.error('Could not save calendar preferences:', error)
      setAppError(`Could not save your preference: ${error.message}`)
      throw error
    }
  }

  const addCustomCategory = async (category) => {
    const nextCategories = [...customCategories, category]
    try {
      await calendarApi.saveCategories(credentials, nextCategories)
      setCustomCategories(nextCategories)
    } catch (error) {
      console.error('Could not save calendar categories:', error)
      setAppError(`Could not save your category: ${error.message}`)
      throw error
    }
  }

  const openAddTask = (date, returnPage) => {
    setEditingTask(null)
    setTaskDate(date)
    setTaskReturnPage(returnPage)
    setPage('Add Task')
  }

  const openEditTask = (task) => {
    setEditingTask(task)
    setTaskDate(task.isoDate)
    setTaskReturnPage(page)
    setPage('Add Task')
  }

  useEffect(() => {
    let isMounted = true
    const restoreCredentials = async () => {
      let savedCredentials
      try {
        if (desktopApp) {
          savedCredentials = await desktopApp.getSavedCredentials()
        }

        if (savedCredentials) {
          await calendarApi.verifyCredentials(savedCredentials)
          if (desktopApp) await desktopApp.setCredentials(savedCredentials)
          if (isMounted) {
            await restoreUserData(savedCredentials)
            setCredentials(savedCredentials)
          }
        }
      } catch (error) {
        console.warn('Saved sign-in could not be restored:', error)
        if (desktopApp) await desktopApp.clearCredentials().catch((clearError) => console.error('Could not clear expired desktop credentials:', clearError))
        if (isMounted) setAuthError('Please sign in again to continue.')
      } finally {
        if (isMounted) setAuthReady(true)
      }
    }

    restoreCredentials()
    return () => { isMounted = false }
  }, [desktopApp])

  const authenticate = async (mode, username, password) => {
    const nextCredentials = { username, password }
    if (mode === 'signup') await calendarApi.register(username, password)
    await calendarApi.verifyCredentials(nextCredentials)
    if (desktopApp) await desktopApp.setCredentials(nextCredentials)
    await restoreUserData(nextCredentials)
    setAuthError('')
    setAppError('')
    setPage('Dashboard')
    setCredentials(nextCredentials)
  }

  const logout = async () => {
    localCalendarStore.lock(credentials)
    setCredentials(null)
    setTasks([])
    setUserPreferences(defaultPreferences)
    setCustomCategories([])
    setNotice(null)
    setAppError('')
    setPage('Dashboard')
    if (desktopApp) {
      try {
        await desktopApp.clearCredentials()
      } catch (error) {
        console.error('Could not remove saved desktop credentials:', error)
        setAuthError(`Signed out, but could not clear saved desktop credentials: ${error.message}`)
      }
    }
  }

  const toggleTaskCompletion = async (id, completed) => {
    const task = tasks.find((item) => item.id === id)
    if (!task || !credentials) return

    try {
      const result = await calendarApi.setTaskCompleted(credentials, id, completed)
      setTasks((currentTasks) => currentTasks.map((item) => (
        item.id === id
          ? { ...item, done: completed, status: completed ? 'Completed' : 'Pending', completed }
          : item
      )).concat(result?.nextTask ? [normalizeTask(result.nextTask)].filter(Boolean) : []))
      setAppError('')
      if (completed) setNotice(task)
    } catch (error) {
      console.error(`Could not ${completed ? 'complete' : 'reopen'} the task:`, error)
      setAppError(`Could not ${completed ? 'complete' : 'reopen'} this task: ${error.message}`)
    }
  }

  const saveTask = async (task, id) => {
    if (!credentials) throw new Error('Sign in to create a task.')
    const taskToSave = mapFormToTask(task)
    const savedTask = id
      ? await calendarApi.updateTask(credentials, id, taskToSave)
      : await calendarApi.createTask(credentials, taskToSave)
    const normalized = normalizeTask(savedTask)
    if (!normalized) throw new Error('The local store saved the task but returned an invalid response.')
    setTasks((currentTasks) => id
      ? currentTasks.map((item) => item.id === id ? normalized : item)
      : [...currentTasks, normalized])
    setEditingTask(null)
  }

  useEffect(() => {
    if (!desktopApp) return
    const username = credentials?.username ?? ''
    desktopApp.setReminderTasks(username, credentials ? tasks : [], userPreferences).catch((error) => {
      console.error('Could not sync local tasks with the desktop reminder service:', error)
      setAppError(`Could not update background reminders: ${error.message}`)
    })
  }, [desktopApp, credentials, tasks, userPreferences])

  useEffect(() => {
    if (desktopApp || !credentials || !userPreferences.remindersEnabled || !('Notification' in window) || Notification.permission !== 'granted') return undefined
    let checking = false
    const checkReminders = async () => {
      if (checking) return
      checking = true
      try {
        const now = Date.now()
        for (const task of tasks) {
          if (task.done || !task.isoDate) continue
          const dueAt = new Date(`${task.isoDate}T${parseTimeToIso(task.time)}`).getTime()
          if (!Number.isFinite(dueAt)) continue
          const reminderMinutes = parseReminderValue(task.reminder)
          for (const stage of getDueReminderStages(dueAt, reminderMinutes, now)) {
            const reminderKey = `${task.id}:${dueAt}:${stage}`
            if (await calendarApi.hasReminderBeenNotified(credentials, reminderKey)) continue
            const eventTitle = stage === 'due' ? 'Task starting now' : 'Upcoming task'
            const eventBody = stage === 'due'
              ? `${task.title} is scheduled now`
              : `${task.title} starts at ${new Date(dueAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`
            if (navigator.serviceWorker?.controller) {
              const registration = await navigator.serviceWorker.ready
              await registration.showNotification(eventTitle, {
                body: `${eventBody}${task.category ? ` · ${task.category}` : ''}`,
                tag: reminderKey,
                silent: !userPreferences.playSound,
              })
            } else {
              new Notification(eventTitle, {
                body: eventBody,
                tag: reminderKey,
                silent: !userPreferences.playSound,
              })
            }
            await calendarApi.markReminderNotified(credentials, reminderKey)
          }
        }
      } catch (error) {
        console.error('Could not check local task reminders:', error)
        setAppError(`Could not check local task reminders: ${error.message}`)
      } finally {
        checking = false
      }
    }

    void checkReminders()
    const interval = window.setInterval(() => { void checkReminders() }, 10_000)
    return () => window.clearInterval(interval)
  }, [credentials, desktopApp, tasks, userPreferences.playSound, userPreferences.remindersEnabled])

  useEffect(() => {
    if (desktopApp) return undefined
    const captureInstallPrompt = (event) => {
      event.preventDefault()
      setInstallPrompt(event)
    }
    const clearInstallPrompt = () => setInstallPrompt(null)
    window.addEventListener('beforeinstallprompt', captureInstallPrompt)
    window.addEventListener('appinstalled', clearInstallPrompt)
    return () => {
      window.removeEventListener('beforeinstallprompt', captureInstallPrompt)
      window.removeEventListener('appinstalled', clearInstallPrompt)
    }
  }, [desktopApp])

  const deleteTask = async (id) => {
    const task = tasks.find((item) => item.id === id)
    if (!task || !credentials) return
    try {
      await calendarApi.deleteTask(credentials, id)
      setTasks((currentTasks) => currentTasks.filter((item) => item.id !== id))
    } catch (error) {
      console.error('Could not delete the task:', error)
      setAppError(`Could not delete this task: ${error.message}`)
    }
  }

  const returnToCalendar = (date) => {
    const parsedDate = new Date(`${date}T12:00:00`)
    if (!Number.isNaN(parsedDate.getTime())) {
      setCalendarMonth(new Date(parsedDate.getFullYear(), parsedDate.getMonth(), 1))
      setSelectedDate(date)
    }
  }

  if (!authReady) return <main className="auth-loading"><span className="auth-brand-mark">◔</span><p>Opening your calendar…</p></main>
  if (!credentials) return <AuthPage onAuthenticate={authenticate} initialError={authError} />

  const content = {
    Dashboard: <DashboardPage tasks={tasks.filter((task) => !task.done)} setPage={setPage} month={calendarMonth} setMonth={setCalendarMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate} onAddForDate={(date) => openAddTask(date, 'Dashboard')} />,
    Calendar: <CalendarPage tasks={tasks} month={calendarMonth} setMonth={setCalendarMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate} onAddForDate={(date) => { returnToCalendar(date); openAddTask(date, 'Calendar') }} />,
    Tasks: <TasksPage key={selectedCategory || 'all'} tasks={tasks} onToggle={toggleTaskCompletion} onEdit={openEditTask} onDelete={deleteTask} category={selectedCategory} onClearCategory={() => setPage('Categories')} />,
    'Add Task': <AddTaskPage key={`${taskDate}-${editingTask?.id ?? 'new'}`} addTask={saveTask} setPage={(nextPage) => { if (nextPage === taskReturnPage) setEditingTask(null); setPage(nextPage) }} initialDate={taskDate} returnPage={taskReturnPage} initialTask={editingTask} categories={[...new Set([...defaultCategories, ...customCategories, ...tasks.map((task) => task.category).filter(Boolean)])]} defaultReminder={userPreferences.defaultReminder} />,
    Reminders: <RemindersPage tasks={tasks} onToggle={toggleTaskCompletion} />,
    Completed: <CompletedPage tasks={tasks} onToggle={toggleTaskCompletion} onEdit={openEditTask} onDelete={deleteTask} />,
    Statistics: <StatisticsPage tasks={tasks} />,
    Categories: <CategoriesPage tasks={tasks} customCategories={customCategories} onAddCategory={addCustomCategory} onSelectCategory={showCategoryTasks} />,
    Settings: <SettingsPage preferences={userPreferences} onPreferenceChange={updateUserPreference} installPrompt={installPrompt} onInstall={() => setInstallPrompt(null)} />,
  }[page]

  return (
    <div className={`desktop theme-${userPreferences.theme} font-${userPreferences.fontSize}`}>
      <header className="mobile-title"><WindowTitle /></header>
      <div className="app-window">
        <Sidebar page={page} setPage={navigateToPage} username={credentials.username} onLogout={logout} />
        <main className="content">{!isOnline && <p className="offline-note" role="status">Offline — your calendar stays on this device. App updates are available when you reconnect.</p>}{appError && <p className="connection-note" role="alert">{appError}</p>}{content}</main>
      </div>
      {notice && <Notice task={notice} onClose={() => setNotice(null)} />}
    </div>
  )
}

export default Dashboard
