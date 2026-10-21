import { createServer, type Server } from 'http'
import { buildIcs, calendarEntries } from '../../shared/calendar'
import { getDailies } from '../dailies'
import { getTasks } from '../tasks'

// SPEC 9.14, Paso 1: the .ics feed. A tiny server only this Mac can reach (127.0.0.1)
// that the Calendar app subscribes to, so tasks and dailies show up there and stay up to
// date on their own (Calendar checks every few minutes). Read-only from Calendar's side.
// Always the same port, so the subscription keeps working after a restart.

const PORT = 47_321
const PATH = '/nuggit.ics'

let server: Server | null = null

export const feedUrl = (): string => `webcal://127.0.0.1:${PORT}${PATH}`

export function currentIcs(): string {
  return buildIcs(calendarEntries(getTasks(), getDailies()))
}

export function startFeed(): Promise<boolean> {
  if (server) return Promise.resolve(true)
  return new Promise((resolve) => {
    const s = createServer((req, res) => {
      if (req.method !== 'GET' || req.url?.split('?')[0] !== PATH) {
        res.writeHead(404).end()
        return
      }
      res.writeHead(200, {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'no-cache'
      })
      res.end(currentIcs())
    })
    s.once('error', (err) => {
      console.error('[calendar] the feed could not start', err)
      resolve(false)
    })
    s.listen(PORT, '127.0.0.1', () => {
      server = s
      resolve(true)
    })
  })
}

export function stopFeed(): void {
  server?.close()
  server = null
}

export const feedRunning = (): boolean => server !== null
