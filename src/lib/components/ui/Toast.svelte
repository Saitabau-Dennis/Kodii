<script lang="ts">
	import { fade, fly } from 'svelte/transition';
	import { toastStore } from '$lib/stores/toast';
</script>

<div class="pointer-events-none fixed top-4 left-1/2 z-[1000] w-full max-w-md -translate-x-1/2 px-4">
	{#each $toastStore as toast (toast.id)}
		<div
			class={`pointer-events-auto mt-2 flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg backdrop-blur ${
				toast.type === 'success'
					? 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100'
					: 'border-red-500/40 bg-red-950/90 text-red-100'
			}`}
			in:fly={{ y: -12, duration: 180 }}
			out:fade={{ duration: 150 }}
		>
			<p class="m-0">{toast.message}</p>
			<button
				type="button"
				class="cursor-pointer rounded-md px-2 py-1 text-xs opacity-90 transition hover:opacity-100"
				onclick={() => toastStore.remove(toast.id)}
			>
				Close
			</button>
		</div>
	{/each}
</div>
