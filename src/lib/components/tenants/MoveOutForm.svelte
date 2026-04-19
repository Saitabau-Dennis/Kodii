<script lang="ts">
  import type { ActionResult } from '@sveltejs/kit'
  import { enhance } from '$app/forms'
  import { invalidateAll } from '$app/navigation'
  import type { TenantWithUnit } from '$lib/types/tenants'

  interface Props {
    tenant: TenantWithUnit
    onSuccess: () => void
    onCancel: () => void
  }

  let { tenant, onSuccess, onCancel }: Props = $props()

  let moveOutDate = $state(new Date().toISOString().slice(0, 10))
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
        await invalidateAll()
        onSuccess()
        return
      }

      if (result.type === 'failure') {
        const data = (result.data as { message?: string; errors?: Record<string, string> } | undefined)
        errorMessage = data?.message ?? 'Unable to move out tenant'
        fieldErrors = data?.errors ?? {}
        return
      }

      if (result.type === 'error') {
        errorMessage = 'Unable to move out tenant right now'
      }
    }
  }
</script>

<form method="post" action="?/moveOut" class="space-y-3" use:enhance={handleSubmit}>
  <input type="hidden" name="id" value={tenant.id} />

  <p class="text-sm text-zinc-300">
    You are about to move out <span class="text-zinc-100">{tenant.fullName}</span>
    from Unit <span class="text-zinc-100">{tenant.unitNumber ?? '—'}</span>
    at <span class="text-zinc-100">{tenant.propertyName}</span>.
  </p>

  <label class="grid gap-1.5">
    <span class="text-sm font-medium text-zinc-200">Move out date</span>
    <input
      type="date"
      name="moveOutDate"
      bind:value={moveOutDate}
      required
      class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
    />
    {#if fieldErrors.moveOutDate}
      <span class="text-xs text-red-300">{fieldErrors.moveOutDate}</span>
    {/if}
  </label>

  <p class="rounded-lg border border-amber-900/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
    This will mark Unit {tenant.unitNumber ?? '—'} as vacant and close any unpaid invoices.
  </p>

  {#if errorMessage}
    <p class="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300 whitespace-pre-line">
      {errorMessage}
    </p>
  {/if}

  <div class="flex justify-end gap-2 border-t border-zinc-800 pt-3">
    <button
      type="button"
      onclick={onCancel}
      class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
    >
      Cancel
    </button>
    <button
      type="submit"
      disabled={isSubmitting}
      class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
    >
      {isSubmitting ? 'Processing...' : 'Confirm Move Out'}
    </button>
  </div>
</form>
