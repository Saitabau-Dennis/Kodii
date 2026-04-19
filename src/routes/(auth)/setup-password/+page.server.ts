import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { hashPassword, requireAuth, validatePasswordStrength } from '$lib/server/auth'
import { acceptInvite, getUserById, updatePassword } from '$lib/services/users'

export const load: PageServerLoad = async (event) => {
  const session = await requireAuth(event)

  const user = await getUserById(session.userId)
  if (!user) {
    throw redirect(302, '/login')
  }

  if (user.role !== 'caretaker') {
    throw redirect(302, '/dashboard')
  }

  if (user.inviteStatus !== 'pending') {
    throw redirect(302, '/dashboard')
  }

  return {}
}

export const actions: Actions = {
  default: async (event) => {
    const session = await requireAuth(event)

    const user = await getUserById(session.userId)
    if (!user) {
      throw redirect(302, '/login')
    }

    if (user.role !== 'caretaker' || user.inviteStatus !== 'pending') {
      throw redirect(302, '/dashboard')
    }

    const formData = await event.request.formData()
    const password = formData.get('password')?.toString() ?? ''
    const confirmPassword = formData.get('confirmPassword')?.toString() ?? ''

    if (!password || !confirmPassword) {
      return fail(400, { message: 'Please fill in all required fields' })
    }

    if (password !== confirmPassword) {
      return fail(400, { message: 'Passwords do not match' })
    }

    const strength = validatePasswordStrength(password)
    if (!strength.valid) {
      return fail(400, { message: strength.message ?? 'Password is not strong enough' })
    }

    const passwordHash = await hashPassword(password)
    await updatePassword(user.id, passwordHash)
    await acceptInvite(user.id)

    throw redirect(302, '/dashboard?success=' + encodeURIComponent('Password set successfully. Welcome.'))
  },
}
