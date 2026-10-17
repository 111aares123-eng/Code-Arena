import { serve } from '@hono/node-server'
import { trpcServer } from '@hono/trpc-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { streamSSE } from 'hono/streaming'

import { problemRouter } from './routers/problem'
import { executionRouter } from './routers/execution'
import { authRouter } from './routers/auth'
import { getRecentActivity, subscribeToActivity, type ActivityEvent } from './services/activity-feed'
import { router, publicProcedure } from './trpc'
import { createContext } from './context'

export const appRouter = router({
  health: publicProcedure.query(() => {
    return {
      status: 'ok',
      message: 'CodeArena API is running!',
    }
  }),
  problem: problemRouter,
  execution: executionRouter,
  auth: authRouter,
})

export type AppRouter = typeof appRouter

const app = new Hono()

const allowedOrigins = Array.from(
  new Set([
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    ...(process.env.WEB_ORIGIN ? [process.env.WEB_ORIGIN] : []),
  ])
)

const corsMiddleware = cors({
  origin: allowedOrigins,
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'trpc-accept', 'Accept'],
  exposeHeaders: ['Content-Length'],
  maxAge: 86400,
})

app.use('/events', corsMiddleware)

app.get('/events', (c) =>
  streamSSE(c, async (stream) => {
    const pendingEvents: ActivityEvent[] = []
    let wakeListener: (() => void) | undefined
    let heartbeatTimer: ReturnType<typeof setTimeout> | undefined
    const wake = () => {
      if (heartbeatTimer) clearTimeout(heartbeatTimer)
      heartbeatTimer = undefined
      wakeListener?.()
    }
    const unsubscribe = subscribeToActivity((event) => {
      // Bound memory for slow event-stream consumers.
      if (pendingEvents.length >= 40) pendingEvents.shift()
      pendingEvents.push(event)
      wake()
    })

    stream.onAbort(() => {
      unsubscribe()
      wake()
    })

    try {
      await stream.writeSSE({
        event: 'snapshot',
        data: JSON.stringify(getRecentActivity()),
      })

      while (!stream.aborted) {
        if (pendingEvents.length === 0) {
          await new Promise<void>((resolve) => {
            wakeListener = resolve
            heartbeatTimer = setTimeout(resolve, 15_000)
          })
          wakeListener = undefined
          if (heartbeatTimer) clearTimeout(heartbeatTimer)
          heartbeatTimer = undefined
        }

        const event = pendingEvents.shift()
        if (event) {
          await stream.writeSSE({
            event: 'activity',
            id: event.id,
            data: JSON.stringify(event),
          })
        } else if (!stream.aborted) {
          await stream.write(': keep-alive\n\n')
        }
      }
    } finally {
      unsubscribe()
      if (heartbeatTimer) clearTimeout(heartbeatTimer)
    }
  })
)

app.use('/trpc/*', corsMiddleware)

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext,
  })
)

app.get('/', (c) => {
  return c.json({
    name: 'CodeArena API',
    status: 'running',
  })
})

const port = Number(process.env.PORT) || 3001

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`CodeArena API is running at http://localhost:${info.port}`)
  }
)

export default app
