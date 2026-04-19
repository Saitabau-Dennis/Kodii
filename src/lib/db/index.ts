import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import * as schema from './schema'
import { DATABASE_URL } from '$env/static/private'

const sql = neon(DATABASE_URL, {
  fetchOptions: {
    cache: 'no-store',
  },
})

export const db = drizzle(sql, { schema })
export { withRetry } from './retry'
export * from './schema'
