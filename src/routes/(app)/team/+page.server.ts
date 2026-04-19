import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'
import { env } from '$env/dynamic/private'
import { and, eq, inArray } from 'drizzle-orm'
import { fail, redirect } from '@sveltejs/kit'
import type { RequestEvent } from '@sveltejs/kit'
import type { Actions, PageServerLoad } from './$types'
import { requireAuth, requireRole, normalizePhone, type SessionPayload } from '$lib/server/auth'
import { db } from '$lib/server/db'
import { withRetry } from '$lib/db/retry'
import { activityLogs, caretakerProperties, properties, users } from '$lib/db/schema'
import { getCaretakersByLandlord, getUserByPhone } from '$lib/services/users'
import { sendCaretakerInvite, sendCaretakerPropertyAssignment } from '$lib/server/notifications'

const PAGE_SIZE = 10

function generateTempPassword(length = 8): string {
  const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  return Array.from({ length }, () => charset[randomInt(0, charset.length)]).join('')
}

async function requireLandlordSession(event: RequestEvent): Promise<SessionPayload> {
  const session = await requireAuth(event)
  if (session.role !== 'landlord') {
    throw redirect(302, '/dashboard')
  }

  await requireRole(event, 'landlord')
  return session
}

function buildInviteMessage(input: {
  landlordName: string
  landlordPhone: string
  appUrl: string
  phone: string
  tempPassword: string
}) {
  return `You have been invited as a KODII caretaker by ${input.landlordName}. Please sign in at ${input.appUrl}/login using phone ${input.phone} and temporary password ${input.tempPassword}. For assistance, contact ${input.landlordPhone}.`
}

function buildPropertyAssignmentMessage(input: {
  caretakerName: string
  landlordName: string
  propertyNames: string[]
}) {
  const propertyList = input.propertyNames.join(', ')
  return `You have been assigned to the following properties by ${input.landlordName}: ${propertyList}. Please log in to KODII to manage them.`
}

export const load: PageServerLoad = async (event) => {
  const session = await requireLandlordSession(event)

  const parsedPage = Number(event.url.searchParams.get('page') ?? '1')
  const currentPage = Number.isFinite(parsedPage) && parsedPage > 0 ? Math.floor(parsedPage) : 1

  const [{ name: landlordName }] = await withRetry(() =>
    db
      .select({ name: users.name })
      .from(users)
      .where(eq(users.id, session.userId))
      .limit(1),
  )

  const { caretakers, totalCount } = await getCaretakersByLandlord(session.userId, currentPage, PAGE_SIZE)

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))

  const propertyRows = await withRetry(() =>
    db
      .select({
        id: properties.id,
        name: properties.name,
        location: properties.location,
      })
      .from(properties)
      .where(eq(properties.ownerId, session.userId)),
  )

  return {
    landlordName,
    caretakers,
    totalCount,
    currentPage,
    totalPages,
    properties: propertyRows,
  }
}

