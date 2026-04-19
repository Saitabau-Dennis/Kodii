import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm'
import { withRetry } from '$lib/db/retry'
import { activityLogs, users } from '$lib/db/schema'
import { db } from '$lib/server/db'

export type RecentActivityItem = {
  id: string
  action: string
  entityType: string | null
  performedBy: string
  createdAt: string
}

async function getAccountActorIds(userId: string): Promise<string[]> {
  const [sessionUser] = await withRetry(() =>
    db
      .select({ id: users.id, role: users.role, invitedBy: users.invitedBy })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1),
  )

  if (!sessionUser) return []

  if (sessionUser.role === 'landlord') {
    const caretakerRows = await withRetry(() =>
      db
        .select({ id: users.id })
        .from(users)
        .where(and(eq(users.role, 'caretaker'), eq(users.invitedBy, userId))),
    )
    return [userId, ...caretakerRows.map((row) => row.id)]
  }

  if (!sessionUser.invitedBy) return [userId]

  const ownerId = sessionUser.invitedBy
  if (!ownerId) return [userId]

  const caretakerRows = await withRetry(() =>
    db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'caretaker'), eq(users.invitedBy, ownerId))),
  )

  return [ownerId, ...caretakerRows.map((row) => row.id)]
}

/**
 * Returns latest activity rows scoped to the account.
 */
export async function getRecentActivity(userId: string, limit: number): Promise<RecentActivityItem[]> {
  const actorIds = await getAccountActorIds(userId)
  if (actorIds.length === 0) return []

  const rows = await withRetry(() =>
    db
      .select({
        id: activityLogs.id,
        action: activityLogs.action,
        entityType: activityLogs.entityType,
        actorName: users.name,
        createdAt: activityLogs.createdAt,
      })
      .from(activityLogs)
      .leftJoin(users, eq(activityLogs.actorId, users.id))
      .where(
        or(
          inArray(activityLogs.actorId, actorIds),
          isNull(activityLogs.actorId),
        ),
      )
      .orderBy(sql`${activityLogs.createdAt} desc`)
      .limit(limit),
  )

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    entityType: row.entityType,
    performedBy: row.actorName ?? 'System',
    createdAt: row.createdAt.toISOString(),
  }))
}
