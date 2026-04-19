<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<nav class="flex w-full items-center justify-between gap-3">
	<span
		class="px-2 py-1.5 text-xl leading-none font-black tracking-[0.12em] text-zinc-100 uppercase drop-shadow-[0_0_12px_rgba(16,185,129,0.28)] sm:px-3 sm:py-2 sm:text-2xl sm:tracking-[0.16em] md:text-3xl" style="font-family: 'Orbitron', 'Onest', sans-serif;"
		>KODII</span
	>

	<a
		class="inline-block rounded-lg border-2 border-emerald-500 px-3 py-1.5 text-sm font-normal text-zinc-100 transition hover:bg-emerald-500/10 sm:rounded-xl sm:px-5 sm:py-2 sm:text-base"
		href={resolve('/register')}>Get Started</a
	>
</nav>
