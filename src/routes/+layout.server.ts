import type { LayoutServerLoad } from './$types'
import { getSession } from '$lib/server/auth'

export const load: LayoutServerLoad = async (event) => {
  const user = await getSession(event)
  return { user }
}
