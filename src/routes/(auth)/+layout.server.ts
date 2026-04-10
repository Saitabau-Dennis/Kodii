import { redirect } from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'
import { getSession } from '$lib/server/auth'

export const load: LayoutServerLoad = async (event) => {
  const user = await getSession(event)
  const path = event.url.pathname

  if (user && (path === '/login' || path === '/register')) {
    throw redirect(302, '/session-check')
  }

  return { user }
}
