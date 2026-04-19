import type { PageServerLoad } from './$types'
import { requireAuth } from '$lib/server/auth'
import { getNoticesByLandlord } from '$lib/services/notices'
import { getUserById } from '$lib/services/users'

const PAGE_SIZE = 10

export const load: PageServerLoad = async (event) => {
  const session = await requireAuth(event)
  const user = await getUserById(session.userId)

  const pageParam = Number(event.url.searchParams.get('page') ?? '1')
  const currentPage = Number.isFinite(pageParam) && pageParam > 0 ? Math.floor(pageParam) : 1

  const target = event.url.searchParams.get('target')
  const from = event.url.searchParams.get('from')
  const to = event.url.searchParams.get('to')

  const targetType =
    target === 'all_tenants' || target === 'property' || target === 'unit' || target === 'tenant'
      ? target
      : null

  const landlordId = user?.role === 'caretaker' ? user.invitedBy ?? session.userId : session.userId

  const result = await getNoticesByLandlord(landlordId, currentPage, PAGE_SIZE, {
    targetType,
    from,
    to,
  })

  const totalPages = Math.max(1, Math.ceil(result.totalCount / PAGE_SIZE))

  return {
    notices: result.notices,
    totalCount: result.totalCount,
    currentPage,
    totalPages,
    selectedTarget: targetType ?? 'all',
    selectedFrom: from ?? '',
    selectedTo: to ?? '',
    user: session,
  }
}
