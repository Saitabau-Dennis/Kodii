import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import {
  clearPostRegisterCookie,
  createSession,
  generateOTP,
  getPostRegisterCookie,
  getSession,
  maskPhone,
  normalizePhone,
  setTempCookie,
  verifyPassword,
} from '$lib/server/auth'
import { sendOTP } from '$lib/server/notifications'
import { createOTP, invalidateOTPs } from '$lib/services/otp'
import { getUserByIdentifier, updateLastLoginAt } from '$lib/services/users'

export const load: PageServerLoad = async (event) => {
  const session = await getSession(event)
  if (session) {
    throw redirect(302, '/dashboard')
  }

  return {}
}

export const actions: Actions = {
  signInEmail: async (event) => {
    const formData = await event.request.formData()
    const identifierInput = formData.get('phone')?.toString().trim() ?? ''
    const password = formData.get('password')?.toString() ?? ''

    if (!identifierInput || !password) {
      return fail(400, { message: 'Please fill in all required fields' })
    }

    let identifier = identifierInput
    if (!identifierInput.includes('@')) {
      try {
        identifier = normalizePhone(identifierInput)
      } catch {
        return fail(400, { message: 'Please enter a valid phone number or email' })
      }
    }

    const user = await getUserByIdentifier(identifier)

    if (!user) {
      return fail(400, { message: 'No account found with those details' })
    }

    const isPasswordValid = await verifyPassword(password, user.passwordHash)
    if (!isPasswordValid) {
      return fail(400, { message: 'Incorrect password' })
    }

    if (user.inviteStatus === 'deactivated') {
      await invalidateOTPs(user.id)

      const reactivationOtp = generateOTP()
      const reactivationExpiresAt = new Date(Date.now() + 10 * 60 * 1000)
      await createOTP(user.id, reactivationOtp, reactivationExpiresAt)

      try {
        await sendOTP(user.phone, reactivationOtp)
      } catch {
        return fail(500, { message: 'Unable to send PIN right now. Please try again.' })
      }

      await setTempCookie(event, {
        userId: user.id,
        maskedPhone: maskPhone(user.phone),
        flow: 'reactivate',
      })

      throw redirect(
        302,
        `/verify?success=${encodeURIComponent('Account reactivation PIN sent. Verify to reactivate your account.')}`,
      )
    }

    const postRegister = await getPostRegisterCookie(event)
    if (postRegister?.userId === user.id) {
      clearPostRegisterCookie(event)

      await updateLastLoginAt(user.id)
      await createSession(event, {
        userId: user.id,
        role: user.role,
        name: user.name,
        email: user.email,
        phone: user.phone,
      })

      throw redirect(302, `/dashboard?success=${encodeURIComponent('Login successful. Welcome.')}`)
    }

    if (!user.phoneVerified) {
      await invalidateOTPs(user.id)

      const unverifiedOtp = generateOTP()
      const unverifiedExpiresAt = new Date(Date.now() + 10 * 60 * 1000)
      await createOTP(user.id, unverifiedOtp, unverifiedExpiresAt)

      try {
        await sendOTP(user.phone, unverifiedOtp)
      } catch {
        return fail(500, { message: 'Unable to send PIN right now. Please try again.' })
      }

      await setTempCookie(event, {
        userId: user.id,
        maskedPhone: maskPhone(user.phone),
        flow: 'login_unverified',
      })

      throw redirect(
        302,
        `/verify?success=${encodeURIComponent('Please verify your phone number to continue.')}`,
      )
    }

    await invalidateOTPs(user.id)

    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    await createOTP(user.id, otp, expiresAt)

    try {
      await sendOTP(user.phone, otp)
    } catch {
      return fail(500, { message: 'Unable to send PIN right now. Please try again.' })
    }

    await setTempCookie(event, {
      userId: user.id,
      maskedPhone: maskPhone(user.phone),
      flow: 'login',
    })

    throw redirect(302, `/verify?success=${encodeURIComponent('PIN sent successfully. Check your phone.')}`)
  },
}
