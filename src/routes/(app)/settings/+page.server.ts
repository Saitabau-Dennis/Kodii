import { env } from '$env/dynamic/private'
import { fail, redirect } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import type { RequestEvent } from '@sveltejs/kit'
import { clearSession, getSessionIssuedAt, hashPassword, maskPhone, requireAuth, verifyPassword } from '$lib/server/auth'
import { db } from '$lib/server/db'
import { activityLogs, settings, users } from '$lib/db/schema'
import { withRetry } from '$lib/db/retry'
import { getSettings, getAccountExportData, updateBusinessSettings, updateNotificationSettings, updatePaymentSettings } from '$lib/services/settings'
import { getUserById, updatePassword } from '$lib/services/users'
import { sendSMS } from '$lib/server/sms'
import { eq } from 'drizzle-orm'

const TABS = ['business', 'payments', 'notifications', 'security', 'account'] as const
type SettingsTab = (typeof TABS)[number]

function parseTab(value: string | null): SettingsTab {
  if (value && TABS.includes(value as SettingsTab)) return value as SettingsTab
  return 'business'
}

function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime()
  const mins = Math.floor(diffMs / 60000)
  const hours = Math.floor(diffMs / 3600000)
  const days = Math.floor(diffMs / 86400000)

  if (mins < 60) return `${Math.max(mins, 1)} minutes ago`
  if (hours < 24) return `${hours} hours ago`
  return `${days} days ago`
}

function maskIp(raw: string | null): string {
  if (!raw) return 'x.x.x.x'
  const ip = raw.split(',')[0]?.trim() ?? ''
  const ipv4 = ip.match(/^(\d+)\.(\d+)\.\d+\.\d+$/)
  if (ipv4) return `${ipv4[1]}.${ipv4[2]}.x.x`
  return 'x.x.x.x'
}

function boolFromForm(form: FormData, key: string): boolean {
  return form.get(key) !== null
}

async function ensureLandlord(event: RequestEvent) {
  const session = await requireAuth(event)
  if (session.role !== 'landlord') {
    throw redirect(302, '/dashboard')
  }
  return session
}

async function logSettingsActivity(actorId: string, action: string, metadata?: Record<string, unknown>) {
  await withRetry(() =>
    db.insert(activityLogs).values({
      actorId,
      action,
      entityType: 'settings',
      entityId: actorId,
      metadata: metadata ?? null,
    }),
  )
}

export const load: PageServerLoad = async (event) => {
  const session = await ensureLandlord(event)
  const user = await getUserById(session.userId)
  if (!user) throw redirect(302, '/login')

  const [settingsRow, exportData] = await Promise.all([getSettings(session.userId), getAccountExportData(session.userId)])
  const activeTab = parseTab(event.url.searchParams.get('tab'))
  const ipMasked = maskIp(event.request.headers.get('x-forwarded-for') ?? event.getClientAddress())
  const sessionIssuedAt = await getSessionIssuedAt(event)

  return {
    activeTab,
    senderId: env.TIARA_SENDER_ID || 'KODII',
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginLabel: user.lastLoginAt ? relativeTime(user.lastLoginAt) : 'Not recorded yet',
    },
    sessionInfo: {
      loggedInLabel: sessionIssuedAt ? relativeTime(sessionIssuedAt) : 'Just now',
      ipMasked,
    },
    settings: settingsRow,
    exportData,
  }
}

