<script lang="ts">
	import { resolve } from '$app/paths';
	import Navbar from '$lib/components/ui/navbar.svelte';
</script>

<main class="relative min-h-screen overflow-hidden">
	<div
		class="pointer-events-none absolute inset-y-0 left-[12%] w-px bg-gradient-to-b from-transparent via-zinc-700 to-transparent"
	></div>
	<div
		class="pointer-events-none absolute inset-y-0 left-[12%] w-px bg-gradient-to-b from-transparent via-emerald-500/30 to-transparent blur-[1px]"
	></div>
	<div
		class="pointer-events-none absolute inset-y-0 right-[12%] w-px bg-gradient-to-b from-transparent via-zinc-700 to-transparent"
	></div>
	<div
		class="pointer-events-none absolute inset-y-0 right-[12%] w-px bg-gradient-to-b from-transparent via-cyan-500/25 to-transparent blur-[1px]"
	></div>
	<div
		class="pointer-events-none absolute top-28 left-1/2 h-64 w-64 -translate-x-1/2 rounded-full bg-emerald-500/15 blur-3xl"
	></div>
	<div
		class="pointer-events-none absolute right-[18%] bottom-24 h-40 w-40 rounded-full bg-cyan-500/10 blur-3xl"
	></div>

	<section class="relative mx-[12%] min-h-screen">
		<div class="absolute top-10 right-8 left-8 md:right-12 md:left-12">
			<Navbar />
		</div>
		<div class="flex min-h-screen items-center justify-center px-8 pt-28 pb-28 md:px-12 md:pt-36">
			<div class="mx-auto max-w-4xl -translate-y-8 text-center md:-translate-y-10">
				<h1 class="text-4xl leading-[1.05] tracking-tight text-zinc-100 md:text-6xl lg:text-7xl">
					The Property Tool for
					<br class="hidden sm:block" />
					<span class="text-emerald-400">Payments, Maintenance</span> and Notices
				</h1>
				<p class="mx-auto mt-8 max-w-2xl text-base leading-7 text-zinc-300 md:text-lg">
					KODII helps landlords and caretakers manage rent collection, payment verification, maintenance
					reporting, and tenant notices from one clear dashboard.
				</p>

				<div class="mt-10 flex flex-wrap items-center justify-center gap-4">
					<a
						class="inline-flex min-w-40 items-center justify-center rounded-xl border-2 border-emerald-500 bg-emerald-500/10 px-6 py-3 text-base font-medium text-zinc-100 transition hover:bg-emerald-500/20"
						href={resolve('/register')}>Get Started</a
					>
					<a
						class="inline-flex min-w-40 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-900/70 px-6 py-3 text-base font-medium text-zinc-200 transition hover:border-zinc-500 hover:text-zinc-100"
						href={resolve('/login')}>Sign In</a
					>
				</div>
			</div>
		</div>
	</section>
</main>
