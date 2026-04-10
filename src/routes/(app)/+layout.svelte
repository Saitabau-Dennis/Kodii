<script lang="ts">
	import { resolve } from '$app/paths'
	let { children } = $props()
</script>

<div class="min-h-screen bg-black text-zinc-100">
	<header class="mx-auto flex w-full max-w-6xl justify-end px-4 pt-4 md:px-6">
		<a
			href={resolve('/logout')}
			class="inline-flex items-center rounded-lg border border-zinc-700 px-3 py-1.5 text-sm font-medium text-zinc-200 transition hover:bg-zinc-900"
		>
			Logout
		</a>
	</header>
	{@render children()}
</div>
