import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'
import { clearSession, clearTempCookie } from '$lib/server/auth'

export const load: PageServerLoad = async (event) => {
  clearSession(event)
  clearTempCookie(event)
  throw redirect(302, '/login')
}
