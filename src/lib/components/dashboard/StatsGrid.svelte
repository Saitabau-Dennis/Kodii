<script lang="ts">
  import {
    BuildingOutline,
    CashOutline,
    CheckCircleOutline,
    ClockOutline,
    ExclamationCircleOutline,
    HomeOutline,
    InboxOutline,
    ToolsOutline,
  } from 'flowbite-svelte-icons'
  import StatCard from '$lib/components/dashboard/StatCard.svelte'
  import { calcTrend, formatKES } from '$lib/utils/trends'

  interface Props {
    expectedRent: number
    confirmedRent: number
    outstandingBalance: number
    occupiedUnits: number
    vacantUnits: number
    totalUnits: number
    overdueTenantsCount: number
    pendingConfirmationsCount: number
    openTicketsCount: number
    monthlyExpectedRent: number[]
    monthlyConfirmedRent: number[]
    monthlyOutstanding: number[]
    monthlyOccupancy: number[]
    monthlyVacant: number[]
    monthlyOverdue: number[]
    monthlyPending: number[]
    monthlyTickets: number[]
    prevExpectedRent: number
    prevConfirmedRent: number
    prevOccupiedUnits: number
    prevOverdueTenants: number
  }

  let {
    expectedRent,
    confirmedRent,
    outstandingBalance,
    occupiedUnits,
    vacantUnits,
    totalUnits,
    overdueTenantsCount,
    pendingConfirmationsCount,
    openTicketsCount,
    monthlyExpectedRent,
    monthlyConfirmedRent,
    monthlyOutstanding,
    monthlyOccupancy,
    monthlyVacant,
    monthlyOverdue,
    monthlyPending,
    monthlyTickets,
    prevExpectedRent,
    prevConfirmedRent,
    prevOccupiedUnits,
    prevOverdueTenants,
  }: Props = $props()

  const expectedTrend = $derived(calcTrend(expectedRent, prevExpectedRent))
  const confirmedTrend = $derived(calcTrend(confirmedRent, prevConfirmedRent))
  const prevOutstanding = $derived(monthlyOutstanding[Math.max(monthlyOutstanding.length - 2, 0)] ?? 0)
  const outstandingTrend = $derived(calcTrend(outstandingBalance, prevOutstanding))

  const occupancyRate = $derived(totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0)
  const vacantPrev = $derived(monthlyVacant[Math.max(monthlyVacant.length - 2, 0)] ?? 0)
  const vacantTrend = $derived(calcTrend(vacantUnits, vacantPrev))
  const overdueTrend = $derived(calcTrend(overdueTenantsCount, prevOverdueTenants))
  const pendingPrev = $derived(monthlyPending[Math.max(monthlyPending.length - 2, 0)] ?? 0)
  const pendingTrend = $derived(calcTrend(pendingConfirmationsCount, pendingPrev))
  const ticketsPrev = $derived(monthlyTickets[Math.max(monthlyTickets.length - 2, 0)] ?? 0)
  const ticketsTrend = $derived(calcTrend(openTicketsCount, ticketsPrev))
</script>

<section class="grid grid-cols-2 gap-3 lg:grid-cols-4">
  <StatCard
    title="Expected Rent"
    value={formatKES(expectedRent)}
    icon={CashOutline}
    sparklineData={monthlyExpectedRent}
    sparklineType="line"
    trend={expectedTrend.label}
    trendUp={expectedTrend.isUp}
  />
  <StatCard
    title="Confirmed Rent"
    value={formatKES(confirmedRent)}
    icon={CheckCircleOutline}
    sparklineData={monthlyConfirmedRent}
    sparklineType="line"
    trend={confirmedTrend.label}
    trendUp={confirmedTrend.isUp}
  />
  <StatCard
    title="Outstanding Balance"
    value={formatKES(outstandingBalance)}
    icon={ExclamationCircleOutline}
    sparklineData={monthlyOutstanding}
    sparklineType="line"
    trend={outstandingTrend.label}
    trendUp={!outstandingTrend.isUp}
  />
  <StatCard
    title="Occupied Units"
    value={`${occupiedUnits}/${totalUnits}`}
    icon={BuildingOutline}
    sparklineData={monthlyOccupancy}
    sparklineType="line"
    trend={`${occupancyRate}% occupancy`}
    trendUp={occupiedUnits >= prevOccupiedUnits}
  />
  <StatCard
    title="Vacant Units"
    value={vacantUnits.toString()}
    icon={HomeOutline}
    sparklineData={monthlyVacant}
    sparklineType="line"
    trend={vacantTrend.label}
    trendUp={!vacantTrend.isUp}
  />
  <StatCard
    title="Overdue Tenants"
    value={overdueTenantsCount.toString()}
    icon={ClockOutline}
    sparklineData={monthlyOverdue}
    sparklineType="line"
    trend={overdueTrend.label}
    trendUp={!overdueTrend.isUp}
    accentBorder={overdueTenantsCount > 0}
    accentColor="danger"
  />
  <StatCard
    title="Pending Confirmations"
    value={pendingConfirmationsCount.toString()}
    icon={InboxOutline}
    sparklineData={monthlyPending}
    sparklineType="line"
    trend={pendingTrend.label}
    trendUp={!pendingTrend.isUp}
    accentBorder={pendingConfirmationsCount > 0}
    accentColor="warning"
  />
  <StatCard
    title="Open Tickets"
    value={openTicketsCount.toString()}
    icon={ToolsOutline}
    sparklineData={monthlyTickets}
    sparklineType="line"
    trend={ticketsTrend.label}
    trendUp={!ticketsTrend.isUp}
  />
</section>
