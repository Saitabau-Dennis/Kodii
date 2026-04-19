import { and, desc, eq, gte, inArray, lt, or, sql } from 'drizzle-orm'
import { withRetry } from '$lib/db/retry'
import {
  activityLogs,
  caretakerProperties,
  notices,
  noticeReplies,
  properties,
  tenants,
  units,
  users,
} from '$lib/db/schema'
import { db } from '$lib/server/db'
import { sendSMS } from '$lib/server/sms'
import type { NoticeReply, NoticeWithMeta } from '$lib/types/notices'

type NoticeTargetType = 'all_tenants' | 'property' | 'unit' | 'tenant'

type NoticeFilters = {
  targetType?: NoticeTargetType | null
  from?: string | null
  to?: string | null
}

type Recipient = {
  tenantId: string
  phoneNumber: string
  propertyId: string
  unitId: string | null
}

type RecipientGroup = {
  targetType: NoticeTargetType
  targetId: string | null
  recipients: Recipient[]
}

type SenderScope = {
  userId: string
  role: 'landlord' | 'caretaker'
  landlordId: string
  accessiblePropertyIds: string[]
}

function toDateStart(dateText: string): Date {
  return new Date(`${dateText}T00:00:00.000Z`)
}

function toDateNextDay(dateText: string): Date {
  const base = new Date(`${dateText}T00:00:00.000Z`)
  return new Date(base.getTime() + 24 * 60 * 60 * 1000)
}

async function getActorIdsForLandlord(landlordId: string): Promise<string[]> {
  const caretakerRows = await withRetry(() =>
    db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'caretaker'), eq(users.invitedBy, landlordId))),
  )

  return [landlordId, ...caretakerRows.map((row) => row.id)]
}

async function getUserScope(userId: string): Promise<{ id: string; role: 'landlord' | 'caretaker'; invitedBy: string | null } | null> {
  const [scope] = await withRetry(() =>
    db
      .select({ id: users.id, role: users.role, invitedBy: users.invitedBy })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  )
  return scope ?? null
}

async function getSenderScope(userId: string): Promise<SenderScope | null> {
  const scope = await getUserScope(userId)
  if (!scope) return null

  const landlordId = scope.role === 'landlord' ? userId : scope.invitedBy
  if (!landlordId) return null

  const accessiblePropertyIds = await getAccessiblePropertyIds(userId)
  return {
    userId,
    role: scope.role,
    landlordId,
    accessiblePropertyIds,
  }
}

async function getAccessiblePropertyIds(userId: string): Promise<string[]> {
  const scope = await getUserScope(userId)
  if (!scope) return []

  if (scope.role === 'landlord') {
    const rows = await withRetry(() =>
      db
        .select({ id: properties.id })
        .from(properties)
        .where(eq(properties.ownerId, userId)),
    )
    return rows.map((row) => row.id)
  }

  const rows = await withRetry(() =>
    db
      .select({ id: caretakerProperties.propertyId })
      .from(caretakerProperties)
      .where(eq(caretakerProperties.caretakerId, userId)),
  )
  return rows.map((row) => row.id)
}

