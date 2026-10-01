import { useEffect, useState } from 'react'
import {
  ArrowDownUp, ArrowLeft, ArrowRight, Bell, CalendarDays, Check, CheckCheck,
  ChevronDown, CircleHelp, Clock3, LayoutDashboard, ListTodo, Menu, MoreHorizontal,
  Plus, Search, Settings2, Sparkles, Tag, Target, Trash2, X,
} from 'lucide-react'
import './Dashboard.css'
import { calendarApi } from '../api/calendarApi.js'

const navigation = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Calendar', icon: CalendarDays },
  { label: 'Tasks', icon: ListTodo },
  { label: 'Reminders', icon: Bell },
  { label: 'Completed', icon: CheckCheck },
  { label: 'Statistics', icon: Target },
  { label: 'Categories', icon: Tag },
]

const defaultCredentials = { username: 'prem', password: 'admin123' }
const today = new Date()
const dateInputValue = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const categories = ['Work', 'Personal', 'Learning', 'Health', 'Errands']
const initialTasks = [
  { id: 1, title: 'Review project proposal', date: dateInputValue(today), time: '09:30', category: 'Work', priority: 'High', done: false, description: 'Add final comments before the team review.' },
  { id: 2, title: 'Pick up a few groceries', date: dateInputValue(today), time: '12:15', category: 'Personal', priority: 'Medium', done: false, description: '' },
  { id: 3, title: 'Read for twenty minutes', date: dateInputValue(today), time: '17:00', category: 'Learning', priority: 'Low', done: false, description: '' },
  { id: 4, title: 'Plan the week ahead', date: dateInputValue(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1)), time: '10:00', category: 'Personal', priority: 'Medium', done: false, description: '' },
]

const toLocalDate = (value, time = '00:00') => {
  if (!value) return null
  const [year, month, day] = String(value).slice(0, 10).split('-').map(Number)
  const [hours = 0, minutes = 0] = String(time).slice(0, 5).split(':').map(Number)
  const result = new Date(year, month - 1, day, hours, minutes)
  return Number.isNaN(result.getTime()) ? null : result
}

const normalizeTask = (task) => {
  if (!task) return null
  const time = task.time ?? '00:00'
  const parsed = toLocalDate(task.date ?? task.dueDate, time)
  return {
    id: Number(task.id),
    title: task.title ?? 'Untitled task',
    date: parsed ? dateInputValue(parsed) : '',
    time: String(time).slice(0, 5),
    category: task.category ?? 'Personal',
    priority: task.priority ?? 'Medium',
    done: Boolean(task.completed ?? task.status?.toLowerCase() === 'completed'),
    description: task.description ?? '',
    reminder: task.reminder ?? 5,
  }
}

const formatTime = (time) => toLocalDate(dateInputValue(new Date()), time)?.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) ?? 'Any time'

function IconButton({ label, onClick, children, className = '' }) {
  return <button className={`icon-button ${className}`} type="button" aria-label={label} title={label} onClick={onClick}>{children}</button>
}

function PageHeading({ eyebrow, title, subtitle, action }) {
  return <header className="page-heading"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1>{subtitle && <p className="page-subtitle">{subtitle}</p>}</div>{action}</header>
}

function TaskRow({ task, onDone, onDelete, compact = false }) {
  return <article className={`task-row${compact ? ' compact' : ''}${task.done ? ' is-done' : ''}`}>
    <button className={`task-check${task.done ? ' checked' : ''}`} type="button" aria-label={task.done ? `Completed ${task.title}` : `Complete ${task.title}`} onClick={() => onDone(task.id)}>{task.done && <Check size={14} />}</button>
    <div className="task-copy"><strong>{task.title}</strong><span>{task.description || task.category}</span></div>
    {!compact && <span className={`priority ${task.priority.toLowerCase()}`}><i />{task.priority}</span>}
    <time className="task-time">{formatTime(task.time)}</time>
    {onDelete && <IconButton label={`Delete ${task.title}`} className="delete-task" onClick={() => onDelete(task.id)}><Trash2 size={16} /></IconButton>}
  </article>
}

