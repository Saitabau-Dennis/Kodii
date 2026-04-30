<script lang="ts">
	import StatsGrid from '$lib/components/dashboard/StatsGrid.svelte';
	import RecentPayments from '$lib/components/dashboard/RecentPayments.svelte';
	import RecentTickets from '$lib/components/dashboard/RecentTickets.svelte';
	import RecentActivity from '$lib/components/dashboard/RecentActivity.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<section class="space-y-4">
	<StatsGrid
		expectedRent={data.expectedRent}
		confirmedRent={data.confirmedRent}
		outstandingBalance={data.outstandingBalance}
		occupiedUnits={data.occupiedUnits}
		vacantUnits={data.vacantUnits}
		totalUnits={data.totalUnits}
		overdueTenantsCount={data.overdueTenantsCount}
		pendingConfirmationsCount={data.pendingConfirmationsCount}
		openTicketsCount={data.openTicketsCount}
		monthlyExpectedRent={data.monthlyExpectedRent}
		monthlyConfirmedRent={data.monthlyConfirmedRent}
		monthlyOutstanding={data.monthlyOutstanding}
		monthlyOccupancy={data.monthlyOccupancy}
		monthlyVacant={data.monthlyVacant}
		monthlyOverdue={data.monthlyOverdue}
		monthlyPending={data.monthlyPending}
		monthlyTickets={data.monthlyTickets}
		prevExpectedRent={data.prevExpectedRent}
		prevConfirmedRent={data.prevConfirmedRent}
		prevOccupiedUnits={data.prevOccupiedUnits}
		prevOverdueTenants={data.prevOverdueTenants}
	/>

	<div class="grid grid-cols-1 gap-4 lg:grid-cols-5">
		<div class="lg:col-span-3">
			<RecentPayments payments={data.recentPayments} />
		</div>
		<div class="lg:col-span-2">
			<RecentTickets tickets={data.recentTickets} />
		</div>
	</div>

	<RecentActivity activities={data.recentActivity} />
</section>
