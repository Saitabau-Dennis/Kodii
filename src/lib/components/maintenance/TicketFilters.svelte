<script lang="ts">
	import { resolve } from '$app/paths';
	import { Select } from 'flowbite-svelte';

	interface PropertyItem {
		id: string;
		name: string;
	}

	interface Props {
		properties: PropertyItem[];
		selectedProperty: string;
		selectedStatus: string;
		selectedCategory: string;
		clearHref?: string;
		onPropertyChange: (value: string) => void;
		onStatusChange: (value: string) => void;
		onCategoryChange: (value: string) => void;
	}

	let {
		properties,
		selectedProperty,
		selectedStatus,
		selectedCategory,
		clearHref = resolve('/maintenance'),
		onPropertyChange,
		onStatusChange,
		onCategoryChange
	}: Props = $props();

	const statusPills = [
		{ value: 'all', label: 'All' },
		{ value: 'open', label: 'Open' },
		{ value: 'in_progress', label: 'In Progress' },
		{ value: 'resolved', label: 'Resolved' },
		{ value: 'closed', label: 'Closed' }
	];

	const categoryPills = [
		{ value: 'all', label: 'All' },
		{ value: 'water', label: 'Water' },
		{ value: 'electricity', label: 'Electricity' },
		{ value: 'plumbing', label: 'Plumbing' },
		{ value: 'security', label: 'Security' },
		{ value: 'other', label: 'Other' }
	];

	const inactivePillClass =
		'border-zinc-700 bg-zinc-950/70 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100';
	const controlClass =
		'w-full rounded-md border border-zinc-700 bg-zinc-950/70 px-3 py-1.5 text-sm text-zinc-200 [&>option]:bg-zinc-950 [&>option]:text-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/30';

	const hasFilters = $derived(
		Boolean(selectedProperty) || selectedStatus !== 'all' || selectedCategory !== 'all'
	);

	function handlePropertyChange(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value;
		onPropertyChange(value);
	}
</script>

<div class="flex flex-col gap-3">
	<div class="flex flex-wrap items-center gap-2">
		<div class="flex items-center gap-2">
			{#each statusPills as pill}
				<button
					type="button"
					class={`rounded-md border px-3 py-1.5 text-sm whitespace-nowrap transition ${
						selectedStatus === pill.value
							? 'border-emerald-500 bg-emerald-500/15 bg-[repeating-linear-gradient(45deg,rgba(16,185,129,0.18)_0,rgba(16,185,129,0.18)_1px,transparent_1px,transparent_10px),repeating-linear-gradient(-45deg,rgba(16,185,129,0.14)_0,rgba(16,185,129,0.14)_1px,transparent_1px,transparent_10px)] text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
							: inactivePillClass
					}`}
					onclick={() => onStatusChange(pill.value)}
				>
					{pill.label}
				</button>
			{/each}
		</div>

		<div class="flex items-center gap-2 border-l border-zinc-800 pl-2">
			{#each categoryPills as pill}
				<button
					type="button"
					class={`rounded-md border px-3 py-1.5 text-sm whitespace-nowrap transition ${
						selectedCategory === pill.value
							? 'border-emerald-500 bg-emerald-500/15 bg-[repeating-linear-gradient(45deg,rgba(16,185,129,0.18)_0,rgba(16,185,129,0.18)_1px,transparent_1px,transparent_10px),repeating-linear-gradient(-45deg,rgba(16,185,129,0.14)_0,rgba(16,185,129,0.14)_1px,transparent_1px,transparent_10px)] text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
							: inactivePillClass
					}`}
					onclick={() => onCategoryChange(pill.value)}
				>
					{pill.label}
				</button>
			{/each}
		</div>
	</div>

	<div class="flex items-center gap-3">
		<Select
			items={[
				{ name: 'Choose Property', value: '' },
				...properties.map((property) => ({ name: property.name, value: property.id }))
			]}
			value={selectedProperty}
			onchange={handlePropertyChange}
			class="h-9 w-48 text-sm"
			classes={{
				select: controlClass
			}}
		/>

		{#if hasFilters}
			<a
				href={clearHref}
				class="text-[11px] font-medium tracking-wider text-emerald-500 uppercase hover:text-emerald-400"
			>
				Clear Filters
			</a>
		{/if}
	</div>
</div>
