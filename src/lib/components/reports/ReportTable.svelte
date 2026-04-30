<script lang="ts">
	import { Table } from 'flowbite-svelte';
	import { downloadCSV, toCSV } from '$lib/utils/csv';

	interface Props {
		title: string;
		subtitle?: string;
		headers: string[];
		rows: (string | number | null)[][];
		exportFilename: string;
		emptyMessage: string;
		footerRow?: (string | number | null)[] | null;
	}

	let {
		title,
		subtitle,
		headers,
		rows,
		exportFilename,
		emptyMessage,
		footerRow = null
	}: Props = $props();

	function exportSection() {
		const content = toCSV(headers, rows);
		downloadCSV(exportFilename, content);
	}
</script>

<section class="mt-8">
	<div
		class="mb-4 flex flex-col gap-3 border-b border-zinc-800 pb-3 sm:flex-row sm:items-center sm:justify-between"
	>
		<div>
			<h3 class="text-base font-semibold text-zinc-100">{title}</h3>
			{#if subtitle}
				<p class="mt-0.5 text-xs text-zinc-500">{subtitle}</p>
			{/if}
		</div>
		<button
			type="button"
			class="w-fit rounded-md border border-zinc-700 bg-zinc-950/70 px-3 py-1.5 text-xs text-zinc-300 transition hover:border-zinc-500 hover:bg-zinc-900 hover:text-zinc-100"
			onclick={() => exportSection()}
		>
			Export CSV
		</button>
	</div>

	<div class="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-950/60">
		<div class="overflow-x-auto">
			<Table hoverable={true} class="min-w-[900px]">
				<thead class="text-xs font-medium tracking-wider text-zinc-400 uppercase">
					<tr>
						{#each headers as header}
							<th class="px-4 py-3 text-left">{header}</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					{#if rows.length === 0}
						<tr>
							<td colspan={headers.length} class="px-4 py-6 text-center text-sm text-zinc-500"
								>{emptyMessage}</td
							>
						</tr>
					{:else}
						{#each rows as row}
							<tr class="border-t border-zinc-800 text-sm text-zinc-300">
								{#each row as cell}
									<td class="px-4 py-3">{cell ?? '—'}</td>
								{/each}
							</tr>
						{/each}
					{/if}
				</tbody>
				{#if footerRow && rows.length > 0}
					<tfoot class="border-t border-zinc-700 text-sm font-medium text-zinc-100">
						<tr>
							{#each footerRow as cell}
								<td class="px-4 py-3">{cell ?? '—'}</td>
							{/each}
						</tr>
					</tfoot>
				{/if}
			</Table>
		</div>
	</div>
</section>