export const actions: Actions = {
  inviteCaretaker: async (event) => {
    const session = await requireLandlordSession(event)
    const formData = await event.request.formData()

    const name = formData.get('name')?.toString().trim() ?? ''
    const phoneInput = formData.get('phone')?.toString().trim() ?? ''

    if (!name || !phoneInput) {
      return fail(400, { message: 'Name and phone are required' })
    }

    let normalizedPhone = ''
    try {
      normalizedPhone = normalizePhone(phoneInput)
    } catch {
      return fail(400, { message: 'Please enter a valid Kenyan phone number' })
    }

    const existingUser = await getUserByPhone(normalizedPhone)
    if (existingUser) {
      return fail(400, { message: 'This phone number is already registered' })
    }

    const [{ name: landlordName, phone: landlordPhone }] = await withRetry(() =>
      db
        .select({ name: users.name, phone: users.phone })
        .from(users)
        .where(eq(users.id, session.userId))
        .limit(1),
    )

    const tempPassword = generateTempPassword(8)
    const passwordHash = await bcrypt.hash(tempPassword, 12)

    const emailLocal = normalizedPhone.replace(/\D/g, '')
    const generatedEmail = `caretaker-${emailLocal}-${Date.now()}@kodii.local`

    const [createdCaretaker] = await withRetry(() =>
      db
        .insert(users)
        .values({
          name,
          phone: normalizedPhone,
          email: generatedEmail,
          passwordHash,
          role: 'caretaker',
          invitedBy: session.userId,
          inviteStatus: 'pending',
          phoneVerified: false,
        })
        .returning({ id: users.id, name: users.name, phone: users.phone }),
    )

    const appUrl = env.APP_URL || env.ORIGIN || event.url.origin
    const message = buildInviteMessage({
      landlordName,
      landlordPhone,
      appUrl,
      phone: normalizedPhone,
      tempPassword,
    })

    try {
      await sendCaretakerInvite(normalizedPhone, message)
    } catch {
      await withRetry(() => db.delete(users).where(eq(users.id, createdCaretaker.id)))
      return fail(500, { message: 'Caretaker created but invite SMS failed. Please try again.' })
    }

    await withRetry(() =>
      db.insert(activityLogs).values({
        actorId: session.userId,
        action: 'invite_caretaker',
        entityType: 'user',
        entityId: createdCaretaker.id,
        metadata: {
          caretakerName: createdCaretaker.name,
          caretakerPhone: createdCaretaker.phone,
        },
      }),
    )

    return {
      message: 'Invite sent successfully',
      success: true,
    }
  },

  assignProperties: async (event) => {
    const session = await requireLandlordSession(event)
    const formData = await event.request.formData()

    const caretakerId = formData.get('caretakerId')?.toString().trim() ?? ''
    const propertyIds = formData
      .getAll('propertyIds')
      .map((value) => value.toString().trim())
      .filter((value) => value.length > 0)

    if (!caretakerId) {
      return fail(400, { message: 'Caretaker is required' })
    }

    const [caretaker] = await withRetry(() =>
      db
        .select({
          id: users.id,
          name: users.name,
          phone: users.phone,
          inviteStatus: users.inviteStatus,
        })
        .from(users)
        .where(
          and(
            eq(users.id, caretakerId),
            eq(users.role, 'caretaker'),
            eq(users.invitedBy, session.userId),
          ),
        )
        .limit(1),
    )

    if (!caretaker) {
      return fail(404, { message: 'Caretaker not found' })
    }

    if (caretaker.inviteStatus === 'deactivated') {
      return fail(400, { message: 'Cannot assign properties to a deactivated caretaker' })
    }

    await withRetry(() =>
      db.delete(caretakerProperties).where(eq(caretakerProperties.caretakerId, caretakerId)),
    )

    let validPropertyIds: string[] = []
    let validPropertyNames: string[] = []
    if (propertyIds.length > 0) {
      const ownedPropertyRows = await withRetry(() =>
        db
          .select({ id: properties.id, name: properties.name })
          .from(properties)
          .where(and(eq(properties.ownerId, session.userId), inArray(properties.id, propertyIds))),
      )

      validPropertyIds = ownedPropertyRows.map((row) => row.id)
      validPropertyNames = ownedPropertyRows.map((row) => row.name)

      if (validPropertyIds.length > 0) {
        await withRetry(() =>
          db.insert(caretakerProperties).values(
            validPropertyIds.map((propertyId) => ({
              caretakerId,
              propertyId,
              assignedBy: session.userId,
            })),
          ),
        )
      }
    }

    let smsWarning = ''
    if (validPropertyIds.length > 0) {
      const assignmentMessage = buildPropertyAssignmentMessage({
        caretakerName: caretaker.name,
        landlordName: session.name,
        propertyNames: validPropertyNames,
      })

      try {
        await sendCaretakerPropertyAssignment(caretaker.phone, assignmentMessage)
      } catch {
        smsWarning = ' Properties updated, but SMS notification could not be sent.'
      }
    }

    await withRetry(() =>
      db.insert(activityLogs).values({
        actorId: session.userId,
        action: 'assign_caretaker_properties',
        entityType: 'user',
        entityId: caretakerId,
        metadata: {
          caretakerName: caretaker.name,
          propertyIds: validPropertyIds,
        },
      }),
    )

    return {
      message: `Properties updated successfully.${smsWarning}`,
      success: true,
    }
  },

  deactivateCaretaker: async (event) => {
    const session = await requireLandlordSession(event)
    const formData = await event.request.formData()
    const caretakerId = formData.get('caretakerId')?.toString().trim() ?? ''

    if (!caretakerId) {
      return fail(400, { message: 'Caretaker is required' })
    }

    const [updatedCaretaker] = await withRetry(() =>
      db
        .update(users)
        .set({ inviteStatus: 'deactivated' })
        .where(
          and(
            eq(users.id, caretakerId),
            eq(users.role, 'caretaker'),
            eq(users.invitedBy, session.userId),
          ),
        )
        .returning({ id: users.id, name: users.name }),
    )

    if (!updatedCaretaker) {
      return fail(404, { message: 'Caretaker not found' })
    }

    await withRetry(() =>
      db.insert(activityLogs).values({
        actorId: session.userId,
        action: 'deactivate_caretaker',
        entityType: 'user',
        entityId: updatedCaretaker.id,
        metadata: {
          caretakerName: updatedCaretaker.name,
        },
      }),
    )

    return {
      message: 'Caretaker deactivated',
      success: true,
    }
  },

  reactivateCaretaker: async (event) => {
    const session = await requireLandlordSession(event)
    const formData = await event.request.formData()
    const caretakerId = formData.get('caretakerId')?.toString().trim() ?? ''

    if (!caretakerId) {
      return fail(400, { message: 'Caretaker is required' })
    }

    const [updatedCaretaker] = await withRetry(() =>
      db
        .update(users)
        .set({ inviteStatus: 'accepted' })
        .where(
          and(
            eq(users.id, caretakerId),
            eq(users.role, 'caretaker'),
            eq(users.invitedBy, session.userId),
            eq(users.inviteStatus, 'deactivated'),
          ),
        )
        .returning({ id: users.id, name: users.name }),
    )

    if (!updatedCaretaker) {
      return fail(404, { message: 'Caretaker not found' })
    }

    await withRetry(() =>
      db.insert(activityLogs).values({
        actorId: session.userId,
        action: 'reactivate_caretaker',
        entityType: 'user',
        entityId: updatedCaretaker.id,
        metadata: {
          caretakerName: updatedCaretaker.name,
        },
      }),
    )

    return {
      message: 'Caretaker reactivated',
      success: true,
    }
  },

  deleteCaretaker: async (event) => {
    const session = await requireLandlordSession(event)
    const formData = await event.request.formData()
    const caretakerId = formData.get('caretakerId')?.toString().trim() ?? ''

    if (!caretakerId) {
      return fail(400, { message: 'Caretaker is required' })
    }

    // Verify caretaker exists and belongs to this landlord
    const [caretaker] = await withRetry(() =>
      db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(
          and(
            eq(users.id, caretakerId),
            eq(users.role, 'caretaker'),
            eq(users.invitedBy, session.userId),
          ),
        )
        .limit(1),
    )

    if (!caretaker) {
      return fail(404, { message: 'Caretaker not found' })
    }

    // Hard delete the caretaker
    // caretakerProperties has onDelete: cascade, so it will be cleaned up
    await withRetry(() => db.delete(users).where(eq(users.id, caretakerId)))

    await withRetry(() =>
      db.insert(activityLogs).values({
        actorId: session.userId,
        action: 'delete_caretaker',
        entityType: 'user',
        entityId: caretakerId,
        metadata: {
          caretakerName: caretaker.name,
        },
      }),
    )

    return {
      message: 'Caretaker deleted successfully',
      success: true,
    }
  },
}
