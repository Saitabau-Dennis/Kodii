<script lang="ts">
  import type { ActionResult } from '@sveltejs/kit'
  import { enhance } from '$app/forms'
  import { goto, invalidateAll } from '$app/navigation'
  import TargetSelector from './TargetSelector.svelte'
  import { toastStore } from '$lib/stores/toast'

  type PropertyItem = {
    id: string
    name: string
    tenantCount?: number
  }

  type UnitItem = {
    id: string
    unitNumber: string
    tenantName: string | null
    tenantId: string | null
  }

  type TenantItem = {
    id: string
    fullName: string
    phoneNumber: string
    propertyId: string
    propertyName: string
    unitId: string | null
    unitNumber: string | null
  }

  interface Props {
    properties: PropertyItem[]
    unitsByProperty: Record<string, UnitItem[]>
    tenants: TenantItem[]
    canSendAllTenants?: boolean
  }

  let { properties, unitsByProperty, tenants, canSendAllTenants = true }: Props = $props()

  let title = $state('')
  let message = $state('')
  let targetType = $state<'all_tenants' | 'property' | 'unit' | 'tenant'>('all_tenants')
  let selectedIds = $state<string[]>([])
  let isSubmitting = $state(false)
  let errorMessage = $state('')

  const messageLength = $derived(message.length)
  const isCounterWarning = $derived(messageLength > 140)

  const propertyTenantCount = $derived.by(() => {
    const map = new Map<string, number>()
    for (const tenant of tenants) {
      const current = map.get(tenant.propertyId) ?? 0
      map.set(tenant.propertyId, current + 1)
    }
    return map
  })

  const propertyOptions = $derived(
    properties.map((property) => ({
      ...property,
      tenantCount: propertyTenantCount.get(property.id) ?? 0,
    })),
  )

  const selectedRecipientCount = $derived.by(() => {
    if (targetType === 'all_tenants') return tenants.length
    if (targetType === 'tenant') return selectedIds.length
    if (targetType === 'unit') return selectedIds.length
    if (targetType === 'property') {
      return selectedIds.reduce((sum, propertyId) => sum + (propertyTenantCount.get(propertyId) ?? 0), 0)
    }
    return 0
  })

  const canSubmit = $derived.by(() => {
    if (message.trim().length < 10 || message.trim().length > 160) return false
    if (targetType === 'all_tenants') return tenants.length > 0
    return selectedIds.length > 0 && selectedRecipientCount > 0
  })

  $effect(() => {
    if (!canSendAllTenants && targetType === 'all_tenants') {
      targetType = 'property'
    }
  })

  function handleSelectionChange(ids: string[]) {
    selectedIds = ids
  }

  function handleSubmit() {
    isSubmitting = true
    errorMessage = ''

    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      isSubmitting = false

      if (result.type === 'success') {
        await invalidateAll()
        const payload = result.data as { sentCount?: number } | undefined
        toastStore.success(`Notice sent to ${payload?.sentCount ?? selectedRecipientCount} tenants`)
        goto('/notices')
        return
      }

      if (result.type === 'failure') {
        errorMessage = (result.data as { message?: string } | undefined)?.message ?? 'Unable to send notice'
        return
      }

      if (result.type === 'error') {
        errorMessage = 'Unable to send notice right now'
      }
    }
  }
</script>

<form method="post" action="?/sendNotice" class="space-y-4" use:enhance={handleSubmit}>
  <input type="hidden" name="targetType" value={targetType} />
  {#if targetType !== 'all_tenants'}
    {#each selectedIds as id (id)}
      <input type="hidden" name="targetIds" value={id} />
    {/each}
  {/if}

  <div class="grid grid-cols-1 gap-4 lg:grid-cols-5">
    <div class="space-y-3 lg:col-span-3">
      <label class="grid gap-1.5">
        <span class="text-sm font-medium text-zinc-200">Notice Title (optional)</span>
        <input
          type="text"
          name="title"
          bind:value={title}
          maxlength="100"
          class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
          placeholder="e.g. Water Outage Notice"
        />
      </label>

      <label class="grid gap-1.5">
        <span class="text-sm font-medium text-zinc-200">Message</span>
        <textarea
          name="message"
          bind:value={message}
          required
          minlength="10"
          maxlength="160"
          rows="4"
          class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
          placeholder="Type your message here..."
        ></textarea>
        <span class={`text-xs ${isCounterWarning ? 'text-red-300' : 'text-zinc-500'}`}>
          {messageLength} / 160 characters
        </span>
      </label>

      <div class="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500">SMS Preview</p>
        <div class="max-w-md rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100">
          [KODII] {message.trim() || 'Your message will appear here...'}
        </div>
      </div>
    </div>

    <div class="space-y-3 lg:col-span-2">
      <p class="text-sm font-medium text-zinc-200">Recipients</p>

      <div class="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {#if canSendAllTenants}
          <button
            type="button"
            class={`rounded-lg border px-3 py-2 text-left text-sm ${targetType === 'all_tenants' ? 'border-emerald-500 bg-emerald-950/20 text-emerald-300' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-900'}`}
            onclick={() => (targetType = 'all_tenants')}
          >
            All Tenants
          </button>
        {/if}
        <button
          type="button"
          class={`rounded-lg border px-3 py-2 text-left text-sm ${targetType === 'property' ? 'border-emerald-500 bg-emerald-950/20 text-emerald-300' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-900'}`}
          onclick={() => (targetType = 'property')}
        >
          By Property
        </button>
        <button
          type="button"
          class={`rounded-lg border px-3 py-2 text-left text-sm ${targetType === 'unit' ? 'border-emerald-500 bg-emerald-950/20 text-emerald-300' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-900'}`}
          onclick={() => (targetType = 'unit')}
        >
          By Unit
        </button>
        <button
          type="button"
          class={`rounded-lg border px-3 py-2 text-left text-sm ${targetType === 'tenant' ? 'border-emerald-500 bg-emerald-950/20 text-emerald-300' : 'border-zinc-700 text-zinc-300 hover:bg-zinc-900'}`}
          onclick={() => (targetType = 'tenant')}
        >
          By Tenant
        </button>
      </div>

      <TargetSelector
        {targetType}
        properties={propertyOptions}
        {unitsByProperty}
        {tenants}
        onSelectionChange={handleSelectionChange}
      />

      <div class="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm">
        <p class="text-zinc-300">
          This notice will be sent to <span class="text-zinc-100">{selectedRecipientCount}</span> tenants via SMS.
        </p>
        {#if selectedRecipientCount === 0}
          <p class="mt-1 text-xs text-amber-300">Please select at least one recipient.</p>
        {/if}
      </div>
    </div>
  </div>

  {#if errorMessage}
    <p class="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300 whitespace-pre-line">
      {errorMessage}
    </p>
  {/if}

  <div class="flex flex-wrap items-center justify-end gap-3 border-t border-zinc-800 pt-3">
    <a href="/notices" class="text-sm text-zinc-400 hover:text-zinc-200">Cancel</a>
    <button
      type="submit"
      disabled={!canSubmit || isSubmitting}
      class="inline-flex items-center justify-center rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
    >
      {#if isSubmitting}
        <span class="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-emerald-950 border-t-transparent"></span>
      {/if}
      {isSubmitting ? 'Sending...' : 'Send Notice'}
    </button>
  </div>
</form>