async function getTargetDescriptions(rows: Array<{
  id: string
  targetType: NoticeTargetType
  targetId: string | null
}>): Promise<Map<string, string>> {
  const descriptions = new Map<string, string>()
  const propertyIds = new Set<string>()
  const unitIds = new Set<string>()
  const tenantIds = new Set<string>()

  for (const row of rows) {
    if (row.targetType === 'property' && row.targetId) propertyIds.add(row.targetId)
    if (row.targetType === 'unit' && row.targetId) unitIds.add(row.targetId)
    if (row.targetType === 'tenant' && row.targetId) tenantIds.add(row.targetId)
  }

  const [propertyRows, unitRows, tenantRows] = await Promise.all([
    propertyIds.size > 0
      ? withRetry(() =>
          db
            .select({ id: properties.id, name: properties.name })
            .from(properties)
            .where(inArray(properties.id, Array.from(propertyIds))),
        )
      : Promise.resolve([]),
    unitIds.size > 0
      ? withRetry(() =>
          db
            .select({
              id: units.id,
              unitNumber: units.unitNumber,
              propertyName: properties.name,
            })
            .from(units)
            .innerJoin(properties, eq(units.propertyId, properties.id))
            .where(inArray(units.id, Array.from(unitIds))),
        )
      : Promise.resolve([]),
    tenantIds.size > 0
      ? withRetry(() =>
          db
            .select({
              id: tenants.id,
              fullName: tenants.fullName,
            })
            .from(tenants)
            .where(inArray(tenants.id, Array.from(tenantIds))),
        )
      : Promise.resolve([]),
  ])

  const propertyMap = new Map(propertyRows.map((row) => [row.id, row.name]))
  const unitMap = new Map(unitRows.map((row) => [row.id, `Unit ${row.unitNumber} — ${row.propertyName}`]))
  const tenantMap = new Map(tenantRows.map((row) => [row.id, row.fullName]))

  for (const row of rows) {
    if (row.targetType === 'all_tenants') {
      descriptions.set(row.id, 'All Tenants')
      continue
    }

    if (!row.targetId) {
      descriptions.set(row.id, 'Unknown target')
      continue
    }

    if (row.targetType === 'property') {
      descriptions.set(row.id, propertyMap.get(row.targetId) ?? 'Unknown property')
      continue
    }

    if (row.targetType === 'unit') {
      descriptions.set(row.id, unitMap.get(row.targetId) ?? 'Unknown unit')
      continue
    }

    descriptions.set(row.id, tenantMap.get(row.targetId) ?? 'Unknown tenant')
  }

  return descriptions
}

/**
 * Returns notices for landlord account with reply counts and filters.
 */
export async function getNoticesByLandlord(
  landlordId: string,
  page: number,
  limit: number,
  filters: NoticeFilters,
): Promise<{ notices: NoticeWithMeta[]; totalCount: number }> {
  const safePage = Number.isFinite(page) && page > 0 ? Math.floor(page) : 1
  const safeLimit = Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : 10
  const offset = (safePage - 1) * safeLimit

  const actorIds = await getActorIdsForLandlord(landlordId)
  const whereClauses: any[] = [inArray(notices.sentBy, actorIds)]

  if (filters.targetType) {
    whereClauses.push(eq(notices.targetType, filters.targetType))
  }
  if (filters.from) {
    whereClauses.push(gte(notices.sentAt, toDateStart(filters.from)))
  }
  if (filters.to) {
    whereClauses.push(lt(notices.sentAt, toDateNextDay(filters.to)))
  }

  const [countRows, rows] = await Promise.all([
    withRetry(() =>
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(notices)
        .where(and(...whereClauses)),
    ),
    withRetry(() =>
      db
        .select({
          id: notices.id,
          title: notices.title,
          message: notices.message,
          targetType: notices.targetType,
          targetId: notices.targetId,
          sentAt: notices.sentAt,
          deliveryStatus: notices.deliveryStatus,
          sentBy: users.name,
        })
        .from(notices)
        .innerJoin(users, eq(notices.sentBy, users.id))
        .where(and(...whereClauses))
        .orderBy(desc(notices.sentAt))
        .limit(safeLimit)
        .offset(offset),
    ),
  ])

  if (rows.length === 0) {
    return { notices: [], totalCount: countRows[0]?.count ?? 0 }
  }

  const noticeIds = rows.map((row) => row.id)
  const [replyRows, targetDescriptions] = await Promise.all([
    withRetry(() =>
      db
        .select({
          noticeId: sql<string | null>`${noticeReplies.noticeId}`,
          replyCount: sql<number>`count(*)::int`,
          unreadReplyCount: sql<number>`count(*) filter (where ${noticeReplies.isRead} is false)::int`,
        })
        .from(noticeReplies)
        .where(inArray(noticeReplies.noticeId, noticeIds))
        .groupBy(sql`${noticeReplies.noticeId}`),
    ),
    getTargetDescriptions(
      rows.map((row) => ({
        id: row.id,
        targetType: row.targetType,
        targetId: row.targetId,
      })),
    ),
  ])

  const replyMap = new Map(
    replyRows.map((row) => [
      row.noticeId ?? '',
      { replyCount: row.replyCount ?? 0, unreadReplyCount: row.unreadReplyCount ?? 0 },
    ]),
  )

  return {
    notices: rows.map((row) => {
      const replies = replyMap.get(row.id) ?? { replyCount: 0, unreadReplyCount: 0 }
      return {
        id: row.id,
        title: row.title,
        message: row.message,
        targetType: row.targetType,
        targetId: row.targetId,
        targetDescription: targetDescriptions.get(row.id) ?? 'Unknown target',
        sentBy: row.sentBy,
        sentAt: row.sentAt,
        deliveryStatus: row.deliveryStatus,
        replyCount: replies.replyCount,
        unreadReplyCount: replies.unreadReplyCount,
      } satisfies NoticeWithMeta
    }),
    totalCount: countRows[0]?.count ?? 0,
  }
}

