import { serve } from '@hono/node-server'
import { trpcServer } from '@hono/trpc-server'
import { initTRPC } from '@trpc/server'
import { Hono } from 'hono'

import { problemRouter } from './routers/problem'
import { executionRouter } from './routers/execution'

const t = initTRPC.create()
export const router = t.router
export const publicProcedure = t.procedure

export const appRouter = router({
  health: publicProcedure.query(() => {
    return {
      status: 'ok',
      message: 'CodeArena API is running!',
    }
  }),
  problem: problemRouter,
  execution: executionRouter,
})

export type AppRouter = typeof appRouter

const app = new Hono()

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
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
