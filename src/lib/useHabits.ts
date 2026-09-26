import { useCallback, useEffect, useRef, useState } from 'react'
import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { isNetworkError, readQueue, writeQueue, type QueuedHabit } from './offlineQueue'
import type { Habit } from '../types'

const OFFLINE_WRITE = 'You’re offline, so that change wasn’t saved. Try again when you’re back online.'

/** The signed-in user's habits and the writes that change them. Shared by the list and the stats. */
export function useHabits(userId: string) {
  const [habits, setHabits] = useState<Habit[] | null>(null)
  // A failed read clears itself on the next good read; a failed write or
  // sync stays until the next write.
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Habits added offline, not yet in the database.
  const [queue, setQueue] = useState<QueuedHabit[]>(() => readQueue(userId))
  const [syncing, setSyncing] = useState(false)
  // Day cells with a write in flight, as `${habitId}:${day}`, so a double
  // click can't send an insert and a delete that race each other.
  const [pending, setPending] = useState<ReadonlySet<string>>(new Set())
  const latestLoad = useRef(0)
  const flushing = useRef(false)

  // localStorage is the source of truth for the queue, so two updates in a
  // row never work from a stale copy.
  const updateQueue = useCallback(
    (change: (queue: QueuedHabit[]) => QueuedHabit[]) => {
      const next = change(readQueue(userId))
      writeQueue(userId, next)
      setQueue(next)
    },
    [userId],
  )

  // Every read goes to Supabase. Offline, the service worker answers with the
  // last response it cached (NetworkFirst), so the list still shows. No
  // .eq('user_id', …) here: RLS already limits the rows to the signed-in user.
  const load = useCallback(async () => {
    const id = ++latestLoad.current
    const { data, error } = await supabase
      .from('habits')
      .select('id, name, created_at, habit_logs(done_on)')
      .order('created_at')
    if (id !== latestLoad.current) return // a newer read is on its way
    if (!error) setHabits(data)
    setLoadError(
      !error
        ? null
        : isNetworkError(error)
          ? 'You’re offline, and your list hasn’t been saved on this device yet. It will load when you reconnect.'
          : `Couldn’t load your habits: ${error.message}`,
    )
  }, [])

  // Send every queued habit, oldest first. Each has its final id already, so a
  // retry after a half-finished sync can't add a habit twice.
  const flush = useCallback(async () => {
    if (flushing.current || !navigator.onLine || !readQueue(userId).length) return
    flushing.current = true
    setSyncing(true)
    for (const habit of readQueue(userId)) {
      const { error } = await supabase.from('habits').insert({ id: habit.id, name: habit.name })
      // 23505: the id is already there, so an earlier attempt got through.
      if (error && error.code !== '23505') {
        if (isNetworkError(error)) break // still no connection; the next 'online' event retries
        // The server refused it, so retrying won't help. Drop it and say why.
        setError(`Couldn’t sync “${habit.name}”: ${error.message}`)
      }
      updateQueue((q) => q.filter((h) => h.id !== habit.id))
    }
    flushing.current = false
    setSyncing(false)
    await load()
  }, [userId, load, updateQueue])

  useEffect(() => {
    load()
    flush()
    window.addEventListener('online', flush)
    return () => window.removeEventListener('online', flush)
  }, [load, flush])

  // Run a write, then re-read so the screen always matches the database
  // (and any optimistic change is corrected if the write failed).
  async function write(query: PromiseLike<{ error: PostgrestError | null }>) {
    setError(null)
    const { error } = await query
    await load()
    if (error) setError(isNetworkError(error) ? OFFLINE_WRITE : error.message)
  }

  async function addHabit(name: string) {
    // The id is made here so a queued habit keeps it all the way to the
    // database. user_id is filled in by the column default, auth.uid().
    const habit = { id: crypto.randomUUID(), name, created_at: new Date().toISOString() }
    if (!navigator.onLine) return updateQueue((q) => [...q, habit])

    setError(null)
    const { error } = await supabase.from('habits').insert({ id: habit.id, name })
    // The connection dropped mid-request: queue it rather than lose it.
    if (error && isNetworkError(error)) return updateQueue((q) => [...q, habit])
    await load()
    if (error) setError(error.message)
  }

  async function toggleDay(habit: Habit, day: string, done: boolean) {
    const cell = `${habit.id}:${day}`
    if (habit.queued || pending.has(cell)) return
    setPending((prev) => new Set(prev).add(cell))
    setHabits((prev) =>
      prev!.map((h) =>
        h.id !== habit.id
          ? h
          : {
              ...h,
              habit_logs: done
                ? h.habit_logs.filter((l) => l.done_on !== day)
                : [...h.habit_logs, { done_on: day }],
            },
      ),
    )
    await write(
      done
        ? supabase.from('habit_logs').delete().eq('habit_id', habit.id).eq('done_on', day)
        : supabase.from('habit_logs').insert({ habit_id: habit.id, done_on: day }),
    )
    setPending((prev) => {
      const next = new Set(prev)
      next.delete(cell)
      return next
    })
  }

  async function deleteHabit(habit: Habit) {
    // A queued habit only exists on this device.
    if (habit.queued) return updateQueue((q) => q.filter((h) => h.id !== habit.id))
    // The foreign key's ON DELETE CASCADE removes the habit's logs.
    await write(supabase.from('habits').delete().eq('id', habit.id))
  }

  // Queued habits show after the saved ones, flagged so the list can mark them.
  const queued: Habit[] = queue
    .filter((q) => !habits?.some((h) => h.id === q.id))
    .map((q) => ({ ...q, habit_logs: [], queued: true }))
  const all = habits === null && !queued.length ? null : [...(habits ?? []), ...queued]

  return { habits: all, error: error ?? loadError, queued: queued.length, syncing, addHabit, toggleDay, deleteHabit }
}

export type HabitStore = ReturnType<typeof useHabits>
