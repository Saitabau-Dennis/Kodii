import type { Handle } from '@sveltejs/kit'
import { getSession } from '$lib/server/auth'

export const handle: Handle = async ({ event, resolve }) => {
  const session = await getSession(event)
  event.locals.session = session
  event.locals.user = session

  return resolve(event)
}
