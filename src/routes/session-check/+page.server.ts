import type { PageServerLoad } from './$types'
import { getSession } from '$lib/server/auth'

export const load: PageServerLoad = async (event) => {
  const user = await getSession(event)
  return { user, hasSession: !!user }
}