function CalendarGrid({ month, tasks, onMonthChange, selectedDate, setSelectedDate, compact = false }) {
  const year = month.getFullYear()
  const monthIndex = month.getMonth()
  const firstDay = new Date(year, monthIndex, 1).getDay()
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate()
  const cells = Array.from({ length: Math.ceil((firstDay + daysInMonth) / 7) * 7 }, (_, index) => {
    const day = index - firstDay + 1
    return day > 0 && day <= daysInMonth ? new Date(year, monthIndex, day) : null
  })
  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })

  return <section className={`calendar-panel${compact ? ' mini-calendar' : ''}`}>
    <div className="calendar-toolbar"><div><h2>{monthLabel}</h2>{!compact && <span>Choose a day to see what’s on</span>}</div><div className="calendar-controls">
      <IconButton label="Previous month" onClick={() => onMonthChange(new Date(year, monthIndex - 1, 1))}><ArrowLeft size={17} /></IconButton>
      <IconButton label="Next month" onClick={() => onMonthChange(new Date(year, monthIndex + 1, 1))}><ArrowRight size={17} /></IconButton>
      {!compact && <button className="text-button" type="button" onClick={() => { const now = new Date(); onMonthChange(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(dateInputValue(now)) }}>Today</button>}
    </div></div>
    <div className="calendar-grid">
      {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span className="calendar-weekday" key={day}>{compact ? day.slice(0, 1) : day}</span>)}
      {cells.map((date, index) => {
        if (!date) return <span className="calendar-empty" key={`empty-${index}`} />
        const key = dateInputValue(date)
        const dayTasks = tasks.filter((task) => task.date === key)
        return <button className={`calendar-day${key === selectedDate ? ' selected' : ''}${key === dateInputValue(today) ? ' is-today' : ''}`} key={key} type="button" onClick={() => setSelectedDate(key)} aria-label={`${date.toLocaleDateString()}, ${dayTasks.length} tasks`}>
          <span className="day-number">{date.getDate()}</span>
          {!compact && <span className="day-events">{dayTasks.slice(0, 2).map((task) => <span className={`event-chip ${task.priority.toLowerCase()}`} key={task.id}>{task.title}</span>)}{dayTasks.length > 2 && <small>+{dayTasks.length - 2} more</small>}</span>}
          {compact && dayTasks.length > 0 && <i className="calendar-dot" />}
        </button>
      })}
    </div>
  </section>
}

function OverviewPage({ tasks, onDone, onDelete, setPage, month, setMonth, selectedDate, setSelectedDate }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 60_000); return () => window.clearInterval(timer) }, [])
  const todayTasks = tasks.filter((task) => !task.done && task.date === dateInputValue(now)).sort((a, b) => a.time.localeCompare(b.time))
  const completeCount = tasks.filter((task) => task.done).length
  const progress = tasks.length ? Math.round((completeCount / tasks.length) * 100) : 0

  return <div className="page-body overview-page">
    <PageHeading eyebrow={now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })} title="Make room for what matters." subtitle="A clear view of your day, one thoughtful step at a time." action={<button className="primary-button" type="button" onClick={() => setPage('Add Task')}><Plus size={17} /> New task</button>} />
    <section className="welcome-band"><div className="welcome-icon"><Sparkles size={22} /></div><div><span className="welcome-label">YOUR DAY, AT A GLANCE</span><h2>{now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening'}.</h2><p>{todayTasks.length ? `You have ${todayTasks.length} ${todayTasks.length === 1 ? 'thing' : 'things'} on your list today. Start wherever you are.` : 'Your calendar has some breathing room today. Make it count.'}</p></div><div className="welcome-date"><b>{now.toLocaleDateString(undefined, { day: '2-digit' })}</b><span>{now.toLocaleDateString(undefined, { month: 'short' }).toUpperCase()}</span></div></section>
    <div className="overview-grid"><section className="surface today-surface"><div className="section-heading"><div><p className="eyebrow">THE NEXT FEW HOURS</p><h2>Today’s tasks <span>{todayTasks.length}</span></h2></div><button className="text-button" type="button" onClick={() => setPage('Tasks')}>All tasks <ArrowRight size={15} /></button></div>{todayTasks.length ? <div className="task-list">{todayTasks.map((task) => <TaskRow key={task.id} task={task} onDone={onDone} onDelete={onDelete} compact />)}</div> : <EmptyState title="A little space in your day" detail="Add a task when something comes to mind." action={() => setPage('Add Task')} />}</section>
      <aside className="overview-aside"><CalendarGrid month={month} tasks={tasks} onMonthChange={setMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate} compact /><section className="surface progress-surface"><div className="progress-heading"><div className="progress-mark"><Target size={18} /></div><div><strong>Keep your momentum</strong><span>{completeCount} of {tasks.length} tasks completed</span></div><b>{progress}%</b></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div></section></aside></div>
  </div>
}

