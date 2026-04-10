<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';

	let password = $state('');
	let confirmPassword = $state('');
	let showPassword = $state(false);
	let showMatchNotice = $state(false);
	let confirmTouched = $state(false);
	let isSubmitting = $state(false);

	const minPasswordLength = 8;
	const isTooShort = $derived(password.length > 0 && password.length < minPasswordLength);
	const passwordsMatch = $derived(password.length > 0 && password === confirmPassword);
	const showMismatchNotice = $derived(confirmTouched && !passwordsMatch);
	const canSubmit = $derived(!isTooShort && passwordsMatch);

	$effect(() => {
		if (!passwordsMatch) {
			showMatchNotice = false;
			return;
		}

		showMatchNotice = true;
		const timer = setTimeout(() => {
			showMatchNotice = false;
		}, 2000);

		return () => clearTimeout(timer);
	});

	function handleSubmit() {
		isSubmitting = true;

		return async ({ update }: { update: () => Promise<void> }) => {
			await update();
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
				Set your new password.
			</h1>
			<p class="mt-4 max-w-[45ch] text-zinc-400">
				Choose a secure password for your account before you continue to the dashboard.
			</p>
		</aside>

		<section
			class="rounded-[18px] border border-zinc-800 bg-zinc-950/90 p-6 backdrop-blur-md lg:p-8"
		>
			<form class="mt-4 grid gap-4" method="post" use:enhance={handleSubmit}>
				<label class="grid gap-2">
					<span class="text-sm text-zinc-300">New password</span>
					<input
						type={showPassword ? 'text' : 'password'}
						name="password"
						autocomplete="new-password"
						bind:value={password}
						maxlength="255"
						required
						class="w-full rounded-[10px] border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-zinc-50 transition outline-none"
					/>
				</label>

				{#if isTooShort}
					<p class="text-sm text-amber-300">
						Password must be at least {minPasswordLength} characters.
					</p>
				{/if}

				<label class="grid gap-2">
					<span class="text-sm text-zinc-300">Confirm password</span>
					<input
						type={showPassword ? 'text' : 'password'}
						name="confirmPassword"
						autocomplete="new-password"
						bind:value={confirmPassword}
						oninput={() => {
							confirmTouched = true;
						}}
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

				{#if showMatchNotice}
					<p class="flex items-center gap-2 text-sm text-emerald-300">
						Passwords match
						<span
							aria-hidden="true"
							class="inline-flex h-5 w-5 items-center justify-center rounded-full border border-emerald-500 bg-emerald-500 text-xs text-white"
						>
							&check;
						</span>
					</p>
				{/if}

				{#if showMismatchNotice}
					<p class="text-sm text-red-300">Passwords do not match</p>
				{/if}

				<div class="mt-1">
					<button
						type="submit"
						disabled={!canSubmit || isSubmitting}
						class="w-full cursor-pointer rounded-[10px] border border-transparent bg-emerald-500 px-4 py-2.5 font-normal text-emerald-950 transition hover:-translate-y-px hover:brightness-105 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
					>
						{isSubmitting ? 'Saving...' : 'Save password'}
					</button>
				</div>

				<p class="text-sm text-zinc-400">
					Need to sign in instead?
					<a class="text-emerald-400 hover:text-emerald-300" href={resolve('/login')}>Go to login</a
					>
				</p>
			</form>
		</section>
	</section>
</main>
