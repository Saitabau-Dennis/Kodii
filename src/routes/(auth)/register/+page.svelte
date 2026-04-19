<script lang="ts">
	import { browser } from '$app/environment';
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { onMount } from 'svelte';

	const REGISTER_DRAFT_KEY = 'kodii_auth_register_draft';

	let name = $state('');
	let phone = $state('');
	let email = $state('');
	let password = $state('');
	let showPassword = $state(false);
	let isSubmitting = $state(false);
	const strongPasswordPattern = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;
	const isStrongPassword = $derived(
		password.length > 0 && strongPasswordPattern.test(password)
	);
	const canSubmit = $derived(isStrongPassword && !isSubmitting);

	onMount(() => {
		if (!browser) return;
		const raw = sessionStorage.getItem(REGISTER_DRAFT_KEY);
		if (!raw) return;

		try {
			const draft = JSON.parse(raw) as { name?: string; phone?: string; email?: string };
			name = draft.name ?? '';
			phone = draft.phone ?? '';
			email = draft.email ?? '';
		} catch {
			sessionStorage.removeItem(REGISTER_DRAFT_KEY);
		}
	});

	$effect(() => {
		if (!browser) return;
		sessionStorage.setItem(REGISTER_DRAFT_KEY, JSON.stringify({ name, phone, email }));
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
				name = '';
				phone = '';
				email = '';
				password = '';
				showPassword = false;
				if (browser) {
					sessionStorage.removeItem(REGISTER_DRAFT_KEY);
				}
			}
			isSubmitting = false;
		};
	}

</script>

<main
	class="relative grid min-h-screen content-start justify-items-center overflow-hidden bg-black px-4 pt-6 pb-8 sm:px-6 sm:pt-8 sm:pb-10 md:pt-12"
>
	<div class="pointer-events-none absolute inset-y-0 left-[12%] hidden w-px bg-zinc-700/55 md:block"></div>
	<div class="pointer-events-none absolute inset-y-0 right-[12%] hidden w-px bg-zinc-700/55 md:block"></div>

	<div
		class="pointer-events-none absolute -top-28 left-[8%] h-72 w-72 rounded-full bg-white/10 blur-3xl"
	></div>
	<div
		class="pointer-events-none absolute right-[6%] -bottom-24 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl"
	></div>

	<section class="relative z-10 grid w-full max-w-5xl gap-3 sm:gap-4 lg:grid-cols-[1.05fr_1fr]">
		<aside class="rounded-[18px] border border-zinc-800 bg-zinc-950/90 p-5 backdrop-blur-md sm:p-7 lg:p-8">
			<h1 class="m-0 text-2xl leading-tight font-normal text-zinc-50 sm:text-3xl md:text-4xl">
				Create your KODII account.
			</h1>
			<p class="mt-3 max-w-[45ch] text-sm text-zinc-400 sm:mt-4 sm:text-base">
				Start with your basic details to access your rental operations dashboard.
			</p>
		</aside>

		<section
			class="rounded-[18px] border border-zinc-800 bg-zinc-950/90 p-5 backdrop-blur-md sm:p-6 lg:p-8"
		>
			<div>
				<h2 class="m-0 text-xl font-normal text-zinc-50">Sign Up</h2>
			</div>

			<form method="post" action="?/signUpEmail" use:enhance={handleSubmit} class="mt-4 grid gap-4">
				<label class="grid gap-2">
					<span class="text-sm text-zinc-300">Name</span>
					<input
						type="text"
						name="name"
						bind:value={name}
						autocomplete="name"
						maxlength="255"
						required
						class="w-full rounded-[10px] border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-zinc-50 transition outline-none"
					/>
				</label>

				<label class="grid gap-2">
					<span class="text-sm text-zinc-300">Phone Number</span>
					<input
						type="tel"
						name="phone"
						bind:value={phone}
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
					<span class="text-sm text-zinc-300">Email</span>
					<input
						type="email"
						name="email"
						bind:value={email}
						autocomplete="email"
						maxlength="255"
						required
						class="w-full rounded-[10px] border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-zinc-50 transition outline-none"
					/>
				</label>

				<label class="grid gap-2">
					<span class="text-sm text-zinc-300">Password</span>
					<input
						type={showPassword ? 'text' : 'password'}
						name="password"
						bind:value={password}
						autocomplete="new-password"
						minlength="8"
						maxlength="255"
						required
						class="w-full rounded-[10px] border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-zinc-50 transition outline-none"
					/>
				</label>

				{#if password.length > 0 && !isStrongPassword}
					<p class="text-sm text-amber-300">
						Password is weak. Add uppercase, lowercase, number, and special character.
					</p>
				{/if}

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
						disabled={!canSubmit}
						class="w-full cursor-pointer rounded-[10px] border border-transparent bg-emerald-500 px-4 py-2.5 font-normal text-emerald-950 transition hover:-translate-y-px hover:brightness-105 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
					>
						{isSubmitting ? 'Creating account...' : 'Create Account'}
					</button>
				</div>

				<p class="text-sm text-zinc-400">
					Already have an account?
					<a
						class="text-emerald-400 hover:text-emerald-300"
						href={resolve('/login')}>Sign in</a
					>
				</p>
			</form>
		</section>
	</section>
</main>
