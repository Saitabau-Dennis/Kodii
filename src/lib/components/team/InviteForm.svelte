<script lang="ts">
  import type { ActionResult } from '@sveltejs/kit'
  import { enhance } from '$app/forms'
  import { createEventDispatcher } from 'svelte'

  const dispatch = createEventDispatcher<{
    success: { message: string }
    error: { message: string }
  }>()

  let isSubmitting = $state(false)
  let errorMessage = $state('')

  function handleSubmit() {
    isSubmitting = true
    errorMessage = ''

    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      isSubmitting = false

      if (result.type === 'success') {
        const message =
          (result.data as { message?: string } | undefined)?.message ?? 'Invite sent successfully'
        dispatch('success', { message })
        return
      }

      if (result.type === 'failure') {
        const message =
          (result.data as { message?: string } | undefined)?.message ?? 'Unable to send invite'
        errorMessage = message
        dispatch('error', { message })
        return
      }

      if (result.type === 'error') {
        errorMessage = 'Something went wrong while sending invite'
        dispatch('error', { message: errorMessage })
      }
    }
  }
</script>

<form class="space-y-4" method="post" action="?/inviteCaretaker" use:enhance={handleSubmit}>
  <div class="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
    <p class="text-xs text-zinc-400">
      The caretaker receives an SMS invite with a temporary password and setup steps.
    </p>
  </div>

  <div class="space-y-3">
    <label class="grid gap-1.5">
      <span class="text-sm font-medium text-zinc-200">Full name</span>
      <input
        type="text"
        name="name"
        required
        maxlength="255"
        class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
        placeholder="Enter full name"
      />
    </label>

    <label class="grid gap-1.5">
      <span class="text-sm font-medium text-zinc-200">Phone number</span>
      <input
        type="tel"
        name="phone"
        required
        maxlength="20"
        class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
        placeholder="Enter phone number"
      />
      <span class="text-xs text-zinc-500">Use Kenyan format (e.g. 0712345678)</span>
    </label>
  </div>

  {#if errorMessage}
    <p class="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">
      {errorMessage}
    </p>
  {/if}

  <div class="flex justify-end border-t border-zinc-800 pt-3">
    <button
      type="submit"
      disabled={isSubmitting}
      class="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
    >
      {isSubmitting ? 'Sending...' : 'Send Invite'}
    </button>
  </div>
</form>