/**
 * Returns one notice with replies and target details.
 */
export async function getNoticeById(id: string): Promise<
  | {
      notice: NoticeWithMeta
      replies: NoticeReply[]
    }
  | undefined
> {
  const [row] = await withRetry(() =>
    db
      .select({
        id: notices.id,
        title: notices.title,
        message: notices.message,
        targetType: notices.targetType,
        targetId: notices.targetId,
        sentAt: notices.sentAt,
        deliveryStatus: notices.deliveryStatus,
        sentBy: users.name,
      })
      .from(notices)
      .innerJoin(users, eq(notices.sentBy, users.id))
      .where(eq(notices.id, id))
      .limit(1),
  )

  if (!row) return undefined

  const [replyRows, targetDescriptions] = await Promise.all([
    withRetry(() =>
      db
        .select({
          id: noticeReplies.id,
          noticeId: noticeReplies.noticeId,
          tenantId: noticeReplies.tenantId,
          tenantName: tenants.fullName,
          fromPhone: noticeReplies.fromPhone,
          message: noticeReplies.message,
          receivedAt: noticeReplies.receivedAt,
          isRead: noticeReplies.isRead,
        })
        .from(noticeReplies)
        .leftJoin(tenants, eq(noticeReplies.tenantId, tenants.id))
        .where(eq(noticeReplies.noticeId, id))
        .orderBy(desc(noticeReplies.receivedAt)),
    ),
    getTargetDescriptions([
      { id: row.id, targetType: row.targetType, targetId: row.targetId },
    ]),
  ])

  const unreadReplyCount = replyRows.filter((reply) => !reply.isRead).length

  return {
    notice: {
      id: row.id,
      title: row.title,
      message: row.message,
      targetType: row.targetType,
      targetId: row.targetId,
      targetDescription: targetDescriptions.get(row.id) ?? 'Unknown target',
      sentBy: row.sentBy,
      sentAt: row.sentAt,
      deliveryStatus: row.deliveryStatus,
      replyCount: replyRows.length,
      unreadReplyCount,
    },
    replies: replyRows.map((reply) => ({
      id: reply.id,
      noticeId: reply.noticeId,
      tenantId: reply.tenantId,
      tenantName: reply.tenantName,
      fromPhone: reply.fromPhone,
      message: reply.message,
      receivedAt: reply.receivedAt,
      isRead: reply.isRead,
    })),
  }
}

/**
 * Resolves recipient groups for a target under landlord account.
 */
