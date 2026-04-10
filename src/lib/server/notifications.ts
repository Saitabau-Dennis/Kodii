import { sendSMS } from '$lib/server/sms'

/**
 * Sends a one-time PIN to a user's phone.
 */
export async function sendOTP(phone: string, otp: string): Promise<void> {
  const message = `Your KODII verification PIN is ${otp}. It expires in 10 minutes.`
  await sendSMS({ to: phone, message })
}

/**
 * Sends a caretaker invitation SMS.
 */
export async function sendCaretakerInvite(phone: string, inviteMessage: string): Promise<void> {
  await sendSMS({ to: phone, message: inviteMessage })
}
