<script lang="ts">
  import type { ActionResult } from '@sveltejs/kit'
  import { enhance } from '$app/forms'
  import { LockOutline } from 'flowbite-svelte-icons'
  import { toastStore } from '$lib/stores/toast'

  interface Props {
    user: {
      name: string
      phone: string
      email: string | null
    }
    settings: {
      businessName: string | null
    }
  }

  let { user, settings }: Props = $props()

  let isSubmitting = $state(false)
  let errorMessage = $state('')
  let fieldErrors = $state<Record<string, string>>({})

  function handleSubmit() {
    isSubmitting = true
    errorMessage = ''
    fieldErrors = {}

    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      isSubmitting = false

      if (result.type === 'success') {
        toastStore.success('Business information updated')
        return
      }

      if (result.type === 'failure') {
        const payload = (result.data as { message?: string; errors?: Record<string, string> } | undefined) ?? {}
        errorMessage = payload.message ?? 'Unable to update business information'
        fieldErrors = payload.errors ?? {}
        return
      }

      errorMessage = 'Unable to update business information'
    }
  }
</script>

<form method="post" action="?/updateBusiness" class="space-y-4" use:enhance={handleSubmit}>
  <label class="grid max-w-xl gap-1.5">
    <span class="text-sm text-zinc-300">Business name</span>
    <input
      name="businessName"
      required
      value={settings.businessName ?? ''}
      placeholder="e.g. Sunset Properties"
      class="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
    />
    <span class="text-xs text-zinc-500">Used as your business profile name across the app</span>
    {#if fieldErrors.businessName}
      <span class="text-xs text-red-300">{fieldErrors.businessName}</span>
    {/if}
  </label>

  <label class="grid max-w-xl gap-1.5">
    <span class="text-sm text-zinc-300">Landlord name</span>
    <input
      name="name"
      required
      value={user.name}
      class="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
    />
    {#if fieldErrors.name}
      <span class="text-xs text-red-300">{fieldErrors.name}</span>
    {/if}
  </label>

  <label class="grid max-w-xl gap-1.5">
    <span class="text-sm text-zinc-300">Contact phone</span>
    <div class="relative">
      <input
        value={user.phone}
        disabled
        class="h-9 w-full rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 pr-10 text-sm text-zinc-400"
      />
      <LockOutline class="pointer-events-none absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
    </div>
    <span class="text-xs text-zinc-500">This is your login phone. Contact support to change.</span>
  </label>

  <label class="grid max-w-xl gap-1.5">
    <span class="text-sm text-zinc-300">Email address</span>
    <input
      type="email"
      name="email"
      value={user.email ?? ''}
      required
      class="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
    />
    <span class="text-xs text-zinc-500">Used for account notifications</span>
    {#if fieldErrors.email}
      <span class="text-xs text-red-300">{fieldErrors.email}</span>
    {/if}
  </label>

  {#if errorMessage}
    <p class="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">{errorMessage}</p>
  {/if}

  <div>
    <button
      type="submit"
      disabled={isSubmitting}
      class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
    >
      {isSubmitting ? 'Saving...' : 'Save Business Info'}
    </button>
  </div>
</form>
