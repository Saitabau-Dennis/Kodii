<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Button, PaginationNav, Table } from 'flowbite-svelte';
	import { BellOutline, CalendarMonthOutline } from 'flowbite-svelte-icons';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import NoticeRow from '$lib/components/notices/NoticeRow.svelte';

	let { data } = $props() as { data: any };

	const targetPills: Array<{ value: string; label: string }> = [
		{ value: 'all', label: 'All' },
		{ value: 'all_tenants', label: 'All Tenants' },
		{ value: 'property', label: 'Property' },
		{ value: 'unit', label: 'Unit' },
		{ value: 'tenant', label: 'Tenant' }
	];

	const selectedTarget = $derived(data.selectedTarget ?? 'all');
	const selectedFrom = $derived(data.selectedFrom ?? '');
	const selectedTo = $derived(data.selectedTo ?? '');
	const hasFilters = $derived(
		selectedTarget !== 'all' || Boolean(selectedFrom) || Boolean(selectedTo)
	);
	const startItem = $derived(data.totalCount === 0 ? 0 : (data.currentPage - 1) * 10 + 1);
	const endItem = $derived(Math.min(data.currentPage * 10, data.totalCount));
	const inactivePillClass =
		'border-zinc-700 bg-zinc-950/70 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100';

	function buildUrl(next: { page?: number; target?: string; from?: string; to?: string }) {
		const params = new URLSearchParams(page.url.searchParams);

		if (next.page && next.page > 1) params.set('page', String(next.page));
		else params.delete('page');

		const target = next.target ?? selectedTarget;
		if (target && target !== 'all') params.set('target', target);
		else params.delete('target');

		const from = next.from ?? selectedFrom;
		if (from) params.set('from', from);
		else params.delete('from');

		const to = next.to ?? selectedTo;
		if (to) params.set('to', to);
		else params.delete('to');

		const query = params.toString();
		return `${resolve('/notices')}${query ? `?${query}` : ''}`;
	}

	function handlePageChange(nextPage: number) {
		goto(buildUrl({ page: nextPage }));
	}

	function setTarget(target: string) {
		goto(buildUrl({ target, page: 1 }));
	}

	function setFromDate(event: Event) {
		const value = (event.currentTarget as HTMLInputElement).value;
		goto(buildUrl({ from: value, page: 1 }));
	}

	function setToDate(event: Event) {
		const value = (event.currentTarget as HTMLInputElement).value;
		goto(buildUrl({ to: value, page: 1 }));
	}
</script>

<PageHeader>
	{#snippet left()}
		<div class="flex flex-wrap items-center gap-2">
			{#each targetPills as pill}
				<button
					type="button"
					class={`rounded-md border px-3 py-1.5 text-sm whitespace-nowrap transition ${
						selectedTarget === pill.value
							? 'border-emerald-500 bg-emerald-500/15 bg-[repeating-linear-gradient(45deg,rgba(16,185,129,0.18)_0,rgba(16,185,129,0.18)_1px,transparent_1px,transparent_10px),repeating-linear-gradient(-45deg,rgba(16,185,129,0.14)_0,rgba(16,185,129,0.14)_1px,transparent_1px,transparent_10px)] text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
							: inactivePillClass
					}`}
					onclick={() => setTarget(pill.value)}
				>
					{pill.label}
				</button>
			{/each}

			<div class="flex items-center gap-2 border-l border-zinc-800 pl-2">
				<input
					type="date"
					value={selectedFrom}
					onchange={setFromDate}
					class="h-9 w-36 rounded-md border border-zinc-700 bg-zinc-950/70 px-3 py-1.5 text-sm text-zinc-200 transition outline-none focus:border-emerald-500 focus:ring-emerald-500/30"
					placeholder="From"
				/>
				<span class="text-xs text-zinc-500">to</span>
				<input
					type="date"
					value={selectedTo}
					onchange={setToDate}
					class="h-9 w-36 rounded-md border border-zinc-700 bg-zinc-950/70 px-3 py-1.5 text-sm text-zinc-200 transition outline-none focus:border-emerald-500 focus:ring-emerald-500/30"
					placeholder="To"
				/>
				{#if hasFilters}
					<a
						href={resolve('/notices')}
						class="ml-1 text-[10px] font-medium tracking-wider text-emerald-500 uppercase hover:text-emerald-400"
					>
						Clear
					</a>
				{/if}
			</div>
		</div>
	{/snippet}

	{#snippet right()}
		<a href="/notices/send">
			<Button color="primary" size="sm">Send Notice</Button>
		</a>
	{/snippet}
</PageHeader>

<div class="mb-3 text-xs text-zinc-500">
	Showing {startItem} to {endItem} of {data.totalCount} notices
</div>

{#if data.notices.length === 0}
	<EmptyState message="No notices sent yet" icon={BellOutline} />
	<div class="mt-3 flex justify-center">
		<a href="/notices/send">
			<Button color="primary" size="sm">Send your first notice</Button>
		</a>
	</div>
{:else}
	<div class="rounded-lg border border-zinc-800 bg-zinc-950/70">
		<div class="overflow-x-auto">
			<Table hoverable={true} class="min-w-[1040px]">
				<thead class="bg-zinc-900 text-xs text-zinc-400 uppercase">
					<tr>
						<th class="px-4 py-3 text-left">Title</th>
						<th class="px-4 py-3 text-left">Target</th>
						<th class="px-4 py-3 text-left">Sent By</th>
						<th class="px-4 py-3 text-left">Sent At</th>
						<th class="px-4 py-3 text-left">Replies</th>
						<th class="px-4 py-3 text-left">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.notices as notice (notice.id)}
						<NoticeRow {notice} />
					{/each}
				</tbody>
			</Table>
		</div>
	</div>
{/if}

{#if data.totalPages > 1}
	<div class="mt-4 flex justify-center sm:justify-end">
		<PaginationNav
			currentPage={data.currentPage}
			totalPages={data.totalPages}
			onPageChange={handlePageChange}
		/>
	</div>
{/if}