export const actions: Actions = {
  updateBusiness: async (event) => {
    const session = await ensureLandlord(event)
    const form = await event.request.formData()

    const businessName = form.get('businessName')?.toString().trim() ?? ''
    const name = form.get('name')?.toString().trim() ?? ''
    const email = form.get('email')?.toString().trim() ?? ''
    const appUrl = env.APP_URL || env.ORIGIN || event.url.origin

    const errors: Record<string, string> = {}
    if (!businessName) errors.businessName = 'Business name is required'
    if (!name) errors.name = 'Landlord name is required'
    if (!email) errors.email = 'Email is required'
    if (email && !/^\S+@\S+\.\S+$/.test(email)) errors.email = 'Enter a valid email address'

    if (Object.keys(errors).length > 0) {
      return fail(400, { message: 'Please fix the form errors', errors })
    }

    try {
      await updateBusinessSettings(session.userId, {
        businessName,
        name,
        email,
        appUrl,
      })
      await logSettingsActivity(session.userId, 'settings_updated', { section: 'business' })
      return { success: true }
    } catch {
      return fail(500, { message: 'Unable to update business information' })
    }
  },

  updatePayments: async (event) => {
    const session = await ensureLandlord(event)
    const form = await event.request.formData()

    const collectionType = form.get('collectionType')?.toString().trim() as 'paybill' | 'till' | ''
    const paybillNumber = form.get('paybillNumber')?.toString().trim() ?? ''
    const tillNumber = form.get('tillNumber')?.toString().trim() ?? ''
    const paybillName = form.get('paybillName')?.toString().trim() ?? ''
    const tillName = form.get('tillName')?.toString().trim() ?? ''
    const accountNumber = form.get('accountNumber')?.toString().trim() ?? ''

    const errors: Record<string, string> = {}
    if (collectionType !== 'paybill' && collectionType !== 'till') errors.collectionType = 'Select collection type'
    if (collectionType === 'paybill' && !paybillNumber) errors.collectionAccount = 'Paybill number is required'
    if (collectionType === 'till' && !tillNumber) errors.collectionAccount = 'Till number is required'
    if (collectionType === 'paybill' && !paybillName) errors.accountName = 'Paybill name is required'
    if (collectionType === 'till' && !tillName) errors.accountName = 'Till name is required'
    if (collectionType === 'paybill' && !accountNumber) errors.accountNumber = 'Account number is required'

    if (Object.keys(errors).length > 0) {
      return fail(400, { message: 'Please fix the form errors', errors })
    }

    try {
      await updatePaymentSettings(session.userId, {
        collectionType: collectionType as 'paybill' | 'till',
        paybillNumber: paybillNumber || null,
        tillNumber: tillNumber || null,
        paybillName: paybillName || null,
        tillName: tillName || null,
        accountNumber: accountNumber || null,
      })
      await logSettingsActivity(session.userId, 'settings_updated', { section: 'payments' })
      return { success: true }
    } catch {
      return fail(500, { message: 'Unable to update payment settings' })
    }
  },

  sendTestSMS: async (event) => {
    const session = await ensureLandlord(event)
    const [user, settingsRow] = await Promise.all([
      getUserById(session.userId),
      getSettings(session.userId),
    ])
    if (!user) return fail(404, { message: 'User not found' })

    const target = settingsRow.collectionType === 'till' ? 'Till' : 'Paybill'
    const number = settingsRow.collectionType === 'till'
      ? (settingsRow.tillNumber ?? settingsRow.collectionAccount ?? '-')
      : (settingsRow.paybillNumber ?? settingsRow.collectionAccount ?? '-')
    const accountNumber = settingsRow.accountNumber ?? settingsRow.referenceRule ?? '-'
    const sender = env.TIARA_SENDER_ID || 'KODII'
    const message =
      `Your KODII SMS test message confirms your payment settings are configured correctly. ` +
      (settingsRow.collectionType === 'paybill'
        ? `Tenants should pay to ${target} ${number} using account number ${accountNumber}, then send: PAY [unit] [amount] [code] to ${sender} for confirmation.`
        : `Tenants should pay to ${target} ${number}, then send: PAY [unit] [amount] [code] to ${sender} for confirmation.`)

    try {
      await sendSMS({ to: user.phone, message })
      return { success: true, maskedPhone: maskPhone(user.phone) }
    } catch {
      return fail(500, { message: 'Failed to send test SMS' })
    }
  },

  updateNotifications: async (event) => {
    const session = await ensureLandlord(event)
    const form = await event.request.formData()

    const reminderDaysBefore = Number(form.get('reminderDaysBefore')?.toString() ?? '3')
    const overdueReminderFrequency = Number(form.get('overdueReminderFrequency')?.toString() ?? '7')
    const overdueMaxReminders = Number(form.get('overdueMaxReminders')?.toString() ?? '3')

    const errors: Record<string, string> = {}
    if (!Number.isFinite(reminderDaysBefore) || reminderDaysBefore < 1 || reminderDaysBefore > 14) {
      errors.reminderDaysBefore = 'Enter a value between 1 and 14'
    }
    if (!Number.isFinite(overdueReminderFrequency) || overdueReminderFrequency < 1 || overdueReminderFrequency > 30) {
      errors.overdueReminderFrequency = 'Enter a value between 1 and 30'
    }
    if (!Number.isFinite(overdueMaxReminders) || overdueMaxReminders < 1 || overdueMaxReminders > 10) {
      errors.overdueMaxReminders = 'Enter a value between 1 and 10'
    }

    if (Object.keys(errors).length > 0) {
      return fail(400, { message: 'Please fix the form errors', errors })
    }

    try {
      await updateNotificationSettings(session.userId, {
        enableRentReminders: boolFromForm(form, 'enableRentReminders'),
        reminderDaysBefore,
        remindOnDueDay: boolFromForm(form, 'remindOnDueDay'),
        enableOverdueReminders: boolFromForm(form, 'enableOverdueReminders'),
        overdueReminderFrequency,
        overdueMaxReminders,
        notifyPaymentConfirmed: boolFromForm(form, 'notifyPaymentConfirmed'),
        notifyPaymentRejected: boolFromForm(form, 'notifyPaymentRejected'),
        notifyTicketStatus: boolFromForm(form, 'notifyTicketStatus'),
        notifyTicketAssigned: boolFromForm(form, 'notifyTicketAssigned'),
      })
      await logSettingsActivity(session.userId, 'settings_updated', { section: 'notifications' })
      return { success: true }
    } catch {
      return fail(500, { message: 'Unable to save notification settings' })
    }
  },

  changePassword: async (event) => {
    const session = await ensureLandlord(event)
    const form = await event.request.formData()

    const currentPassword = form.get('currentPassword')?.toString() ?? ''
    const newPassword = form.get('newPassword')?.toString() ?? ''
    const confirmPassword = form.get('confirmPassword')?.toString() ?? ''

    const errors: Record<string, string> = {}
    if (!currentPassword) errors.currentPassword = 'Current password is required'
    if (!newPassword) errors.newPassword = 'New password is required'
    if (!confirmPassword) errors.confirmPassword = 'Confirm your new password'
    if (newPassword && newPassword.length < 8) errors.newPassword = 'New password must be at least 8 characters'
    if (newPassword && confirmPassword && newPassword !== confirmPassword) {
      errors.confirmPassword = 'Passwords do not match'
    }

    if (Object.keys(errors).length > 0) {
      return fail(400, { message: 'Please fix the form errors', errors })
    }

    const user = await getUserById(session.userId)
    if (!user) return fail(404, { message: 'User not found' })

    const validCurrent = await verifyPassword(currentPassword, user.passwordHash)
    if (!validCurrent) {
      return fail(400, { message: 'Current password is incorrect', errors: { currentPassword: 'Current password is incorrect' } })
    }

    const passwordHash = await hashPassword(newPassword)
    await updatePassword(session.userId, passwordHash)
    await logSettingsActivity(session.userId, 'password_changed')
    return { success: true }
  },

  signOutAllSessions: async (event) => {
    const session = await ensureLandlord(event)
    await withRetry(() =>
      db
        .update(users)
        .set({ lastLoginAt: new Date() })
        .where(eq(users.id, session.userId)),
    )
    clearSession(event)
    throw redirect(302, `/login?success=${encodeURIComponent('Signed out successfully')}`)
  },

  deactivateAccount: async (event) => {
    const session = await ensureLandlord(event)

    await withRetry(() =>
      db
        .update(users)
        .set({ inviteStatus: 'deactivated' })
        .where(eq(users.id, session.userId)),
    )

    await withRetry(() =>
      db
        .update(settings)
        .set({ updatedAt: new Date() })
        .where(eq(settings.userId, session.userId)),
    )

    await logSettingsActivity(session.userId, 'account_deactivated')
    clearSession(event)
    throw redirect(
      302,
      `/login?success=${encodeURIComponent('Your account has been deactivated. Contact support to reactivate.')}`,
    )
  },
}
