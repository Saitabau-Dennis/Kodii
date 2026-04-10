<script lang="ts">
	import { resolve } from '$app/paths';
</script>

<nav class="flex w-full items-center justify-between">
	<span
		class="px-3 py-2 text-2xl leading-none font-black tracking-[0.16em] text-zinc-100 uppercase drop-shadow-[0_0_12px_rgba(16,185,129,0.28)] md:text-3xl" style="font-family: 'Orbitron', 'Onest', sans-serif;"
		>KODII</span
	>

	<a
		class="inline-block rounded-xl border-2 border-emerald-500 px-5 py-2 text-base font-normal text-zinc-100 transition hover:bg-emerald-500/10"
		href={resolve('/register')}>Get Started</a
	>
</nav>
