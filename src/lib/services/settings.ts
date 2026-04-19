import { eq } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { payments, properties, settings, tenants, units, users } from '$lib/db/schema'
import { withRetry } from '$lib/db/retry'

type SettingsRow = typeof settings.$inferSelect

type BusinessSettingsInput = {
  businessName: string
  appUrl: string | null
  name: string
  email: string
}

type PaymentSettingsInput = {
  collectionType: 'paybill' | 'till'
  paybillNumber: string | null
  tillNumber: string | null
  paybillName: string | null
  tillName: string | null
  accountNumber: string | null
}

type NotificationSettingsInput = {
  enableRentReminders: boolean
  reminderDaysBefore: number
  remindOnDueDay: boolean
  enableOverdueReminders: boolean
  overdueReminderFrequency: number
  overdueMaxReminders: number
  notifyPaymentConfirmed: boolean
  notifyPaymentRejected: boolean
  notifyTicketStatus: boolean
  notifyTicketAssigned: boolean
}

/**
 * Creates default settings for a landlord account.
 */
export async function createDefaultSettings(userId: string, businessName?: string | null): Promise<void> {
  await withRetry(() =>
    db
      .insert(settings)
      .values({
        userId,
        businessName: businessName ?? null,
        collectionType: 'paybill',
        paybillNumber: null,
        tillNumber: null,
        paybillName: null,
        tillName: null,
        collectionAccount: null,
        accountName: null,
        accountNumber: null,
        referenceRule: null,
        defaultDueDay: 1,
        reminderDaysBefore: 3,
        enableRentReminders: true,
        remindOnDueDay: true,
        enableOverdueReminders: true,
        overdueReminderFrequency: 7,
        overdueMaxReminders: 3,
        notifyPaymentConfirmed: true,
        notifyPaymentRejected: true,
        notifyTicketStatus: true,
        notifyTicketAssigned: true,
      })
      .onConflictDoNothing({ target: settings.userId }),
  )
}

/**
 * Creates default settings and returns them.
 */
export async function getDefaultSettings(userId: string): Promise<SettingsRow> {
  await createDefaultSettings(userId, null)

  const [row] = await withRetry(() =>
    db
      .select()
      .from(settings)
      .where(eq(settings.userId, userId))
      .limit(1),
  )

  if (!row) {
    throw new Error('Unable to initialize settings')
  }

  return row
}

/**
 * Returns one user's settings row. Creates defaults if missing.
 */
export async function getSettings(userId: string): Promise<SettingsRow> {
  const [row] = await withRetry(() =>
    db
      .select()
      .from(settings)
      .where(eq(settings.userId, userId))
      .limit(1),
  )

  if (row) return row
  return getDefaultSettings(userId)
}

/**
 * Updates business settings and profile info.
 */
export async function updateBusinessSettings(userId: string, data: BusinessSettingsInput): Promise<void> {
  await withRetry(() =>
    db
      .update(users)
      .set({
        name: data.name,
        email: data.email,
        businessName: data.businessName,
      })
      .where(eq(users.id, userId)),
  )

  await withRetry(() =>
    db
      .update(settings)
      .set({
        businessName: data.businessName,
        appUrl: data.appUrl,
        updatedAt: new Date(),
      })
      .where(eq(settings.userId, userId)),
  )
}

/**
 * Updates payment collection settings.
 */
export async function updatePaymentSettings(userId: string, data: PaymentSettingsInput): Promise<void> {
  const legacyCollectionAccount =
    data.collectionType === 'paybill' ? data.paybillNumber : data.tillNumber
  const legacyAccountName =
    data.collectionType === 'paybill' ? data.paybillName : data.tillName

  await withRetry(() =>
    db
      .update(settings)
      .set({
        collectionType: data.collectionType,
        paybillNumber: data.paybillNumber,
        tillNumber: data.tillNumber,
        paybillName: data.paybillName,
        tillName: data.tillName,
        // Keep legacy fields synced for backward compatibility.
        collectionAccount: legacyCollectionAccount,
        accountName: legacyAccountName,
        accountNumber: data.accountNumber,
        updatedAt: new Date(),
      })
      .where(eq(settings.userId, userId)),
  )
}

/**
 * Updates notification preferences.
 */
