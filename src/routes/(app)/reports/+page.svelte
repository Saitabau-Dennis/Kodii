<script lang="ts">
	import { resolve } from '$app/paths';
	import { Button, Table } from 'flowbite-svelte';
	import { CheckCircleOutline } from 'flowbite-svelte-icons';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import DateRangeFilter from '$lib/components/reports/DateRangeFilter.svelte';
	import OverdueTenantRow from '$lib/components/reports/OverdueTenantRow.svelte';
	import ReportStatCards from '$lib/components/reports/ReportStatCards.svelte';
	import ReportTable from '$lib/components/reports/ReportTable.svelte';
	import { csvKES, downloadCSV, toCSV } from '$lib/utils/csv';
	import { formatKES } from '$lib/utils/trends';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const fromLabel = $derived(
		new Date(data.from).toLocaleDateString('en-KE', { dateStyle: 'medium' })
	);
	const toLabel = $derived(new Date(data.to).toLocaleDateString('en-KE', { dateStyle: 'medium' }));

	const percent = (value: number) => `${value.toFixed(1)}%`;
	const csvDate = (value: Date | null) => (value ? value.toISOString().slice(0, 10) : 'Never');
	const slug = (value: string) => value.toLowerCase().replaceAll(' ', '_');
	const fileRange = $derived(`${data.from}_to_${data.to}`);

	const financialCards = $derived([
		{
			title: 'Total Expected Rent',
			value: formatKES(data.financialSummary.expectedRent),
			subtitle: 'Across all properties for period',
			color: 'default' as const
		},
		{
			title: 'Total Confirmed Rent',
			value: formatKES(data.financialSummary.confirmedRent),
			subtitle: 'Verified payments only',
			color: 'default' as const
		},
		{
			title: 'Total Outstanding',
			value: formatKES(data.financialSummary.outstanding),
			subtitle: 'Expected minus confirmed',
			color: data.financialSummary.outstanding > 0 ? ('red' as const) : ('default' as const)
		},
		{
			title: 'Collection Rate',
			value: percent(data.financialSummary.collectionRate),
			subtitle: 'Confirmed / Expected',
			color:
				data.financialSummary.collectionRate >= 80
					? ('default' as const)
					: data.financialSummary.collectionRate >= 50
						? ('amber' as const)
						: ('red' as const)
		}
	]);

	const occupancyRate = $derived(
		data.occupancySummary.totalUnits > 0
			? (data.occupancySummary.occupiedUnits / data.occupancySummary.totalUnits) * 100
			: 0
	);

	const occupancyCards = $derived([
		{
			title: 'Total Units',
			value: data.occupancySummary.totalUnits.toString(),
			subtitle: 'Current portfolio capacity',
			color: 'default' as const
		},
		{
			title: 'Occupied Units',
			value: data.occupancySummary.occupiedUnits.toString(),
			subtitle: `${percent(occupancyRate)} occupancy rate`,
			color: 'default' as const
		},
		{
			title: 'Vacant Units',
			value: data.occupancySummary.vacantUnits.toString(),
			subtitle: 'Available for new tenants',
			color: 'default' as const
		},
		{
			title: 'Inactive Units',
			value: data.occupancySummary.inactiveUnits.toString(),
			subtitle: 'Temporarily not rentable',
			color: 'default' as const
		}
	]);

	const maintenanceCards = $derived([
		{
			title: 'Open Tickets',
			value: data.maintenanceSummary.openCount.toString(),
			subtitle: 'Created during selected period',
			color: data.maintenanceSummary.openCount > 0 ? ('red' as const) : ('default' as const)
		},
		{
			title: 'In Progress',
			value: data.maintenanceSummary.inProgressCount.toString(),
			subtitle: 'Currently being worked on',
			color: 'default' as const
		},
		{
			title: 'Resolved This Period',
			value: data.maintenanceSummary.resolvedCount.toString(),
			subtitle: 'Resolved within selected dates',
			color: 'default' as const
		}
	]);

	const rentRows = $derived(
		data.rentByProperty.map((row) => [
			row.propertyName,
			row.unitCount,
			formatKES(row.expectedRent),
			formatKES(row.confirmedRent),
			formatKES(row.outstanding),
			percent(row.collectionRate),
			row.overdueCount
		])
	);

	const rentFooter = $derived.by(() => {
		const totals = data.rentByProperty.reduce(
			(acc, row) => ({
				unitCount: acc.unitCount + row.unitCount,
				expectedRent: acc.expectedRent + row.expectedRent,
				confirmedRent: acc.confirmedRent + row.confirmedRent,
				outstanding: acc.outstanding + row.outstanding,
				overdueCount: acc.overdueCount + row.overdueCount
			}),
			{ unitCount: 0, expectedRent: 0, confirmedRent: 0, outstanding: 0, overdueCount: 0 }
		);
		const rate = totals.expectedRent > 0 ? (totals.confirmedRent / totals.expectedRent) * 100 : 0;
		return [
			'Total',
			totals.unitCount,
			formatKES(totals.expectedRent),
			formatKES(totals.confirmedRent),
			formatKES(totals.outstanding),
			percent(rate),
			totals.overdueCount
		];
	});

	const occupancyRows = $derived(
		data.occupancyByProperty.map((row) => [
			row.propertyName,
			row.totalUnits,
			row.occupiedUnits,
			row.vacantUnits,
			row.inactiveUnits,
			percent(row.occupancyRate)
		])
	);

	const occupancyFooter = $derived.by(() => {
		const totals = data.occupancyByProperty.reduce(
			(acc, row) => ({
				total: acc.total + row.totalUnits,
				occupied: acc.occupied + row.occupiedUnits,
				vacant: acc.vacant + row.vacantUnits,
				inactive: acc.inactive + row.inactiveUnits
			}),
			{ total: 0, occupied: 0, vacant: 0, inactive: 0 }
		);
		const rate = totals.total > 0 ? (totals.occupied / totals.total) * 100 : 0;
		return ['Total', totals.total, totals.occupied, totals.vacant, totals.inactive, percent(rate)];
	});

	const maintenanceRows = $derived(
		data.maintenanceByProperty.map((row) => [
			row.propertyName,
			row.openCount,
			row.inProgressCount,
			row.resolvedCount,
			row.closedCount,
			row.total
		])
	);

	const maintenanceFooter = $derived.by(() => {
		const totals = data.maintenanceByProperty.reduce(
			(acc, row) => ({
				open: acc.open + row.openCount,
				inProgress: acc.inProgress + row.inProgressCount,
				resolved: acc.resolved + row.resolvedCount,
				closed: acc.closed + row.closedCount,
				total: acc.total + row.total
			}),
			{ open: 0, inProgress: 0, resolved: 0, closed: 0, total: 0 }
		);
		return ['Total', totals.open, totals.inProgress, totals.resolved, totals.closed, totals.total];
	});

	function exportAllSections() {
		const lines: string[] = [];
		lines.push('KODII Property Report');
		lines.push(`Period: ${data.from} to ${data.to}`);
		lines.push(`Generated: ${new Date().toISOString()}`);
		lines.push('');

		lines.push('--- FINANCIAL SUMMARY ---');
		lines.push(
			toCSV(
				['Expected Rent', 'Confirmed Rent', 'Outstanding', 'Collection Rate'],
				[
					[
						csvKES(data.financialSummary.expectedRent),
						csvKES(data.financialSummary.confirmedRent),
						csvKES(data.financialSummary.outstanding),
						percent(data.financialSummary.collectionRate)
					]
				]
			)
		);
		lines.push('');

		lines.push('--- RENT COLLECTION BY PROPERTY ---');
		lines.push(
			toCSV(
				['Property', 'Units', 'Expected', 'Confirmed', 'Outstanding', 'Rate', 'Overdue'],
				data.rentByProperty.map((row) => [
					row.propertyName,
					row.unitCount,
					csvKES(row.expectedRent),
					csvKES(row.confirmedRent),
					csvKES(row.outstanding),
					percent(row.collectionRate),
					row.overdueCount
				])
			)
		);
		lines.push('');

		lines.push('--- OCCUPANCY ---');
		lines.push(
			toCSV(
				['Property', 'Total', 'Occupied', 'Vacant', 'Inactive', 'Rate'],
				data.occupancyByProperty.map((row) => [
					row.propertyName,
					row.totalUnits,
					row.occupiedUnits,
					row.vacantUnits,
					row.inactiveUnits,
					percent(row.occupancyRate)
				])
			)
		);
		lines.push('');

		lines.push('--- OVERDUE TENANTS ---');
		lines.push(
			toCSV(
				['Tenant', 'Phone', 'Unit', 'Property', 'Amount', 'Days Overdue', 'Last Payment'],
				data.overdueTenants.map((row) => [
					row.tenantName,
					row.tenantPhone,
					row.unitNumber,
					row.propertyName,
					csvKES(row.amountOverdue),
					row.daysOverdue,
					csvDate(row.lastPaymentDate)
				])
			)
		);
		lines.push('');

		lines.push('--- MAINTENANCE ---');
		lines.push(
			toCSV(
				['Property', 'Open', 'In Progress', 'Resolved', 'Closed', 'Total'],
				data.maintenanceByProperty.map((row) => [
					row.propertyName,
					row.openCount,
					row.inProgressCount,
					row.resolvedCount,
					row.closedCount,
					row.total
				])
			)
		);

		downloadCSV(`KODII_Report_${fileRange}.csv`, lines.join('\n'));
	}

	function exportRows(filename: string, headers: string[], rows: (string | number | null)[][]) {
		downloadCSV(filename, toCSV(headers, rows));
	}