function CalendarPage({ tasks, month, setMonth, selectedDate, setSelectedDate, setPage }) {
  const selectedTasks = tasks.filter((task) => task.date === selectedDate).sort((a, b) => a.time.localeCompare(b.time))
  const selectedLabel = toLocalDate(selectedDate)?.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' }) ?? 'Selected day'
  return <div className="page-body"><PageHeading eyebrow="YOUR SCHEDULE" title="Calendar" subtitle="See the shape of your month, and make a little room." action={<button className="primary-button" type="button" onClick={() => setPage('Add Task')}><Plus size={17} /> New task</button>} /><div className="calendar-page-grid"><CalendarGrid month={month} tasks={tasks} onMonthChange={setMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate} /><section className="surface selected-day-panel"><p className="eyebrow">DAY PLAN</p><h2>{selectedLabel}</h2>{selectedTasks.length ? <div className="task-list">{selectedTasks.map((task) => <TaskRow key={task.id} task={task} onDone={() => {}} compact />)}</div> : <EmptyState title="Nothing planned yet" detail="This is an open space in your calendar." action={() => setPage('Add Task')} />}</section></div></div>
}

function TasksPage({ tasks, onDone, onDelete, setPage }) {
  const [filter, setFilter] = useState('All')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('All categories')
  const visibleTasks = tasks.filter((task) => (filter === 'All' || (filter === 'Pending' ? !task.done : task.done)) && (category === 'All categories' || task.category === category) && `${task.title} ${task.category} ${task.description}`.toLowerCase().includes(query.toLowerCase())).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  return <div className="page-body"><PageHeading eyebrow="YOUR TASK LIST" title="Tasks" subtitle={`${tasks.filter((task) => !task.done).length} still on your plate. You’ve got this.`} action={<button className="primary-button" type="button" onClick={() => setPage('Add Task')}><Plus size={17} /> New task</button>} /><section className="surface task-manager"><div className="task-toolbar"><div className="filter-tabs">{['All', 'Pending', 'Completed'].map((tab) => <button className={filter === tab ? 'active' : ''} key={tab} type="button" onClick={() => setFilter(tab)}>{tab}<span>{tab === 'All' ? tasks.length : tab === 'Pending' ? tasks.filter((task) => !task.done).length : tasks.filter((task) => task.done).length}</span></button>)}</div><label className="search-field"><Search size={16} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your tasks" /></label><label className="select-field"><ArrowDownUp size={15} /><select value={category} onChange={(event) => setCategory(event.target.value)}><option>All categories</option>{Array.from(new Set(tasks.map((task) => task.category))).map((item) => <option key={item}>{item}</option>)}</select><ChevronDown size={14} /></label></div>
    {visibleTasks.length ? <div className="task-list">{visibleTasks.map((task) => <TaskRow key={task.id} task={task} onDone={onDone} onDelete={onDelete} />)}</div> : <EmptyState title={query ? 'No matching tasks' : 'No tasks in this view'} detail={query ? 'Try another title or category.' : 'Add a task to start shaping your day.'} action={() => setPage('Add Task')} />}
  </section></div>
}

function RemindersPage({ tasks, onDone }) {
  const upcoming = tasks.filter((task) => !task.done).sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  return <div className="page-body"><PageHeading eyebrow="STAY IN THE LOOP" title="Reminders" subtitle="A gentle nudge for the things you don’t want to miss." /><section className="surface reminder-surface"><div className="section-heading"><div><p className="eyebrow">UP NEXT</p><h2>Upcoming <span>{upcoming.length}</span></h2></div><Bell size={19} className="muted-icon" /></div>{upcoming.length ? <div className="task-list">{upcoming.map((task) => <TaskRow key={task.id} task={task} onDone={onDone} compact />)}</div> : <EmptyState title="All caught up" detail="New reminders will appear here with your upcoming tasks." />}</section></div>
}

