<script lang="ts">
	import { goto } from '$app/navigation'
	import { onMount } from 'svelte'
	import type { PageData } from './$types'

	let { data }: { data: PageData } = $props()
	let checking = $state(true)
	let redirecting = $state(false)

	onMount(() => {
		const timer = setTimeout(() => {
			if (!data.hasSession) {
				checking = false
				redirecting = true
				void goto('/login')
				return
			}

			checking = false
		}, 1000)

		return () => clearTimeout(timer)
	})

	function continueAction() {
		if (checking || redirecting || !data.hasSession) return
		redirecting = true
		void goto('/dashboard')
	}
</script>

<main class="relative grid min-h-screen content-start justify-items-center overflow-hidden bg-black px-6 pt-8 md:pt-12">
	<div class="pointer-events-none absolute inset-y-0 left-[12%] w-px bg-zinc-700/55"></div>
	<div class="pointer-events-none absolute inset-y-0 right-[12%] w-px bg-zinc-700/55"></div>

	<div class="pointer-events-none absolute -top-24 left-[10%] h-72 w-72 rounded-full bg-white/10 blur-3xl"></div>
	<div
		class="pointer-events-none absolute right-[7%] -bottom-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl"
	></div>

	<section class="mt-20 w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-950/95 p-6 text-center shadow-[0_30px_90px_rgba(0,0,0,0.45)] backdrop-blur-md md:mt-24">
		<div class="mx-auto mb-3 inline-flex items-center rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm font-semibold tracking-wide text-zinc-100">
			KODII
		</div>
		<p class="mt-2 text-sm text-zinc-400">
			{#if data.hasSession}
				{data.user?.name}, you're already signed in.
			{:else}
				No active session found.
			{/if}
		</p>

		<button
			type="button"
			onclick={continueAction}
			disabled={checking || redirecting || !data.hasSession}
			class="mt-6 inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-2xl bg-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-900 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-80"
		>
			{#if checking}
				<span class="h-5 w-5 animate-spin rounded-full border-2 border-zinc-500 border-t-zinc-900"></span>
				Checking session...
			{:else if redirecting}
				<span class="h-5 w-5 animate-spin rounded-full border-2 border-zinc-500 border-t-zinc-900"></span>
				Redirecting...
			{:else if data.hasSession}
				<span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white">
					<svg viewBox="0 0 20 20" fill="none" class="h-3 w-3" aria-hidden="true">
						<path d="M7 4l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</span>
				Continue using the app
			{:else}
				<span class="inline-flex h-5 w-5 items-center justify-center rounded-full bg-zinc-900 text-white">
					<svg viewBox="0 0 20 20" fill="none" class="h-3 w-3" aria-hidden="true">
						<path d="M7 4l6 6-6 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
					</svg>
				</span>
				Login
			{/if}
		</button>

	</section>
</main>