export async function getRecipientsForTarget(
  targetType: NoticeTargetType,
  targetIds: string[],
  landlordId: string,
): Promise<RecipientGroup[]> {
  const baseWhere = and(eq(tenants.status, 'active'), eq(properties.ownerId, landlordId))

  if (targetType === 'all_tenants') {
    const rows = await withRetry(() =>
      db
        .select({
          tenantId: tenants.id,
          phoneNumber: tenants.phoneNumber,
          propertyId: tenants.propertyId,
          unitId: tenants.unitId,
        })
        .from(tenants)
        .innerJoin(properties, eq(tenants.propertyId, properties.id))
        .where(baseWhere),
    )

    return [
      {
        targetType: 'all_tenants',
        targetId: null,
        recipients: rows.map((row) => ({
          tenantId: row.tenantId,
          phoneNumber: row.phoneNumber,
          propertyId: row.propertyId,
          unitId: row.unitId,
        })),
      },
    ]
  }

  if (targetType === 'property') {
    const validPropertyRows = await withRetry(() =>
      db
        .select({ id: properties.id })
        .from(properties)
        .where(and(eq(properties.ownerId, landlordId), inArray(properties.id, targetIds))),
    )
    const validPropertyIds = validPropertyRows.map((row) => row.id)
    if (validPropertyIds.length === 0) return []

    const rows = await withRetry(() =>
      db
        .select({
          propertyId: tenants.propertyId,
          tenantId: tenants.id,
          phoneNumber: tenants.phoneNumber,
          unitId: tenants.unitId,
        })
        .from(tenants)
        .innerJoin(properties, eq(tenants.propertyId, properties.id))
        .where(and(baseWhere, inArray(tenants.propertyId, validPropertyIds))),
    )

    const map = new Map<string, Recipient[]>()
    for (const row of rows) {
      const list = map.get(row.propertyId) ?? []
      list.push({
        tenantId: row.tenantId,
        phoneNumber: row.phoneNumber,
        propertyId: row.propertyId,
        unitId: row.unitId,
      })
      map.set(row.propertyId, list)
    }

    return validPropertyIds.map((propertyId) => ({
      targetType: 'property' as const,
      targetId: propertyId,
      recipients: map.get(propertyId) ?? [],
    }))
  }

  if (targetType === 'unit') {
    const rows = await withRetry(() =>
      db
        .select({
          unitId: units.id,
          propertyId: units.propertyId,
          tenantId: tenants.id,
          phoneNumber: tenants.phoneNumber,
        })
        .from(units)
        .innerJoin(properties, eq(units.propertyId, properties.id))
        .leftJoin(tenants, eq(units.tenantId, tenants.id))
        .where(
          and(
            eq(properties.ownerId, landlordId),
            inArray(units.id, targetIds),
            eq(units.status, 'occupied'),
            sql`${units.tenantId} is not null`,
            eq(tenants.status, 'active'),
          ),
        ),
    )

    const map = new Map<string, Recipient[]>()
    for (const row of rows) {
      if (!row.tenantId || !row.phoneNumber) continue
      map.set(row.unitId, [
        {
          tenantId: row.tenantId,
          phoneNumber: row.phoneNumber,
          propertyId: row.propertyId,
          unitId: row.unitId,
        },
      ])
    }

    return targetIds.map((unitId) => ({
      targetType: 'unit' as const,
      targetId: unitId,
      recipients: map.get(unitId) ?? [],
    }))
  }

  const rows = await withRetry(() =>
    db
      .select({
        tenantId: tenants.id,
        phoneNumber: tenants.phoneNumber,
        propertyId: tenants.propertyId,
        unitId: tenants.unitId,
      })
      .from(tenants)
      .innerJoin(properties, eq(tenants.propertyId, properties.id))
      .where(and(baseWhere, inArray(tenants.id, targetIds))),
  )

  const map = new Map<string, Recipient[]>()
  for (const row of rows) {
    map.set(row.tenantId, [
      {
        tenantId: row.tenantId,
        phoneNumber: row.phoneNumber,
        propertyId: row.propertyId,
        unitId: row.unitId,
      },
    ])
  }

  return targetIds.map((tenantId) => ({
    targetType: 'tenant' as const,
    targetId: tenantId,
    recipients: map.get(tenantId) ?? [],
  }))
}