export async function updateNotificationSettings(userId: string, data: NotificationSettingsInput): Promise<void> {
  await withRetry(() =>
    db
      .update(settings)
      .set({
        enableRentReminders: data.enableRentReminders,
        reminderDaysBefore: data.reminderDaysBefore,
        remindOnDueDay: data.remindOnDueDay,
        enableOverdueReminders: data.enableOverdueReminders,
        overdueReminderFrequency: data.overdueReminderFrequency,
        overdueMaxReminders: data.overdueMaxReminders,
        notifyPaymentConfirmed: data.notifyPaymentConfirmed,
        notifyPaymentRejected: data.notifyPaymentRejected,
        notifyTicketStatus: data.notifyTicketStatus,
        notifyTicketAssigned: data.notifyTicketAssigned,
        updatedAt: new Date(),
      })
      .where(eq(settings.userId, userId)),
  )
}

/**
 * Returns account export data scoped to a landlord.
 */
export async function getAccountExportData(userId: string): Promise<{
  properties: Array<{ name: string; location: string | null; totalUnits: number }>
  units: Array<{ unitNumber: string; propertyName: string; status: string; monthlyRent: number }>
  tenants: Array<{
    fullName: string
    phoneNumber: string
    propertyName: string
    unitNumber: string | null
    status: string
  }>
  payments: Array<{
    tenantName: string
    unitNumber: string
    amountExpected: number
    amountReceived: number | null
    status: string
    submittedAt: Date | null
  }>
}> {
  const propertyRows = await withRetry(() =>
    db
      .select({
        id: properties.id,
        name: properties.name,
        location: properties.location,
        totalUnits: properties.totalUnits,
      })
      .from(properties)
      .where(eq(properties.ownerId, userId)),
  )

  const propertyIds = propertyRows.map((row) => row.id)
  if (propertyIds.length === 0) {
    return {
      properties: [],
      units: [],
      tenants: [],
      payments: [],
    }
  }

  const [unitRows, tenantRows, paymentRows] = await Promise.all([
    withRetry(() =>
      db
        .select({
          unitNumber: units.unitNumber,
          propertyName: properties.name,
          status: units.status,
          monthlyRent: units.monthlyRent,
        })
        .from(units)
        .innerJoin(properties, eq(units.propertyId, properties.id))
        .where(eq(properties.ownerId, userId)),
    ),
    withRetry(() =>
      db
        .select({
          fullName: tenants.fullName,
          phoneNumber: tenants.phoneNumber,
          propertyName: properties.name,
          unitNumber: units.unitNumber,
          status: tenants.status,
        })
        .from(tenants)
        .innerJoin(properties, eq(tenants.propertyId, properties.id))
        .leftJoin(units, eq(tenants.unitId, units.id))
        .where(eq(properties.ownerId, userId)),
    ),
    withRetry(() =>
      db
        .select({
          tenantName: tenants.fullName,
          unitNumber: units.unitNumber,
          amountExpected: payments.amountExpected,
          amountReceived: payments.amountReceived,
          status: payments.status,
          submittedAt: payments.submittedAt,
        })
        .from(payments)
        .innerJoin(units, eq(payments.unitId, units.id))
        .innerJoin(properties, eq(units.propertyId, properties.id))
        .innerJoin(tenants, eq(payments.tenantId, tenants.id))
        .where(eq(properties.ownerId, userId)),
    ),
  ])

  return {
    properties: propertyRows.map((row) => ({
      name: row.name,
      location: row.location,
      totalUnits: row.totalUnits,
    })),
    units: unitRows.map((row) => ({
      unitNumber: row.unitNumber,
      propertyName: row.propertyName,
      status: row.status,
      monthlyRent: Number(row.monthlyRent),
    })),
    tenants: tenantRows.map((row) => ({
      fullName: row.fullName,
      phoneNumber: row.phoneNumber,
      propertyName: row.propertyName,
      unitNumber: row.unitNumber,
      status: row.status,
    })),
    payments: paymentRows.map((row) => ({
      tenantName: row.tenantName,
      unitNumber: row.unitNumber,
      amountExpected: Number(row.amountExpected),
      amountReceived: row.amountReceived === null ? null : Number(row.amountReceived),
      status: row.status,
      submittedAt: row.submittedAt,
    })),
  }
}
