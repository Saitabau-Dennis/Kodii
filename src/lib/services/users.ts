import { and, eq, inArray, or, sql } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { caretakerProperties, properties, users } from '$lib/db/schema'
import { withRetry } from '$lib/db/retry'
import { normalizePhone } from '$lib/server/auth'

export type UserRecord = typeof users.$inferSelect
export type NewUserRecord = typeof users.$inferInsert
export type AssignedProperty = Pick<typeof properties.$inferSelect, 'id' | 'name' | 'location'>
export type CaretakerWithProperties = Pick<
  UserRecord,
  'id' | 'name' | 'phone' | 'inviteStatus' | 'createdAt'
> & {
  properties: AssignedProperty[]
}

/**
 * Finds a user by normalized E.164 phone number.
 */
export async function getUserByPhone(phone: string): Promise<UserRecord | undefined> {
  const normalized = normalizePhone(phone)
  const [user] = await withRetry(() =>
    db.select().from(users).where(eq(users.phone, normalized)).limit(1),
  )
  return user
}

/**
 * Finds a user by email address.
 */
export async function getUserByEmail(email: string): Promise<UserRecord | undefined> {
  const normalizedEmail = email.trim().toLowerCase()
  const [user] = await withRetry(() =>
    db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1),
  )
  return user
}

/**
 * Finds a user by identifier (email or phone).
 */
export async function getUserByIdentifier(identifier: string): Promise<UserRecord | undefined> {
  const raw = identifier.trim()

  if (raw.includes('@')) {
    return getUserByEmail(raw)
  }

  return getUserByPhone(raw)
}

/**
 * Finds a user by user ID.
 */
export async function getUserById(userId: string): Promise<UserRecord | undefined> {
  const [user] = await withRetry(() => db.select().from(users).where(eq(users.id, userId)).limit(1))
  return user
}

/**
 * Creates a landlord account.
 */
export async function createLandlord(input: {
  name: string
  phone: string
  email: string
  passwordHash: string
  businessName?: string | null
}): Promise<UserRecord> {
  const [created] = await withRetry(() =>
    db
      .insert(users)
      .values({
        name: input.name,
        phone: normalizePhone(input.phone),
        email: input.email.trim().toLowerCase(),
        passwordHash: input.passwordHash,
        role: 'landlord',
        businessName: input.businessName ?? null,
        inviteStatus: null,
        phoneVerified: false,
      })
      .returning(),
  )

  return created
}

/**
 * Creates a caretaker account.
 */
export async function createCaretaker(input: {
  name: string
  phone: string
  email: string
  invitedBy: string
  passwordHash?: string
  businessName?: string | null
}): Promise<UserRecord> {
  const [created] = await withRetry(() =>
    db
      .insert(users)
      .values({
        name: input.name,
        phone: normalizePhone(input.phone),
        email: input.email.trim().toLowerCase(),
        passwordHash: input.passwordHash ?? 'PENDING_SETUP',
        role: 'caretaker',
        invitedBy: input.invitedBy,
        inviteStatus: 'pending',
        businessName: input.businessName ?? null,
        phoneVerified: false,
      })
      .returning(),
  )

  return created
}

/**
 * Updates a user's password hash.
 */
export async function updatePassword(userId: string, passwordHash: string): Promise<void> {
  await withRetry(() => db.update(users).set({ passwordHash }).where(eq(users.id, userId)))
}

/**
 * Updates mutable profile fields.
 */
export async function updateUserInfo(
  userId: string,
  data: { name: string; email: string; businessName?: string | null },
): Promise<void> {
  await withRetry(() =>
    db
      .update(users)
      .set({
        name: data.name,
        email: data.email,
        businessName: data.businessName ?? undefined,
      })
      .where(eq(users.id, userId)),
  )
}

/**
 * Marks a user's phone number as verified.
 */
export async function markPhoneVerified(userId: string): Promise<void> {
  await withRetry(() => db.update(users).set({ phoneVerified: true }).where(eq(users.id, userId)))
}

/**
 * Updates a user's last successful login timestamp.
 */
export async function updateLastLoginAt(userId: string, at: Date = new Date()): Promise<void> {
  await withRetry(() => db.update(users).set({ lastLoginAt: at }).where(eq(users.id, userId)))
}

/**
 * Marks a caretaker invite as accepted.
 */
export async function acceptInvite(userId: string): Promise<void> {
  await withRetry(() =>
    db
      .update(users)
      .set({ inviteStatus: 'accepted' })
      .where(and(eq(users.id, userId), eq(users.role, 'caretaker'))),
  )
}

/**
 * Finds a user by either email or phone in one DB query.
 */
export async function getUserByEmailOrPhone(email: string, phone: string): Promise<UserRecord | undefined> {
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedPhone = normalizePhone(phone)

  const [user] = await withRetry(() =>
    db
      .select()
      .from(users)
      .where(or(eq(users.email, normalizedEmail), eq(users.phone, normalizedPhone)))
      .limit(1),
  )

  return user
}

/**
 * Returns paginated caretakers invited by a landlord and their assigned properties.
 */
export async function getCaretakersByLandlord(
  landlordId: string,
  page: number,
  limit: number,
): Promise<{
  caretakers: CaretakerWithProperties[]
  totalCount: number
}> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10
  const offset = (safePage - 1) * safeLimit

  const [countRow] = await withRetry(() =>
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, 'caretaker'), eq(users.invitedBy, landlordId))),
  )

  const totalCount = countRow?.count ?? 0

  const caretakerRows = await withRetry(() =>
    db
      .select({
        id: users.id,
        name: users.name,
        phone: users.phone,
        inviteStatus: users.inviteStatus,
        createdAt: users.createdAt,
      })
      .from(users)
      .where(and(eq(users.role, 'caretaker'), eq(users.invitedBy, landlordId)))
      .orderBy(sql`${users.createdAt} desc`)
      .limit(safeLimit)
      .offset(offset),
  )

  if (caretakerRows.length === 0) {
    return { caretakers: [], totalCount }
  }

  const caretakerIds = caretakerRows.map((row) => row.id)

  const assignmentRows = await withRetry(() =>
    db
      .select({
        caretakerId: caretakerProperties.caretakerId,
        id: properties.id,
        name: properties.name,
        location: properties.location,
      })
      .from(caretakerProperties)
      .innerJoin(properties, eq(caretakerProperties.propertyId, properties.id))
      .where(
        and(
          inArray(caretakerProperties.caretakerId, caretakerIds),
          eq(properties.ownerId, landlordId),
        ),
      ),
  )

  const propertyMap = new Map<string, AssignedProperty[]>()
  for (const row of assignmentRows) {
    const existing = propertyMap.get(row.caretakerId) ?? []
    existing.push({
      id: row.id,
      name: row.name,
      location: row.location,
    })
    propertyMap.set(row.caretakerId, existing)
  }

  const caretakers: CaretakerWithProperties[] = caretakerRows.map((row) => ({
    ...row,
    properties: propertyMap.get(row.id) ?? [],
  }))

  return { caretakers, totalCount }
}
