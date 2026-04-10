import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import {
  clearTempCookie,
  createSession,
  getTempCookie,
  generateOTP,
  setPostRegisterCookie,
} from '$lib/server/auth'
import { sendOTP } from '$lib/server/notifications'
import { createOTP, invalidateOTPs, verifyOTP } from '$lib/services/otp'
import { getUserById, markPhoneVerified } from '$lib/services/users'

export const load: PageServerLoad = async (event) => {
  const temp = await getTempCookie(event)

  if (!temp) {
    throw redirect(302, '/login')
  }

  return {
    maskedPhone: temp.maskedPhone,
  }
}

export const actions: Actions = {
  verify: async (event) => {
    const temp = await getTempCookie(event)
    if (!temp) {
      throw redirect(302, '/login')
    }

    const formData = await event.request.formData()
    const code = (formData.get('code')?.toString() ?? '').replace(/\D/g, '').slice(0, 6)

    if (code.length !== 6) {
      return fail(400, { message: 'Please enter a valid 6-digit PIN' })
    }

    const result = await verifyOTP(temp.userId, code)
    if (!result.ok) {
      if (result.reason === 'expired') {
        return fail(400, { message: 'PIN has expired. Request a new one.' })
      }

      return fail(400, { message: 'Invalid PIN. Please try again.' })
    }

    const user = await getUserById(temp.userId)
    if (!user) {
      clearTempCookie(event)
      return fail(400, { message: 'No account found with those details' })
    }

    if (temp.flow === 'register') {
      await markPhoneVerified(user.id)
      await setPostRegisterCookie(event, { userId: user.id })
      clearTempCookie(event)
      throw redirect(302, `/login?success=${encodeURIComponent('Phone verified. Please log in to continue.')}`)
    }

    if (temp.flow === 'login_unverified') {
      await markPhoneVerified(user.id)
    }

    await createSession(event, {
      userId: user.id,
      role: user.role,
      name: user.name,
      email: user.email,
      phone: user.phone,
    })

    clearTempCookie(event)

    if (user.role === 'caretaker' && user.inviteStatus === 'pending') {
      throw redirect(
        302,
        `/setup-password?success=${encodeURIComponent('PIN verified. Set your password to continue.')}`,
      )
    }

    if (temp.flow === 'login_unverified') {
      throw redirect(
        302,
        `/dashboard?success=${encodeURIComponent('Phone verified successfully. Welcome back.')}`,
      )
    }

    throw redirect(302, `/dashboard?success=${encodeURIComponent('PIN verified Welcome')}`)
  },

  resend: async (event) => {
    const temp = await getTempCookie(event)
    if (!temp) {
      throw redirect(302, '/login')
    }

    const user = await getUserById(temp.userId)
    if (!user) {
      clearTempCookie(event)
      throw redirect(302, '/login')
    }

    await invalidateOTPs(user.id)

    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    await createOTP(user.id, otp, expiresAt)

    try {
      await sendOTP(user.phone, otp)
    } catch {
      return fail(500, { message: 'Unable to resend PIN right now. Please try again.' })
    }

    return { resendSuccess: true }
  },
}
