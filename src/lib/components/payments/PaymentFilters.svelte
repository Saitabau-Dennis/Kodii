<script lang="ts">
	import { Select } from 'flowbite-svelte';
	import { SearchOutline } from 'flowbite-svelte-icons';

	interface PropertyItem {
		id: string;
		name: string;
	}

	interface Props {
		properties: PropertyItem[];
		selectedProperty: string;
		selectedStatus: string;
		searchQuery: string;
		onPropertyChange: (value: string) => void;
		onStatusChange: (value: string) => void;
		onSearchChange: (value: string) => void;
	}

	let {
		properties,
		selectedProperty,
		selectedStatus,
		searchQuery,
		onPropertyChange,
		onStatusChange,
		onSearchChange
	}: Props = $props();

	const statusPills = [
		{ value: 'all', label: 'All' },
		{ value: 'pending_verification', label: 'Pending' },
		{ value: 'paid', label: 'Paid' },
		{ value: 'partial', label: 'Partial' },
		{ value: 'overdue', label: 'Overdue' },
		{ value: 'rejected', label: 'Rejected' }
	];

	const inactivePillClass =
		'border-zinc-700 bg-zinc-950/70 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100';
	const controlClass =
		'w-full rounded-md border border-zinc-700 bg-zinc-950/70 px-3 py-1.5 text-sm text-zinc-200 [&>option]:bg-zinc-950 [&>option]:text-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/30';

	function handlePropertyChange(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value;
		onPropertyChange(value);
	}

	function handleSearch(event: Event) {
		const value = (event.currentTarget as HTMLInputElement).value;
		onSearchChange(value);
	}
</script>

<div class="flex flex-col gap-4">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<div class="flex flex-wrap items-center gap-2">
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

		<div class="flex items-center gap-3">
			<Select
				items={[
					{ name: 'All Properties', value: '' },
					...properties.map((property) => ({ name: property.name, value: property.id }))
				]}
				value={selectedProperty}
				onchange={handlePropertyChange}
				class="h-9 w-48 text-sm"
				classes={{
					select: controlClass
				}}
			/>
		</div>
	</div>

	<div class="relative w-full md:max-w-md">
		<div class="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
			<SearchOutline class="h-3.5 w-3.5 text-zinc-500" />
		</div>
		<input
			type="text"
			value={searchQuery}
			oninput={handleSearch}
			placeholder="Search by tenant, unit, phone or M-Pesa code..."
			class="h-9 w-full rounded-md border border-zinc-700 bg-zinc-950/70 py-1.5 pr-3 pl-9 text-sm text-zinc-100 placeholder-zinc-500 focus:border-emerald-500 focus:ring-emerald-500/30"
		/>
	</div>
</div>
