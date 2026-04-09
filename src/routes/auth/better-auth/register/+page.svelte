<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import type { ActionData } from './$types';

	let { form }: { form: ActionData } = $props();
</script>

<main
	class="relative grid min-h-screen content-start justify-items-center overflow-hidden bg-black px-6 pt-8 pb-10 md:pt-12"
>
	<div class="pointer-events-none absolute inset-y-0 left-[12%] w-px bg-zinc-700/55"></div>
	<div class="pointer-events-none absolute inset-y-0 right-[12%] w-px bg-zinc-700/55"></div>

	<div
		class="pointer-events-none absolute -top-28 left-[8%] h-72 w-72 rounded-full bg-white/10 blur-3xl"
	></div>
	<div
		class="pointer-events-none absolute right-[6%] -bottom-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl"
	></div>

	<section class="relative z-10 grid w-full max-w-5xl gap-4 lg:grid-cols-[1.05fr_1fr]">
		<aside class="rounded-[18px] border border-zinc-800 bg-zinc-950/90 p-7 backdrop-blur-md lg:p-8">
			<h1 class="m-0 text-3xl leading-tight font-normal text-zinc-50 md:text-4xl">
				Create your dashboard account.
			</h1>
			<p class="mt-4 max-w-[45ch] text-zinc-400">
				Set up your account to access secure dashboard features.
			</p>
		</aside>

		<section
			class="rounded-[18px] border border-zinc-800 bg-zinc-950/90 p-6 backdrop-blur-md lg:p-8"
		>
			<div>
				<h2 class="m-0 text-xl font-normal text-zinc-50">Create Account</h2>
				<p class="mt-1 text-sm text-zinc-400">Use your name, email, and password.</p>
			</div>

			<form method="post" action="?/signUpEmail" use:enhance class="mt-4 grid gap-4">
				<label class="grid gap-2">
					<span class="text-sm text-zinc-300">Name</span>
					<input
						type="text"
						name="name"
						autocomplete="name"
						required
						class="w-full rounded-[10px] border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-zinc-50 transition outline-none focus:border-emerald-400"
					/>
				</label>

				<label class="grid gap-2">
					<span class="text-sm text-zinc-300">Email</span>
					<input
						type="email"
						name="email"
						autocomplete="email"
						required
						class="w-full rounded-[10px] border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-zinc-50 transition outline-none focus:border-emerald-400"
					/>
				</label>

				<label class="grid gap-2">
					<span class="text-sm text-zinc-300">Password</span>
					<input
						type="password"
						name="password"
						autocomplete="new-password"
						required
						class="w-full rounded-[10px] border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-zinc-50 transition outline-none focus:border-emerald-400"
					/>
				</label>

				{#if form?.message}
					<p
						class="rounded-[10px] border border-red-900 bg-red-950/40 px-3 py-2.5 text-sm text-red-300"
					>
						{form.message}
					</p>
				{/if}

				<div class="mt-1">
					<button
						type="submit"
						class="w-full cursor-pointer rounded-[10px] border border-transparent bg-emerald-500 px-4 py-2.5 font-normal text-emerald-950 transition hover:-translate-y-px hover:brightness-105"
					>
						Create account
					</button>
				</div>

				<p class="text-sm text-zinc-400">
					Already have an account?
					<a
						class="text-emerald-400 hover:text-emerald-300"
						href={resolve('/auth/better-auth/login')}>Sign in</a
					>
				</p>
			</form>
		</section>
	</section>
</main>