function CompletedPage({ tasks, onDone, onDelete }) {
  const completed = tasks.filter((task) => task.done).sort((a, b) => b.date.localeCompare(a.date))
  return <div className="page-body"><PageHeading eyebrow="LOOK HOW FAR YOU’VE COME" title="Completed" subtitle="Small wins add up. Here’s your recent progress." /><section className="surface completed-surface">{completed.length ? <div className="task-list">{completed.map((task) => <TaskRow key={task.id} task={task} onDone={onDone} onDelete={onDelete} />)}</div> : <EmptyState title="Your first win is waiting" detail="Complete a task and it’ll find its way here." />}</section></div>
}

function StatisticsPage({ tasks }) {
  const completed = tasks.filter((task) => task.done).length
  const pending = tasks.length - completed
  const rate = tasks.length ? Math.round(completed / tasks.length * 100) : 0
  const categoryCounts = Array.from(new Set(tasks.map((task) => task.category))).map((category) => ({ category, count: tasks.filter((task) => task.category === category).length })).sort((a, b) => b.count - a.count)
  const maxCount = Math.max(1, ...categoryCounts.map((item) => item.count))
  return <div className="page-body"><PageHeading eyebrow="A MOMENT TO REFLECT" title="Your progress" subtitle="A few useful signals from the plans you’ve made." /><div className="stat-grid"><StatCard label="Total tasks" value={tasks.length} icon={<ListTodo size={18} />} tone="green" /><StatCard label="Completed" value={completed} icon={<CheckCheck size={18} />} tone="orange" /><StatCard label="In progress" value={pending} icon={<Clock3 size={18} />} tone="blue" /></div><div className="statistics-grid"><section className="surface completion-panel"><p className="eyebrow">FOLLOW-THROUGH</p><h2>Completion rate</h2><div className="rate-display"><strong>{rate}<small>%</small></strong><span>{completed === 0 ? 'Every completed task starts with one.' : `${completed} ${completed === 1 ? 'task' : 'tasks'} finished. Keep it going.`}</span></div><div className="progress-track"><i style={{ width: `${rate}%` }} /></div></section><section className="surface category-panel"><p className="eyebrow">WHERE YOUR TIME GOES</p><h2>By category</h2>{categoryCounts.length ? <div className="category-bars">{categoryCounts.map((item, index) => <div className="category-bar-row" key={item.category}><div><span className={`category-dot tone-${index % 4}`} />{item.category}<b>{item.count}</b></div><span className="bar-track"><i className={`tone-${index % 4}`} style={{ width: `${item.count / maxCount * 100}%` }} /></span></div>)}</div> : <p className="empty-inline">Your categories will appear as you add tasks.</p>}</section></div></div>
}

function StatCard({ label, value, icon, tone }) {
  return <section className="surface stat-card"><span className={`stat-icon ${tone}`}>{icon}</span><span className="stat-label">{label}</span><strong>{value}</strong></section>
}

function CategoriesPage({ tasks, setPage }) {
  const taskCategories = Array.from(new Set([...categories, ...tasks.map((task) => task.category)]))
  const tones = ['sage', 'peach', 'sky', 'lilac', 'lemon']
  return <div className="page-body"><PageHeading eyebrow="A PLACE FOR EVERYTHING" title="Categories" subtitle="Group your plans in a way that makes sense to you." /><div className="category-grid">{taskCategories.map((category, index) => { const count = tasks.filter((task) => task.category === category).length; return <button className="surface category-card" key={category} type="button" onClick={() => setPage('Tasks')}><span className={`category-art ${tones[index % tones.length]}`}><Tag size={19} /></span><strong>{category}</strong><span>{count} {count === 1 ? 'task' : 'tasks'}</span><ArrowRight size={16} className="category-arrow" /></button> })}</div></div>
}

