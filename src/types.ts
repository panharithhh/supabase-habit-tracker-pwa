export type Habit = {
  id: string
  name: string
  created_at: string
  habit_logs: { done_on: string }[]
  /** Added offline and waiting to sync; only on this device so far. */
  queued?: boolean
}
