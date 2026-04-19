import { fail, redirect } from '@sveltejs/kit'
import type { Actions, ServerLoad } from '@sveltejs/kit'
import { requireAuth } from '$lib/server/auth'
import {
  canAccessNotice,
  getNoticeById,
  logNoticeActivity,
  markRepliesRead,
  sendNotice,
} from '$lib/services/notices'

export const load: ServerLoad = async (event) => {
  const session = await requireAuth(event)
  const noticeId = event.params.id
  if (!noticeId) throw redirect(302, '/notices')

  const hasAccess = await canAccessNotice(session.userId, noticeId)
  if (!hasAccess) {
    throw redirect(302, '/notices')
  }

  const detail = await getNoticeById(noticeId)
  if (!detail) {
    throw redirect(302, '/notices')
  }

  await markRepliesRead(noticeId)

  return {
    notice: detail.notice,
    replies: detail.replies.map((reply) => ({ ...reply, isRead: true })),
    user: session,
  }
}

export const actions: Actions = {
  markRepliesRead: async (event) => {
    const session = await requireAuth(event)
    const noticeId = event.params.id
    if (!noticeId) return fail(400, { message: 'Notice id is required' })

    const hasAccess = await canAccessNotice(session.userId, noticeId)
    if (!hasAccess) return fail(403, { message: 'Forbidden' })

    await markRepliesRead(noticeId)
    return { success: true }
  },

  resend: async (event) => {
    const session = await requireAuth(event)
    const noticeId = event.params.id
    if (!noticeId) return fail(400, { message: 'Notice id is required' })

    const hasAccess = await canAccessNotice(session.userId, noticeId)
    if (!hasAccess) return fail(403, { message: 'Forbidden' })

    const detail = await getNoticeById(noticeId)
    if (!detail) return fail(404, { message: 'Notice not found' })

    const { notice } = detail
    const targetIds =
      notice.targetType === 'all_tenants'
        ? []
        : notice.targetId
          ? [notice.targetId]
          : []

    if (notice.targetType !== 'all_tenants' && targetIds.length === 0) {
      return fail(400, { message: 'Notice target is invalid for resend' })
    }

    try {
      const result = await sendNotice(
        {
          title: notice.title,
          message: notice.message,
          targetType: notice.targetType,
          targetIds,
        },
        session.userId,
      )

      await logNoticeActivity(session.userId, 'notice_resent', noticeId, {
        resentFromNoticeId: noticeId,
        sentCount: result.sentCount,
        noticeCount: result.noticeCount,
      })

      return {
        success: true,
        message: `Notice resent to ${result.sentCount} recipient${result.sentCount === 1 ? '' : 's'}.`,
      }
    } catch (error) {
      return fail(400, {
        message: error instanceof Error ? error.message : 'Failed to resend notice',
      })
    }
  },
}