/**
 * Sends notices and creates notice records.
 */
export async function sendNotice(
  data: {
    title?: string | null
    message: string
    targetType: NoticeTargetType
    targetIds: string[]
  },
  sentBy: string,
): Promise<{ sentCount: number; noticeCount: number }> {
  const scope = await getSenderScope(sentBy)
  if (!scope) throw new Error('Sender not found')

  if (scope.role === 'caretaker' && data.targetType === 'all_tenants') {
    throw new Error('Caretakers cannot send notices to all tenants')
  }

  const groups = await getRecipientsForTarget(data.targetType, data.targetIds, scope.landlordId)

  const filteredGroups = groups
    .map((group) => ({
      ...group,
      recipients:
        scope.role === 'landlord'
          ? group.recipients
          : group.recipients.filter((recipient) => scope.accessiblePropertyIds.includes(recipient.propertyId)),
    }))
    .filter((group) => {
      if (data.targetType === 'all_tenants') return true
      return group.targetId !== null
    })

  const totalRecipients = filteredGroups.reduce((sum, group) => sum + group.recipients.length, 0)
  if (totalRecipients === 0) {
    throw new Error('Cannot send to 0 recipients. Please select at least one recipient.')
  }

  let sentCount = 0
  let noticeCount = 0

  for (const group of filteredGroups) {
    const [createdNotice] = await withRetry(() =>
      db
        .insert(notices)
        .values({
          title: data.title?.trim() ? data.title.trim() : null,
          message: data.message,
          targetType: group.targetType,
          targetId: group.targetId,
          sentBy,
          deliveryStatus: null,
        })
        .returning({ id: notices.id }),
    )

    noticeCount += 1

    let hasSuccess = false
    for (const recipient of group.recipients) {
      try {
        const smsResult = await sendSMS({
          to: recipient.phoneNumber,
          message: `Notice: ${data.message.trim()} Regards, KODII.`,
          refId: createdNotice.id,
        })
        sentCount += 1
        hasSuccess = true

        await withRetry(() =>
          db.insert(activityLogs).values({
            actorId: sentBy,
            action: 'notice_sms_sent',
            entityType: 'notice',
            entityId: createdNotice.id,
            metadata: {
              to: recipient.phoneNumber,
              providerMessageId: smsResult.providerMessageId ?? null,
              sendStatus: 'accepted',
            },
          }),
        )
      } catch {
        await withRetry(() =>
          db.insert(activityLogs).values({
            actorId: sentBy,
            action: 'notice_sms_send_failed',
            entityType: 'notice',
            entityId: createdNotice.id,
            metadata: {
              to: recipient.phoneNumber,
            },
          }),
        )
        // continue sending remaining recipients
      }
    }

    await withRetry(() =>
      db
        .update(notices)
        .set({ deliveryStatus: hasSuccess ? 'sent' : 'failed' })
        .where(eq(notices.id, createdNotice.id)),
    )
  }

  return { sentCount, noticeCount }
}

/**
 * Marks all replies for a notice as read.
 */
export async function markRepliesRead(noticeId: string): Promise<void> {
  await withRetry(() =>
    db
      .update(noticeReplies)
      .set({ isRead: true })
      .where(and(eq(noticeReplies.noticeId, noticeId), eq(noticeReplies.isRead, false))),
  )
}

