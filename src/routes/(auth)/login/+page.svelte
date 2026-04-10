<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	const LOGIN_DRAFT_KEY = 'kodii_auth_login_draft';

	let identifier = $state('');
	let showPassword = $state(false);
	let isSubmitting = $state(false);

	onMount(() => {
		if (!browser) return;
		const raw = sessionStorage.getItem(LOGIN_DRAFT_KEY);
		if (!raw) return;

		try {
			const draft = JSON.parse(raw) as { identifier?: string };
			identifier = draft.identifier ?? '';
		} catch {
			sessionStorage.removeItem(LOGIN_DRAFT_KEY);
		}
	});

	$effect(() => {
		if (!browser) return;
		sessionStorage.setItem(LOGIN_DRAFT_KEY, JSON.stringify({ identifier }));
	});

	function handleSubmit() {
		isSubmitting = true;

		return async ({
			result,
			update
		}: {
			result: { type: 'success' | 'failure' | 'redirect' | 'error' };
			update: () => Promise<void>;
		}) => {
			await update();
			if (result.type === 'success' || result.type === 'redirect') {
				identifier = '';
				showPassword = false;
				if (browser) {
					sessionStorage.removeItem(LOGIN_DRAFT_KEY);
				}
			}
			isSubmitting = false;
		};
	}

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
				Welcome back to KODII.
			</h1>
			<p class="mt-4 max-w-[45ch] text-zinc-400">
				Sign in to continue managing properties, tenants, and payments.
			</p>
		</aside>

		<section
			class="rounded-[18px] border border-zinc-800 bg-zinc-950/90 p-6 backdrop-blur-md lg:p-8"
		>
			<div>
				<h2 class="m-0 text-xl font-normal text-zinc-50">Sign In</h2>
			</div>

			<form method="post" action="?/signInEmail" use:enhance={handleSubmit} class="mt-4 grid gap-4">
				<label class="grid gap-2">
					<span class="text-sm text-zinc-300">Phone Number</span>
					<input
						type="tel"
						name="phone"
						bind:value={identifier}
						autocomplete="tel"
						inputmode="tel"
						maxlength="20"
						pattern="[+0-9 ]+"
						minlength="10"
						required
						class="w-full rounded-[10px] border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-zinc-50 transition outline-none"
					/>
				</label>

				<label class="grid gap-2">
					<span class="text-sm text-zinc-300">Password</span>
					<input
						type={showPassword ? 'text' : 'password'}
						name="password"
						autocomplete="current-password"
						minlength="8"
						maxlength="255"
						required
						class="w-full rounded-[10px] border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-zinc-50 transition outline-none"
					/>
				</label>

				<div class="flex items-center gap-2 text-sm text-zinc-300">
					<input
						type="checkbox"
						bind:checked={showPassword}
						aria-label="Show password"
						class="h-4 w-4 rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-0"
					/>
					<span>Show password</span>
				</div>

				<div class="mt-1">
					<button
						type="submit"
						disabled={isSubmitting}
						class="w-full cursor-pointer rounded-[10px] border border-transparent bg-emerald-500 px-4 py-2.5 font-normal text-emerald-950 transition hover:-translate-y-px hover:brightness-105 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
					>
						{isSubmitting ? 'Logging in...' : 'Log In'}
					</button>
				</div>

				<p class="text-sm text-zinc-400">
					Don&apos;t have an account?
					<a
						class="text-emerald-400 hover:text-emerald-300"
						href={resolve('/register')}>Create one</a
					>
				</p>
			</form>
		</section>
	</section>
</main>