function AddTaskPage({ addTask, setPage }) {
  const [form, setForm] = useState({ title: '', date: dateInputValue(today), time: '09:00', category: 'Work', priority: 'Medium', reminder: '5', description: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const change = (event) => setForm((current) => ({ ...current, [event.target.name]: event.target.value }))
  const save = async (event) => {
    event.preventDefault()
    if (!form.title.trim()) { setError('Give your task a name first.'); return }
    setSaving(true)
    setError('')
    try { await addTask(form); setPage('Tasks') } catch (saveError) { setError(saveError.message || 'Could not save this task.') } finally { setSaving(false) }
  }
  return <div className="page-body"><PageHeading eyebrow="MAKE A LITTLE PLAN" title="New task" subtitle="Get it out of your head and into your day." /><form className="surface task-form" onSubmit={save}>
    <label className="form-field full-width"><span>Task name</span><input autoFocus name="title" value={form.title} onChange={change} placeholder="What needs doing?" maxLength={120} required /></label>
    <label className="form-field"><span>Date</span><input type="date" name="date" value={form.date} onChange={change} required /></label>
    <label className="form-field"><span>Time</span><input type="time" name="time" value={form.time} onChange={change} required /></label>
    <label className="form-field"><span>Category</span><select name="category" value={form.category} onChange={change}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
    <label className="form-field"><span>Priority</span><select name="priority" value={form.priority} onChange={change}><option>Low</option><option>Medium</option><option>High</option></select></label>
    <label className="form-field"><span>Reminder</span><select name="reminder" value={form.reminder} onChange={change}><option value="0">At the scheduled time</option><option value="5">5 minutes before</option><option value="10">10 minutes before</option><option value="30">30 minutes before</option></select></label>
    <label className="form-field full-width"><span>Notes <small>Optional</small></span><textarea name="description" value={form.description} onChange={change} placeholder="Add a little context..." rows="3" maxLength={500} /></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="secondary-button" type="button" onClick={() => setPage('Overview')}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : <><Plus size={17} /> Save task</>}</button></div>
  </form></div>
}

function SettingsPage() {
  const [settings, setSettings] = useState(() => { try { return { reminders: true, weekStartsMonday: false, ...JSON.parse(localStorage.getItem('smart-calendar-settings') || '{}') } } catch { return { reminders: true, weekStartsMonday: false } } })
  const toggle = (name) => setSettings((current) => { const updated = { ...current, [name]: !current[name] }; localStorage.setItem('smart-calendar-settings', JSON.stringify(updated)); return updated })
  return <div className="page-body"><PageHeading eyebrow="MAKE IT YOURS" title="Settings" subtitle="A couple of small choices to make this feel like your space." /><section className="surface settings-panel"><SettingRow title="Task reminders" detail="Show your upcoming tasks in the reminders view." checked={settings.reminders} onChange={() => toggle('reminders')} /><SettingRow title="Start the week on Monday" detail="Use Monday as the first day in your calendar." checked={settings.weekStartsMonday} onChange={() => toggle('weekStartsMonday')} /><div className="settings-note"><Settings2 size={17} /><span>Your preferences are saved on this device.</span></div></section></div>
}

function SettingRow({ title, detail, checked, onChange }) {
  return <div className="setting-row"><div><strong>{title}</strong><span>{detail}</span></div><button className={`switch${checked ? ' enabled' : ''}`} role="switch" aria-checked={checked} aria-label={title} type="button" onClick={onChange}><i /></button></div>
}

function EmptyState({ title, detail, action }) {
  return <div className="empty-state"><span className="empty-icon"><CalendarDays size={21} /></span><strong>{title}</strong><p>{detail}</p>{action && <button className="text-button" type="button" onClick={action}>Add a task <ArrowRight size={15} /></button>}</div>
}

function Sidebar({ page, setPage, open, setOpen }) {
  return <aside className={`sidebar${open ? ' sidebar-open' : ''}`}><div className="brand"><button className="brand-link" type="button" onClick={() => setPage('Overview')}><span className="brand-mark"><CalendarDays size={18} /></span><span>daymark<small>PERSONAL PLANNER</small></span></button><button className="sidebar-close" type="button" aria-label="Close menu" onClick={() => setOpen(false)}><X size={18} /></button></div>
    <span className="nav-label">WORKSPACE</span><nav>{navigation.map(({ label, icon: Icon }) => <button className={`nav-link${page === label ? ' active' : ''}`} key={label} type="button" onClick={() => { setPage(label); setOpen(false) }}><Icon size={18} strokeWidth={1.8} /><span>{label}</span></button>)}</nav>
    <button className="sidebar-help" type="button" onClick={() => setPage('Settings')}><CircleHelp size={17} /><span>Preferences</span><ArrowRight size={15} /></button><div className="sidebar-footer"><span className="avatar">P</span><div><strong>My workspace</strong><small>Personal planner</small></div><MoreHorizontal size={18} /></div>
  </aside>
}

function DashboardWorkspace() {
  const [page, setPage] = useState('Overview')
  const [tasks, setTasks] = useState(initialTasks)
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(dateInputValue(today))
  const [menuOpen, setMenuOpen] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    let isMounted = true
    const loadTasks = async () => {
      try {
        const response = await calendarApi.listTasks(defaultCredentials, 0, 100)
        const loadedTasks = response?.content ? response.content.map(normalizeTask).filter(Boolean) : Array.isArray(response) ? response.map(normalizeTask).filter(Boolean) : []
        if (isMounted) { setTasks(loadedTasks); setLoadError('') }
      } catch (error) {
        console.warn('The task service is unavailable; showing local sample tasks:', error)
        if (isMounted) setLoadError('Showing sample tasks. Connect the backend to sync your plans.')
      }
    }
    loadTasks()
    return () => { isMounted = false }
  }, [])

  const done = async (id) => {
    const task = tasks.find((item) => item.id === id)
    if (!task) return
    const updated = { ...task, done: !task.done }
    setTasks((current) => current.map((item) => item.id === id ? updated : item))
    try {
      if (updated.done) await calendarApi.completeTask(defaultCredentials, id)
      else await calendarApi.updateTask(defaultCredentials, id, { ...updated, time: `${updated.time}:00`, completed: false, status: 'Pending', reminder: updated.reminder ?? 5 })
    } catch (error) { console.warn('Could not sync the task update:', error) }
  }

  const addTask = async (form) => {
    const payload = { title: form.title.trim(), description: form.description.trim() || form.title.trim(), date: form.date, time: `${form.time}:00`, category: form.category, priority: form.priority, status: 'Pending', reminder: Number(form.reminder), completed: false }
    try {
      const saved = await calendarApi.createTask(defaultCredentials, payload)
      setTasks((current) => [...current, normalizeTask(saved) ?? normalizeTask({ ...payload, id: Date.now() })])
    } catch (error) {
      console.warn('Could not save to the backend; keeping the task in this session:', error)
      setTasks((current) => [...current, normalizeTask({ ...payload, id: Date.now() })])
    }
  }

  const deleteTask = async (id) => {
    setTasks((current) => current.filter((task) => task.id !== id))
    try { await calendarApi.deleteTask(defaultCredentials, id) } catch (error) { console.warn('Could not sync task deletion:', error) }
  }

  const pageContent = {
    Overview: <OverviewPage tasks={tasks} onDone={done} onDelete={deleteTask} setPage={setPage} month={month} setMonth={setMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate} />,
    Calendar: <CalendarPage tasks={tasks} month={month} setMonth={setMonth} selectedDate={selectedDate} setSelectedDate={setSelectedDate} setPage={setPage} />,
    Tasks: <TasksPage tasks={tasks} onDone={done} onDelete={deleteTask} setPage={setPage} />,
    'Add Task': <AddTaskPage addTask={addTask} setPage={setPage} />,
    Reminders: <RemindersPage tasks={tasks} onDone={done} />,
    Completed: <CompletedPage tasks={tasks} onDone={done} onDelete={deleteTask} />,
    Statistics: <StatisticsPage tasks={tasks} />,
    Categories: <CategoriesPage tasks={tasks} setPage={setPage} />,
    Settings: <SettingsPage />,
  }
  const activePage = navigation.some(({ label }) => label === page) ? page : 'Tasks'

  return <div className="app-shell"><Sidebar page={activePage} setPage={setPage} open={menuOpen} setOpen={setMenuOpen} />{menuOpen && <button className="sidebar-backdrop" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <main className="main-area"><header className="topbar"><IconButton label="Open navigation" className="menu-trigger" onClick={() => setMenuOpen(true)}><Menu size={20} /></IconButton><div className="breadcrumb"><span>Workspace</span><ArrowRight size={14} /><strong>{page}</strong></div><div className="topbar-actions"><span className="today-label"><Clock3 size={15} />{today.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</span><span className="topbar-divider" /><span className="avatar small-avatar">P</span></div></header>{loadError && <div className="connection-note"><span />{loadError}</div>}{pageContent[page] ?? pageContent.Tasks}<footer className="page-footer"><span>One thing at a time.</span><span>DAYMARK <span className="footer-dot">•</span> PERSONAL PLANNER</span></footer></main>
  </div>
}

export default DashboardWorkspace