export async function getNoticeSendContext(userId: string): Promise<{
  canSendAllTenants: boolean
  properties: Array<{ id: string; name: string }>
  unitsByProperty: Record<string, Array<{ id: string; unitNumber: string; tenantName: string | null; tenantId: string | null }>>
  tenants: Array<{
    id: string
    fullName: string
    phoneNumber: string
    propertyId: string
    propertyName: string
    unitId: string | null
    unitNumber: string | null
  }>
}> {
  const senderScope = await getSenderScope(userId)
  if (!senderScope) {
    return { canSendAllTenants: false, properties: [], unitsByProperty: {}, tenants: [] }
  }

  if (senderScope.accessiblePropertyIds.length === 0) {
    return { canSendAllTenants: senderScope.role === 'landlord', properties: [], unitsByProperty: {}, tenants: [] }
  }

  const propertiesRows = await withRetry(() =>
    db
      .select({ id: properties.id, name: properties.name })
      .from(properties)
      .where(inArray(properties.id, senderScope.accessiblePropertyIds)),
  )

  const unitRows = senderScope.accessiblePropertyIds.length
    ? await withRetry(() =>
        db
          .select({
            id: units.id,
            propertyId: units.propertyId,
            unitNumber: units.unitNumber,
            tenantId: tenants.id,
            tenantName: tenants.fullName,
          })
          .from(units)
          .leftJoin(tenants, eq(units.tenantId, tenants.id))
          .where(
            and(
              inArray(units.propertyId, senderScope.accessiblePropertyIds),
              eq(units.status, 'occupied'),
              sql`${units.tenantId} is not null`,
              eq(tenants.status, 'active'),
            ),
          ),
      )
    : []

  const tenantRows = senderScope.accessiblePropertyIds.length
    ? await withRetry(() =>
        db
          .select({
            id: tenants.id,
            fullName: tenants.fullName,
            phoneNumber: tenants.phoneNumber,
            propertyId: tenants.propertyId,
            propertyName: properties.name,
            unitId: tenants.unitId,
            unitNumber: units.unitNumber,
          })
          .from(tenants)
          .innerJoin(properties, eq(tenants.propertyId, properties.id))
          .leftJoin(units, eq(tenants.unitId, units.id))
          .where(and(eq(tenants.status, 'active'), inArray(tenants.propertyId, senderScope.accessiblePropertyIds))),
      )
    : []

  const unitsByProperty: Record<string, Array<{ id: string; unitNumber: string; tenantName: string | null; tenantId: string | null }>> = {}
  for (const row of unitRows) {
    const list = unitsByProperty[row.propertyId] ?? []
    list.push({
      id: row.id,
      unitNumber: row.unitNumber,
      tenantName: row.tenantName,
      tenantId: row.tenantId,
    })
    unitsByProperty[row.propertyId] = list
  }

  return {
    canSendAllTenants: senderScope.role === 'landlord',
    properties: propertiesRows,
    unitsByProperty,
    tenants: tenantRows.map((row) => ({
      id: row.id,
      fullName: row.fullName,
      phoneNumber: row.phoneNumber,
      propertyId: row.propertyId,
      propertyName: row.propertyName,
      unitId: row.unitId,
      unitNumber: row.unitNumber,
    })),
  }
}

export async function canAccessNotice(userId: string, noticeId: string): Promise<boolean> {
  const senderScope = await getSenderScope(userId)
  if (!senderScope) return false

  const actorIds = await getActorIdsForLandlord(senderScope.landlordId)
  const [row] = await withRetry(() =>
    db
      .select({ id: notices.id })
      .from(notices)
      .where(and(eq(notices.id, noticeId), inArray(notices.sentBy, actorIds)))
      .limit(1),
  )
  return Boolean(row)
}

export async function logNoticeActivity(
  actorId: string,
  action: string,
  noticeId: string | null,
  metadata?: unknown,
) {
  await withRetry(() =>
    db.insert(activityLogs).values({
      actorId,
      action,
      entityType: 'notice',
      entityId: noticeId,
      metadata: metadata as any,
    }),
  )
}
