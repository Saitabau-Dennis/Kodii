import type { PageServerLoad } from './$types'
import { requireAuth } from '$lib/server/auth'
import {
  getFinancialSummary,
  getMaintenanceByProperty,
  getMaintenanceSummary,
  getOccupancyByProperty,
  getOccupancySummary,
  getOverdueTenants,
  getPendingPayments,
  getRentByProperty,
} from '$lib/services/reports'
import { getUserById } from '$lib/services/users'

function dateKey(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function parseDate(value: string | null): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function defaultRange() {
  const today = new Date()
  const start = new Date(today.getFullYear(), today.getMonth(), 1)
  return { from: start, to: today }
}

export const load: PageServerLoad = async (event) => {
  const session = await requireAuth(event)
  const user = await getUserById(session.userId)

  const defaults = defaultRange()
  const rawFrom = parseDate(event.url.searchParams.get('from'))
  const rawTo = parseDate(event.url.searchParams.get('to'))

  let from = rawFrom ?? defaults.from
  let to = rawTo ?? defaults.to

  if (from > to) {
    const temp = from
    from = to
    to = temp
  }

  const [financialSummary, rentByProperty, occupancySummary, occupancyByProperty, overdueTenants, pendingPayments, maintenanceSummary, maintenanceByProperty] =
    await Promise.all([
      getFinancialSummary(session.userId, from, to),
      getRentByProperty(session.userId, from, to),
      getOccupancySummary(session.userId),
      getOccupancyByProperty(session.userId),
      getOverdueTenants(session.userId, from, to),
      getPendingPayments(session.userId, 10),
      getMaintenanceSummary(session.userId, from, to),
      getMaintenanceByProperty(session.userId, from, to),
    ])

  return {
    user: {
      name: user?.name ?? session.name,
      role: user?.role ?? session.role,
      businessName: user?.businessName ?? null,
    },
    from: dateKey(from),
    to: dateKey(to),
    financialSummary,
    rentByProperty,
    occupancySummary,
    occupancyByProperty,
    overdueTenants,
    pendingPayments,
    maintenanceSummary,
    maintenanceByProperty,
  }
}
