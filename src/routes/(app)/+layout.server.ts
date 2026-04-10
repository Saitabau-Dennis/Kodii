import { redirect } from '@sveltejs/kit'
import type { LayoutServerLoad } from './$types'
import { requireAuth } from '$lib/server/auth'
import { getUserById } from '$lib/services/users'

export const load: LayoutServerLoad = async (event) => {
  const session = await requireAuth(event)
  const user = await getUserById(session.userId)

  if (!user) {
    throw redirect(302, '/login')
  }

  if (user.role === 'caretaker' && user.inviteStatus === 'pending') {
    throw redirect(302, '/setup-password')
  }

  return { user: session }
}
