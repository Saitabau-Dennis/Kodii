<script lang="ts">
	import { resolve } from '$app/paths';
	import Navbar from '$lib/components/ui/navbar.svelte';
</script>

<main class="relative min-h-screen overflow-hidden">
	<div class="pointer-events-none absolute inset-y-0 left-[12%] w-px bg-zinc-800/70"></div>
	<div class="pointer-events-none absolute inset-y-0 right-[12%] w-px bg-zinc-800/70"></div>

	<section class="relative mx-[12%] min-h-screen">
		<div class="absolute top-10 right-8 left-8 md:right-12 md:left-12">
			<Navbar />
		</div>
		<div class="pointer-events-none absolute inset-x-0 top-24 h-px bg-zinc-800"></div>
		<div
			class="pointer-events-none absolute top-24 left-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rotate-45 border border-zinc-700 bg-black"
		></div>
		<div
			class="pointer-events-none absolute top-24 right-0 h-2.5 w-2.5 translate-x-1/2 -translate-y-1/2 rotate-45 border border-zinc-700 bg-black"
		></div>
		<div class="min-h-screen">
			<div class="flex w-full flex-col px-8 pt-44 pb-24 md:px-12 md:pt-52 md:pb-28">
				<h1
					class="max-w-2xl text-2xl leading-[1.05] font-normal tracking-tight text-zinc-100 md:text-7xl"
				>
					The Property Tool
					<br />
					for Rental
					<br />
					Operations
				</h1>
				<p class="mt-8 max-w-2xl text-lg leading-7 text-zinc-400">
					KODII helps landlords, caretakers, and agents run rent tracking, payment verification,
					tenant communication, maintenance tickets, and basic reporting from one system.
				</p>

				<div class="mt-10 flex flex-wrap gap-4">
					<a
						class="inline-block rounded-xl border-2 border-emerald-500 px-6 py-3 text-lg font-normal text-zinc-100 transition hover:bg-emerald-500/10"
						href={resolve('/auth/better-auth/register')}>Get Started</a
					>
				</div>
			</div>
		</div>
		<div class="pointer-events-none absolute inset-x-0 bottom-22 h-px bg-zinc-800"></div>
		<div
			class="pointer-events-none absolute bottom-22 left-0 h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rotate-45 border border-zinc-700 bg-black"
		></div>
		<div
			class="pointer-events-none absolute right-0 bottom-22 h-2.5 w-2.5 translate-x-1/2 translate-y-1/2 rotate-45 border border-zinc-700 bg-black"
		></div>
	</section>
</main>
