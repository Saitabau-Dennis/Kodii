<script lang="ts">
	type ReportCard = {
		title: string;
		value: string;
		subtitle: string;
		color?: 'default' | 'green' | 'amber' | 'red';
	};

	interface Props {
		cards: ReportCard[];
	}

	let { cards }: Props = $props();
</script>

<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
	{#each cards as card}
		<div class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
			<p class="text-sm font-medium text-zinc-400">{card.title}</p>
			<p
				class={`mt-2 text-2xl font-bold ${
					card.color === 'amber'
						? 'text-amber-300'
						: card.color === 'red'
							? 'text-red-400'
							: 'text-zinc-100'
				}`}
			>
				{card.value}
			</p>
			<p class="mt-1 text-xs text-zinc-500">{card.subtitle}</p>
		</div>
	{/each}
</div>
