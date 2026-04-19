import type { PageServerLoad } from './$types'
import { requireAuth } from '$lib/server/auth'
import { getUserById } from '$lib/services/users'
import {
  getCurrentMonthPaymentStats,
  getMonthlyPaymentTotals,
  getMonthlyPendingCounts,
  getRecentPaymentsForDashboard,
} from '$lib/services/payments'
import { getPortfolioUnitStats } from '$lib/services/units'
import { getCurrentMonthInvoiceStats, getMonthlyOverdueCounts } from '$lib/services/invoices'
import { getRecentTickets, getTicketStats } from '$lib/services/maintenance'
import { getRecentActivity } from '$lib/services/activity-log'

export const load: PageServerLoad = async (event) => {
  const session = await requireAuth(event)
  const user = await getUserById(session.userId)

  const [
    monthlyTotals,
    currentMonthPayments,
    currentMonthInvoices,
    unitStats,
    monthlyOverdue,
    monthlyPending,
    ticketStats,
    recentPayments,
    recentTickets,
    recentActivity,
  ] = await Promise.all([
    getMonthlyPaymentTotals(session.userId, 6),
    getCurrentMonthPaymentStats(session.userId),
    getCurrentMonthInvoiceStats(session.userId),
    getPortfolioUnitStats(session.userId),
    getMonthlyOverdueCounts(session.userId, 6),
    getMonthlyPendingCounts(session.userId, 6),
    getTicketStats(session.userId, 6),
    getRecentPaymentsForDashboard(session.userId, 5),
    getRecentTickets(session.userId, 5),
    getRecentActivity(session.userId, 10),
  ])

  const monthlyExpectedRent = monthlyTotals.map((item) => item.expectedRent)
  const monthlyConfirmedRent = monthlyTotals.map((item) => item.confirmedRent)
  const monthlyOutstanding = monthlyTotals.map((item) => item.outstanding)

  const previous = monthlyTotals[Math.max(monthlyTotals.length - 2, 0)]

  return {
    user: {
      name: user?.name ?? session.name,
      role: user?.role ?? session.role,
      businessName: user?.businessName ?? null,
    },
    todayLabel: new Date().toLocaleDateString('en-KE', {
      weekday: 'long',
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }),
    expectedRent: currentMonthInvoices.expectedRent,
    confirmedRent: currentMonthPayments.confirmedRent,
    outstandingBalance: Math.max(
      currentMonthInvoices.expectedRent - currentMonthPayments.confirmedRent,
      0,
    ),
    occupiedUnits: unitStats.occupied,
    vacantUnits: unitStats.vacant,
    totalUnits: unitStats.total,
    overdueTenantsCount: currentMonthInvoices.overdueCount,
    pendingConfirmationsCount: currentMonthInvoices.pendingCount,
    openTicketsCount: ticketStats.openTicketsCount,
    monthlyExpectedRent,
    monthlyConfirmedRent,
    monthlyOutstanding,
    monthlyOccupancy: unitStats.monthlyOccupancy,
    monthlyVacant: unitStats.monthlyVacant,
    monthlyOverdue,
    monthlyPending,
    monthlyTickets: ticketStats.monthlyTickets,
    prevExpectedRent: previous?.expectedRent ?? 0,
    prevConfirmedRent: previous?.confirmedRent ?? 0,
    prevOccupiedUnits: unitStats.monthlyOccupancy[Math.max(unitStats.monthlyOccupancy.length - 2, 0)] ?? 0,
    prevOverdueTenants: monthlyOverdue[Math.max(monthlyOverdue.length - 2, 0)] ?? 0,
    recentPayments,
    recentTickets,
    recentActivity,
  }
}
