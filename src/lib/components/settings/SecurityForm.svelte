<script lang="ts">
  import type { ActionResult } from '@sveltejs/kit'
  import { enhance } from '$app/forms'
  import PasswordStrength from './PasswordStrength.svelte'
  import { toastStore } from '$lib/stores/toast'

  interface Props {
    sessionInfo: {
      loggedInLabel: string
      ipMasked: string
    }
  }

  let { sessionInfo }: Props = $props()

  let currentPassword = $state('')
  let newPassword = $state('')
  let confirmPassword = $state('')
  let isSubmitting = $state(false)
  let errorMessage = $state('')
  let fieldErrors = $state<Record<string, string>>({})

  const mismatch = $derived(confirmPassword.length > 0 && confirmPassword !== newPassword)

  function handleSubmit() {
    isSubmitting = true
    errorMessage = ''
    fieldErrors = {}

    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      isSubmitting = false

      if (result.type === 'success') {
        currentPassword = ''
        newPassword = ''
        confirmPassword = ''
        toastStore.success('Password updated successfully')
        return
      }

      if (result.type === 'failure') {
        const payload = (result.data as { message?: string; errors?: Record<string, string> } | undefined) ?? {}
        errorMessage = payload.message ?? 'Unable to update password'
        fieldErrors = payload.errors ?? {}
        return
      }

      errorMessage = 'Unable to update password'
    }
  }
</script>

<div class="space-y-5">
  <form method="post" action="?/changePassword" class="space-y-4" use:enhance={handleSubmit}>
    <label class="grid max-w-xl gap-1.5">
      <span class="text-sm text-zinc-300">Current password</span>
      <input
        type="password"
        name="currentPassword"
        bind:value={currentPassword}
        required
        placeholder="Enter current password"
        class="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
      />
      {#if fieldErrors.currentPassword}
        <span class="text-xs text-red-300">{fieldErrors.currentPassword}</span>
      {/if}
    </label>

    <label class="grid max-w-xl gap-1.5">
      <span class="text-sm text-zinc-300">New password</span>
      <input
        type="password"
        name="newPassword"
        bind:value={newPassword}
        required
        minlength="8"
        placeholder="Enter new password"
        class="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
      />
      <span class="text-xs text-zinc-500">Minimum 8 characters</span>
      {#if newPassword.trim().length > 0}
        <PasswordStrength password={newPassword} />
      {/if}
      {#if fieldErrors.newPassword}
        <span class="text-xs text-red-300">{fieldErrors.newPassword}</span>
      {/if}
    </label>

    <label class="grid max-w-xl gap-1.5">
      <span class="text-sm text-zinc-300">Confirm new password</span>
      <input
        type="password"
        name="confirmPassword"
        bind:value={confirmPassword}
        required
        placeholder="Confirm new password"
        class="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
      />
      {#if mismatch}
        <span class="text-xs text-red-300">Passwords do not match</span>
      {/if}
      {#if fieldErrors.confirmPassword}
        <span class="text-xs text-red-300">{fieldErrors.confirmPassword}</span>
      {/if}
    </label>

    {#if errorMessage}
      <p class="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">{errorMessage}</p>
    {/if}

    <button
      type="submit"
      disabled={isSubmitting || mismatch}
      class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
    >
      {isSubmitting ? 'Updating...' : 'Update Password'}
    </button>
  </form>

  <section class="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
    <div>
      <h4 class="text-base font-semibold text-zinc-100">Active Session</h4>
      <p class="text-xs text-zinc-500">Your current login session</p>
    </div>
    <div class="grid grid-cols-1 gap-2 text-sm text-zinc-300 sm:grid-cols-2">
      <p><span class="text-zinc-500">Logged in:</span> {sessionInfo.loggedInLabel}</p>
      <p><span class="text-zinc-500">IP:</span> {sessionInfo.ipMasked}</p>
    </div>
    <form method="post" action="?/signOutAllSessions">
      <button
        type="submit"
        class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800"
      >
        Sign Out All Sessions
      </button>
    </form>
  </section>
</div>
