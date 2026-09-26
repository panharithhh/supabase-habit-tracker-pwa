// Habits added with no connection wait here until they can be sent.
//
// The queue lives in localStorage, per user, so it survives a reload or a
// closed tab while offline. Each entry already has its final id (a client
// UUID), so sending it twice can't create a duplicate: the second insert hits
// the primary key and is treated as "already synced".

export type QueuedHabit = { id: string; name: string; created_at: string }

const key = (userId: string) => `habit-queue:${userId}`

export function readQueue(userId: string): QueuedHabit[] {
  try {
    return JSON.parse(localStorage.getItem(key(userId)) ?? '[]')
  } catch {
    return []
  }
}

export function writeQueue(userId: string, queue: QueuedHabit[]) {
  if (queue.length) localStorage.setItem(key(userId), JSON.stringify(queue))
  else localStorage.removeItem(key(userId))
}

/** True when a request failed to reach the server at all, as opposed to being refused by it. */
export function isNetworkError(error: { message: string; code?: string }) {
  return !navigator.onLine || (!error.code && /fetch|network|load failed/i.test(error.message))
}
