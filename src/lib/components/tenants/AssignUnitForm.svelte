<script lang="ts">
  import type { ActionResult } from '@sveltejs/kit'
  import { enhance } from '$app/forms'
  import { invalidateAll } from '$app/navigation'
  import { Select } from 'flowbite-svelte'
  import { formatKES } from '$lib/utils/trends'

  type PropertyOption = {
    id: string
    name: string
  }

  interface Props {
    tenantId: string
    tenantName: string
    properties: PropertyOption[]
    onSuccess: () => void
    onCancel: () => void
  }

  let { tenantId, tenantName, properties, onSuccess, onCancel }: Props = $props()

  let propertyId = $state('')
  let unitId = $state('')
  let isSubmitting = $state(false)
  let isLoadingUnits = $state(false)
  let errorMessage = $state('')
  let fieldErrors = $state<Record<string, string>>({})
  let unitOptions = $state<Array<{ id: string; unitNumber: string; monthlyRent: number }>>([])

  const selectClass =
    'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 [color-scheme:dark] [&>option]:bg-zinc-900 [&>option]:text-zinc-100 focus:border-emerald-500 focus:ring-emerald-500'
  const selectClasses = { select: selectClass }

  const propertyItems = $derived(
    properties.map((property) => ({ name: property.name, value: property.id })),
  )
  const unitItems = $derived(
    unitOptions.map((unit) => ({
      name: `Unit ${unit.unitNumber} — ${formatKES(unit.monthlyRent)}`,
      value: unit.id,
    })),
  )

  async function loadVacantUnits(selectedPropertyId: string) {
    unitOptions = []
    unitId = ''

    if (!selectedPropertyId) return

    isLoadingUnits = true
    try {
      const response = await fetch(`/api/properties/${selectedPropertyId}/vacant-units`)
      if (!response.ok) {
        unitOptions = []
        return
      }
      unitOptions = (await response.json()) as Array<{
        id: string
        unitNumber: string
        monthlyRent: number
      }>
    } finally {
      isLoadingUnits = false
    }
  }

  function onPropertyChange(event: Event) {
    const nextPropertyId = (event.currentTarget as HTMLSelectElement).value
    propertyId = nextPropertyId
    loadVacantUnits(nextPropertyId)
  }

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
        errorMessage = data?.message ?? 'Unable to assign unit'
        fieldErrors = data?.errors ?? {}
        return
      }

      if (result.type === 'error') {
        errorMessage = 'Unable to assign unit right now'
      }
    }
  }
</script>

<form method="post" action="?/assignUnit" class="space-y-3" use:enhance={handleSubmit}>
  <input type="hidden" name="tenantId" value={tenantId} />

  <p class="text-sm text-zinc-300">Assign a vacant unit to <span class="text-zinc-100">{tenantName}</span>.</p>

  <label class="grid gap-1.5">
    <span class="text-sm font-medium text-zinc-200">Property</span>
    <Select
      name="propertyId"
      items={propertyItems}
      bind:value={propertyId}
      placeholder=""
      classes={selectClasses}
      style="color-scheme: dark;"
      onchange={onPropertyChange}
      required
    />
    {#if fieldErrors.propertyId}
      <span class="text-xs text-red-300">{fieldErrors.propertyId}</span>
    {/if}
  </label>

  <label class="grid gap-1.5">
    <span class="text-sm font-medium text-zinc-200">Unit</span>
    {#if isLoadingUnits}
      <div class="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
        <span class="h-4 w-4 animate-spin rounded-full border-2 border-zinc-500 border-t-zinc-100"></span>
        Loading vacant units...
      </div>
    {/if}
    <Select
      name="unitId"
      items={unitItems}
      bind:value={unitId}
      placeholder={propertyId ? '' : 'Select property first'}
      classes={selectClasses}
      style="color-scheme: dark;"
      disabled={!propertyId || isLoadingUnits}
      required
    />
    {#if fieldErrors.unitId}
      <span class="text-xs text-red-300">{fieldErrors.unitId}</span>
    {/if}
  </label>

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
      class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
    >
      {isSubmitting ? 'Assigning...' : 'Assign Unit'}
    </button>
  </div>
</form>
