import { and, desc, eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { otpCodes } from '$lib/db/schema'
import { withRetry } from '$lib/db/retry'

export type OTPRecord = typeof otpCodes.$inferSelect

export interface VerifyOTPResult {
  ok: boolean
  reason?: 'invalid' | 'expired'
  otp?: OTPRecord
}

/**
 * Creates and stores an OTP code for a user.
 */
export async function createOTP(userId: string, code: string, expiresAt: Date): Promise<OTPRecord> {
  const [created] = await withRetry(() =>
    db
      .insert(otpCodes)
      .values({
        userId,
        code,
        expiresAt,
        used: false,
      })
      .returning(),
  )

  return created
}

/**
 * Marks all OTP codes for a user as used.
 */
export async function invalidateOTPs(userId: string): Promise<void> {
  await withRetry(() =>
    db
      .update(otpCodes)
      .set({ used: true })
      .where(and(eq(otpCodes.userId, userId), eq(otpCodes.used, false))),
  )
}

/**
 * Returns the latest OTP entry for a user.
 */
export async function getLatestOTP(userId: string): Promise<OTPRecord | undefined> {
  const [otp] = await withRetry(() =>
    db
      .select()
      .from(otpCodes)
      .where(and(eq(otpCodes.userId, userId), eq(otpCodes.used, false)))
      .orderBy(desc(otpCodes.createdAt))
      .limit(1),
  )

  return otp
}

/**
 * Verifies the latest unexpired OTP for a user and marks it used when valid.
 */
export async function verifyOTP(userId: string, code: string): Promise<VerifyOTPResult> {
  const latest = await getLatestOTP(userId)

  if (!latest) {
    return { ok: false, reason: 'expired' }
  }

  if (latest.expiresAt.getTime() < Date.now()) {
    // Mark all active OTPs for this user as used to force a fresh resend flow.
    await invalidateOTPs(userId)
    return { ok: false, reason: 'expired' }
  }

  if (latest.code !== code) {
    return { ok: false, reason: 'invalid' }
  }

  // Consume active OTPs for this user after successful verification.
  await invalidateOTPs(userId)
  return { ok: true, otp: latest }
}