</script>

<div class="space-y-0">
	<PageHeader>
		{#snippet left()}
			<DateRangeFilter from={data.from} to={data.to} />
		{/snippet}
		{#snippet right()}
			<Button
				size="sm"
				outline
				color="alternative"
				class="h-9 border-zinc-700 text-zinc-300 hover:bg-zinc-900"
				onclick={exportAllSections}
			>
				Export CSV
			</Button>
		{/snippet}
	</PageHeader>

	<div class="mt-3 mb-0 text-sm text-zinc-500">
		<span>Showing data from</span>
		<span>{fromLabel}</span>
		<span>to</span>
		<span>{toLabel}</span>
	</div>

	<section class="mt-8">
		<div class="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
			<h2 class="text-base font-semibold text-zinc-100">Financial Summary</h2>
		</div>
		<ReportStatCards cards={financialCards} />
	</section>

	<ReportTable
		title="Rent Collection by Property"
		headers={[
			'Property',
			'Units',
			'Expected',
			'Confirmed',
			'Outstanding',
			'Collection Rate',
			'Overdue Count'
		]}
		rows={rentRows}
		footerRow={rentFooter}
		exportFilename={`KODII_${slug('rent_collection')}_${fileRange}.csv`}
		emptyMessage="No rent data for selected period"
	/>

	<section class="mt-8">
		<div class="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
			<h2 class="text-base font-semibold text-zinc-100">Occupancy Summary</h2>
		</div>
		<ReportStatCards cards={occupancyCards} />
	</section>

	<ReportTable
		title="Occupancy by Property"
		headers={['Property', 'Total Units', 'Occupied', 'Vacant', 'Inactive', 'Occupancy Rate']}
		rows={occupancyRows}
		footerRow={occupancyFooter}
		exportFilename={`KODII_${slug('occupancy')}_${fileRange}.csv`}
		emptyMessage="No occupancy data for selected period"
	/>

	<section class="mt-8">
		<div
			class="mb-4 flex flex-col gap-3 border-b border-zinc-800 pb-3 sm:flex-row sm:items-center sm:justify-between"
		>
			<div>
				<h3 class="text-base font-semibold text-zinc-100">Overdue Tenants</h3>
				<p class="mt-0.5 text-xs text-zinc-500">Tenants with unpaid rent past due date</p>
			</div>
			<button
				type="button"
				class="w-fit rounded-md border border-zinc-700 bg-zinc-950/70 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
				onclick={() =>
					exportRows(
						`KODII_${slug('overdue_tenants')}_${fileRange}.csv`,
						[
							'Tenant',
							'Phone',
							'Unit',
							'Property',
							'Amount Overdue',
							'Days Overdue',
							'Last Payment'
						],
						data.overdueTenants.map((row) => [
							row.tenantName,
							row.tenantPhone,
							row.unitNumber,
							row.propertyName,
							csvKES(row.amountOverdue),
							row.daysOverdue,
							csvDate(row.lastPaymentDate)
						])
					)}
			>
				Export CSV
			</button>
		</div>

		<div class="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/60">
			<div class="overflow-x-auto">
				<Table hoverable={true} class="min-w-[980px]">
					<thead class="text-xs font-medium tracking-wider text-zinc-500 uppercase">
						<tr>
							<th class="px-4 py-3 text-left">Tenant</th>
							<th class="px-4 py-3 text-left">Phone</th>
							<th class="px-4 py-3 text-left">Unit</th>
							<th class="px-4 py-3 text-left">Property</th>
							<th class="px-4 py-3 text-left">Amount Overdue</th>
							<th class="px-4 py-3 text-left">Days Overdue</th>
							<th class="px-4 py-3 text-left">Last Payment</th>
						</tr>
					</thead>
					<tbody>
						{#if data.overdueTenants.length === 0}
							<tr>
								<td colspan="7" class="px-4 py-6 text-center text-sm text-zinc-400">
									<span class="inline-flex items-center gap-1">
										<CheckCircleOutline class="h-4 w-4 text-emerald-400" />
										No overdue tenants
									</span>
								</td>
							</tr>
						{:else}
							{#each data.overdueTenants as tenant (tenant.tenantId)}
								<OverdueTenantRow {tenant} />
							{/each}
						{/if}
					</tbody>
				</Table>
			</div>
		</div>
	</section>

	<section class="mt-8">
		<div
			class="mb-4 flex flex-col gap-3 border-b border-zinc-800 pb-3 sm:flex-row sm:items-center sm:justify-between"
		>
			<div>
				<h3 class="text-base font-semibold text-zinc-100">Pending Verifications</h3>
				<p class="mt-0.5 text-xs text-zinc-500">Payments submitted but not yet verified</p>
			</div>
			<div class="flex items-center gap-3">
				<button
					type="button"
					class="w-fit rounded-md border border-zinc-700 bg-zinc-950/70 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
					onclick={() =>
						exportRows(
							`KODII_${slug('pending_verifications')}_${fileRange}.csv`,
							['Tenant', 'Unit', 'Amount', 'M-Pesa Code', 'Submitted'],
							data.pendingPayments.rows.map((row) => [
								row.tenantName,
								row.unitNumber,
								csvKES(row.amount),
								row.mpesaCode ?? '',
								row.submittedAt ? row.submittedAt.toISOString().slice(0, 10) : ''
							])
						)}
				>
					Export CSV
				</button>
				<a href={resolve('/payments?verify=1')} class="text-sm text-emerald-400 hover:underline">
					Go to Verify →
				</a>
			</div>
		</div>

		<div class="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/60">
			<div class="overflow-x-auto">
				<Table hoverable={true} class="min-w-[820px]">
					<thead class="text-xs font-medium tracking-wider text-zinc-500 uppercase">
						<tr>
							<th class="px-4 py-3 text-left">Tenant</th>
							<th class="px-4 py-3 text-left">Unit</th>
							<th class="px-4 py-3 text-left">Amount</th>
							<th class="px-4 py-3 text-left">M-Pesa Code</th>
							<th class="px-4 py-3 text-left">Submitted</th>
						</tr>
					</thead>
					<tbody>
						{#if data.pendingPayments.rows.length === 0}
							<tr>
								<td colspan="5" class="px-4 py-6 text-center text-sm text-zinc-400">
									<span class="inline-flex items-center gap-1">
										<CheckCircleOutline class="h-4 w-4 text-emerald-400" />
										No pending payments
									</span>
								</td>
							</tr>
						{:else}
							{#each data.pendingPayments.rows as row (row.id)}
								<tr class="border-t border-zinc-800 text-sm text-zinc-300">
									<td class="px-4 py-3">{row.tenantName}</td>
									<td class="px-4 py-3">{row.unitNumber}</td>
									<td class="px-4 py-3 font-medium text-zinc-100">{formatKES(row.amount)}</td>
									<td class="px-4 py-3 font-mono text-xs">{row.mpesaCode ?? '—'}</td>
									<td class="px-4 py-3 text-xs text-zinc-500">
										{row.submittedAt ? row.submittedAt.toLocaleDateString('en-KE') : '—'}
									</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</Table>
			</div>
		</div>

		{#if data.pendingPayments.totalCount > data.pendingPayments.rows.length}
			<a
				href={resolve('/payments?verify=1')}
				class="text-sm text-emerald-400 hover:text-emerald-300"
			>
				View all pending →
			</a>
		{/if}
	</section>

	<section class="mt-8">
		<div class="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
			<h2 class="text-base font-semibold text-zinc-100">Maintenance Summary</h2>
		</div>
		<ReportStatCards cards={maintenanceCards} />
	</section>

	<ReportTable
		title="Maintenance by Property"
		headers={['Property', 'Open', 'In Progress', 'Resolved', 'Closed', 'Total']}
		rows={maintenanceRows}
		footerRow={maintenanceFooter}
		exportFilename={`KODII_${slug('maintenance')}_${fileRange}.csv`}
		emptyMessage="No maintenance tickets for selected period"
	/>
</div>
