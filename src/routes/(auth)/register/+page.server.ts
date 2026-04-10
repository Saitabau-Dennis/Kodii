import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import {
  generateOTP,
  getSession,
  hashPassword,
  maskPhone,
  normalizePhone,
  setTempCookie,
  validatePasswordStrength,
} from '$lib/server/auth'
import { sendOTP } from '$lib/server/notifications'
import { createOTP, invalidateOTPs } from '$lib/services/otp'
import { createDefaultSettings } from '$lib/services/settings'
import { createLandlord, getUserByEmail, getUserByPhone } from '$lib/services/users'

export const load: PageServerLoad = async (event) => {
  const session = await getSession(event)
  if (session) {
    throw redirect(302, '/dashboard')
  }

  return {}
}

export const actions: Actions = {
  signUpEmail: async (event) => {
    const formData = await event.request.formData()

    const name = formData.get('name')?.toString().trim() ?? ''
    const phoneInput = formData.get('phone')?.toString().trim() ?? ''
    const email = formData.get('email')?.toString().trim().toLowerCase() ?? ''
    const password = formData.get('password')?.toString() ?? ''
    const confirmPassword = formData.get('confirmPassword')?.toString() ?? ''

    if (name.length < 2) {
      return fail(400, { message: 'Please enter a valid full name' })
    }

    let phone: string
    try {
      phone = normalizePhone(phoneInput)
    } catch {
      return fail(400, { message: 'Please enter a valid Kenyan phone number' })
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return fail(400, { message: 'Please enter a valid email address' })
    }

    const passwordValidation = validatePasswordStrength(password)
    if (!passwordValidation.valid) {
      return fail(400, { message: passwordValidation.message ?? 'Password is too weak' })
    }

    if (confirmPassword && confirmPassword !== password) {
      return fail(400, { message: 'Passwords do not match' })
    }

    const existingByPhone = await getUserByPhone(phone)
    if (existingByPhone) {
      return fail(400, { message: 'A user with that phone number already exists' })
    }

    const existingByEmail = await getUserByEmail(email)
    if (existingByEmail) {
      return fail(400, { message: 'A user with that email address already exists' })
    }

    const passwordHash = await hashPassword(password)
    const user = await createLandlord({
      name,
      phone,
      email,
      passwordHash,
    })

    await createDefaultSettings(user.id, user.businessName)
    await invalidateOTPs(user.id)

    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000)
    await createOTP(user.id, otp, expiresAt)

    try {
      await sendOTP(phone, otp)
    } catch {
      return fail(500, { message: 'Unable to send PIN right now. Please try again.' })
    }

    await setTempCookie(event, {
      userId: user.id,
      maskedPhone: maskPhone(phone),
      flow: 'register',
    })

    throw redirect(302, `/verify?success=${encodeURIComponent('Account created. Enter the PIN we sent to your phone.')}`)
  },
}
