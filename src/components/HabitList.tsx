import { useState, type FormEvent } from 'react'
import { lastDays, localDate, streak } from '../lib/dates'
import { crashTest } from '../lib/crashTest'
import { useOnline } from '../lib/useOnline'
import type { HabitStore } from '../lib/useHabits'
import type { Habit } from '../types'

const WEEK = 7

export default function HabitList({ habits, error, queued, syncing, addHabit, toggleDay, deleteHabit }: HabitStore) {
  crashTest('habits')

  const online = useOnline()
  const [name, setName] = useState('')

  async function add(e: FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    setName('')
    await addHabit(trimmed)
  }

  function remove(habit: Habit) {
    const n = habit.habit_logs.length
    const message = habit.queued
      ? `Delete "${habit.name}"? It hasn’t synced yet, so it only exists on this device.`
      : `Delete "${habit.name}" and its ${n} check-in${n === 1 ? '' : 's'}?`
    if (!confirm(message)) return
    deleteHabit(habit)
  }

  const days = lastDays(WEEK)
  const today = localDate()

  return (
    <section className="stack" aria-label="Your habits">
      <form className="add sm:max-w-md" onSubmit={add}>
        <input
          aria-label="New habit"
          placeholder="New habit, e.g. Read 10 pages"
          maxLength={80}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <button type="submit" disabled={!name.trim()}>
          Add
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {queued > 0 && (
        <p className="notice" role="status">
          {syncing
            ? `Syncing ${queued} habit${queued === 1 ? '' : 's'}…`
            : `${queued} habit${queued === 1 ? '' : 's'} added offline, waiting to sync.`}
        </p>
      )}

      {habits === null && !error && <p className="muted center">Loading habits…</p>}

      {habits?.length === 0 && (
        <div className="empty">
          <p>No habits yet.</p>
          <p className="muted">Add one above. Only you can see your list.</p>
        </div>
      )}

      {/* One column on phones, two on tablets, three on desktops: never wider than the screen. */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {habits?.map((habit) => {
          const done = new Set(habit.habit_logs.map((l) => l.done_on))
          const s = streak(done)
          const total = habit.habit_logs.length
          // A queued habit has no row to log against yet, and a check-in
          // needs the server, so the days wait for both.
          const locked = habit.queued || !online
          return (
            <article key={habit.id} className={`card habit${habit.queued ? ' queued' : ''}`}>
              <div className="habit-head">
                <h2>{habit.name}</h2>
                <button className="ghost danger" onClick={() => remove(habit)} aria-label={`Delete ${habit.name}`}>
                  Delete
                </button>
              </div>

              <div className="week">
                {days.map((d) => {
                  const key = localDate(d)
                  const isDone = done.has(key)
                  const isToday = key === today
                  return (
                    <button
                      key={key}
                      className={`day${isDone ? ' done' : ''}${isToday ? ' today' : ''}`}
                      aria-pressed={isDone}
                      aria-label={`${isToday ? 'Today, ' : ''}${d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}`}
                      title={locked ? (habit.queued ? 'Check-ins open once this habit syncs' : 'Check-ins need a connection') : d.toDateString()}
                      disabled={locked}
                      onClick={() => toggleDay(habit, key, isDone)}
                    >
                      <span className="dow">{d.toLocaleDateString(undefined, { weekday: 'short' })}</span>
                      <span className="num">{d.getDate()}</span>
                    </button>
                  )
                })}
              </div>

              <p className="muted stats">
                {habit.queued ? (
                  <span className="pill">{syncing ? 'Syncing…' : 'Queued · syncs when you’re online'}</span>
                ) : (
                  <>
                    {s > 0 ? `${s}-day streak` : 'No streak yet'} · {total} check-in{total === 1 ? '' : 's'}
                  </>
                )}
              </p>
            </article>
          )
        })}
      </div>
    </section>
  )
}
