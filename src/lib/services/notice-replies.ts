import { and, eq, inArray, sql } from 'drizzle-orm'
import { withRetry } from '$lib/db/retry'
import { noticeReplies, notices, users } from '$lib/db/schema'
import { db } from '$lib/server/db'

async function getActorIdsForLandlord(landlordId: string): Promise<string[]> {
  const caretakerRows = await withRetry(() =>
    db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'caretaker'), eq(users.invitedBy, landlordId))),
  )

  return [landlordId, ...caretakerRows.map((row) => row.id)]
}

export async function saveReply(data: {
  noticeId: string | null
  tenantId: string | null
  fromPhone: string
  message: string
}) {
  const [row] = await withRetry(() =>
    db
      .insert(noticeReplies)
      .values({
        noticeId: data.noticeId,
        tenantId: data.tenantId,
        fromPhone: data.fromPhone,
        message: data.message,
        isRead: false,
      })
      .returning(),
  )

  return row
}

export async function getUnreadReplyCount(landlordId: string): Promise<number> {
  const actorIds = await getActorIdsForLandlord(landlordId)
  if (actorIds.length === 0) return 0

  const [row] = await withRetry(() =>
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(noticeReplies)
      .innerJoin(notices, eq(noticeReplies.noticeId, notices.id))
      .where(and(eq(noticeReplies.isRead, false), inArray(notices.sentBy, actorIds))),
  )

  return row?.count ?? 0
}
