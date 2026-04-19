<script lang="ts">
	import { enhance } from '$app/forms'
	import { onMount } from 'svelte'
	import { resolve } from '$app/paths'
	import { toastStore } from '$lib/stores/toast'
	import type { ActionData, PageData } from './$types'

	let { data, form }: { data: PageData; form: ActionData } = $props()

	let code = $state('')
	let countdown = $state(60)
	let canResend = $state(false)
	let isVerifying = $state(false)
	let isResending = $state(false)
	let timer: ReturnType<typeof setInterval>

	const codeLength = 6
	const canVerify = $derived(code.length === codeLength)

	function sanitizeCode(value: string) {
		return value.replace(/\D/g, '').slice(0, codeLength)
	}

	function handleInput(event: Event) {
		const target = event.currentTarget as HTMLInputElement
		code = sanitizeCode(target.value)
		target.value = code
	}

	function startTimer() {
		canResend = false
		countdown = 60
		clearInterval(timer)
		timer = setInterval(() => {
			countdown--
			if (countdown <= 0) {
				clearInterval(timer)
				canResend = true
			}
		}, 1000)
	}

	function handleResend() {
		startTimer()
	}

	function handleVerifySubmit() {
		isVerifying = true
		return async ({ update }: { update: () => Promise<void> }) => {
			await update()
			isVerifying = false
		}
	}

	onMount(() => {
		startTimer()
		return () => clearInterval(timer)
	})
</script>

<main
	class="relative grid min-h-screen content-start justify-items-center overflow-hidden bg-black px-4 pt-6 pb-8 sm:px-6 sm:pt-8 sm:pb-10 md:pt-12"
>
	<div class="pointer-events-none absolute inset-y-0 left-[12%] hidden w-px bg-zinc-700/55 md:block"></div>
	<div class="pointer-events-none absolute inset-y-0 right-[12%] hidden w-px bg-zinc-700/55 md:block"></div>

	<div class="pointer-events-none absolute -top-20 left-[10%] h-72 w-72 rounded-full bg-white/10 blur-3xl"></div>
	<div
		class="pointer-events-none absolute right-[7%] -bottom-20 h-72 w-72 rounded-full bg-emerald-400/20 blur-3xl"
	></div>

	<section class="relative z-10 grid w-full max-w-5xl gap-3 sm:gap-4 lg:grid-cols-[1.05fr_1fr]">
		<aside class="rounded-[18px] border border-zinc-800 bg-zinc-950/90 p-5 backdrop-blur-md sm:p-7 lg:p-8">
			<h1 class="m-0 text-2xl leading-tight font-normal text-zinc-50 sm:text-3xl md:text-4xl">Verify your number.</h1>
			<p class="mt-3 max-w-[45ch] text-sm text-zinc-400 sm:mt-4 sm:text-base">Enter the 6-digit PIN sent to your phone</p>
			<div class="mt-7 rounded-[14px] border border-zinc-800 text-center p-4">
				<p class="mt-1 text-base text-zinc-200 sm:text-lg">{data.maskedPhone}</p>
			</div>
		</aside>

		<section class="rounded-[18px] border border-zinc-800 bg-zinc-950/90 p-5 backdrop-blur-md sm:p-6 lg:p-8">
			<div>
				<p class="mt-1 text-sm text-zinc-400">Paste or type the OTP below.</p>
			</div>

			<form
				class="mt-5 grid gap-4"
				method="post"
				action="?/verify"
				novalidate
				use:enhance={handleVerifySubmit}
			>
				<label class="grid gap-2">
					<span class="text-sm text-zinc-300">One-Time Code</span>
					<input
						type="text"
						name="code"
						inputmode="numeric"
						autocomplete="one-time-code"
						placeholder="000000"
						maxlength="6"
						required
						bind:value={code}
						oninput={handleInput}
						class="w-full rounded-[10px] border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-center font-mono text-base tracking-[0.2em] text-zinc-50 transition outline-none sm:text-lg sm:tracking-[0.35em]"
					/>
				</label>

				{#if form?.message}
					<p class="text-sm text-red-300">{form.message}</p>
				{/if}

				<div class="mt-1">
					<button
						type="submit"
						disabled={!canVerify || isVerifying}
						class="w-full cursor-pointer rounded-[10px] border border-transparent bg-emerald-500 px-4 py-2.5 font-normal text-emerald-950 transition hover:-translate-y-px hover:brightness-105 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
					>
						{isVerifying ? 'Verifying...' : 'Verify code'}
					</button>
				</div>
			</form>

			<form
				class="mt-3"
				method="post"
				action="?/resend"
				use:enhance={() => {
					isResending = true
					return async ({ result, update }) => {
						await update()
						if (result.type === 'success') {
							handleResend()
							toastStore.success('A new PIN has been sent to your phone.')
						}
						isResending = false
					}
				}}
			>
				<div class="flex flex-col gap-2 text-sm text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
					{#if !canResend}
						<span>You can request a new code in {countdown}s</span>
					{:else}
						<span>Didn't get the code?</span>
					{/if}
					<button
						type="submit"
						disabled={!canResend || isResending}
						class="cursor-pointer text-emerald-400 hover:text-emerald-300 disabled:cursor-not-allowed disabled:text-zinc-500"
					>
						{isResending ? 'Sending...' : 'Resend OTP'}
					</button>
				</div>
			</form>

			<p class="mt-3 text-sm text-zinc-400">
				Wrong number?
				<a class="text-emerald-400 hover:text-emerald-300" href={resolve('/login')}>Go back</a>
			</p>
		</section>
	</section>
</main>
