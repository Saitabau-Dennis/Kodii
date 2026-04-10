import { and, eq, or } from 'drizzle-orm'
import { db } from '$lib/server/db'
import { users } from '$lib/db/schema'
import { normalizePhone } from '$lib/server/auth'

export type UserRecord = typeof users.$inferSelect
export type NewUserRecord = typeof users.$inferInsert

/**
 * Finds a user by normalized E.164 phone number.
 */
export async function getUserByPhone(phone: string): Promise<UserRecord | undefined> {
  const normalized = normalizePhone(phone)
  const [user] = await db.select().from(users).where(eq(users.phone, normalized)).limit(1)
  return user
}

/**
 * Finds a user by email address.
 */
export async function getUserByEmail(email: string): Promise<UserRecord | undefined> {
  const normalizedEmail = email.trim().toLowerCase()
  const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1)
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
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
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
  const [created] = await db
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
    .returning()

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
  const [created] = await db
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
    .returning()

  return created
}

/**
 * Updates a user's password hash.
 */
export async function updatePassword(userId: string, passwordHash: string): Promise<void> {
  await db.update(users).set({ passwordHash }).where(eq(users.id, userId))
}

/**
 * Marks a user's phone number as verified.
 */
export async function markPhoneVerified(userId: string): Promise<void> {
  await db.update(users).set({ phoneVerified: true }).where(eq(users.id, userId))
}

/**
 * Marks a caretaker invite as accepted.
 */
export async function acceptInvite(userId: string): Promise<void> {
  await db
    .update(users)
    .set({ inviteStatus: 'accepted' })
    .where(and(eq(users.id, userId), eq(users.role, 'caretaker')))
}

/**
 * Finds a user by either email or phone in one DB query.
 */
export async function getUserByEmailOrPhone(email: string, phone: string): Promise<UserRecord | undefined> {
  const normalizedEmail = email.trim().toLowerCase()
  const normalizedPhone = normalizePhone(phone)

  const [user] = await db
    .select()
    .from(users)
    .where(or(eq(users.email, normalizedEmail), eq(users.phone, normalizedPhone)))
    .limit(1)

  return user
}
