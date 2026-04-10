<script lang="ts">
	import { resolve } from '$app/paths'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()
	const displayName = $derived(data.user?.name ?? 'there')
</script>

<main class="p-6 md:p-8">
	<section class="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
		<div class="mb-4 flex justify-end">
			<a
				href={resolve('/logout')}
				class="inline-flex items-center rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100"
			>
				Logout
			</a>
		</div>
		<h1 class="text-2xl font-semibold text-zinc-900">Welcome, {displayName}</h1>
		<p class="mt-2 text-zinc-600">You're now in your dashboard.</p>
	</section>
</main>
