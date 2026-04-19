<script lang="ts">
  import type { ActionResult } from '@sveltejs/kit'
  import { enhance } from '$app/forms'
  import { invalidateAll } from '$app/navigation'
  import { Select } from 'flowbite-svelte'

  type UnitInput = {
    id: string
    propertyId: string
    unitNumber: string
    monthlyRent: number
    paymentReference: string | null
    status: 'vacant' | 'occupied' | 'inactive'
  }

  type PropertyOption = {
    id: string
    name: string
  }

  interface Props {
    unit?: UnitInput
    properties: PropertyOption[]
    selectedPropertyId?: string
    onSuccess: () => void
    onCancel: () => void
  }

  let { unit, properties, selectedPropertyId, onSuccess, onCancel }: Props = $props()

  let propertyId = $state('')
  let unitNumber = $state('')
  let monthlyRent = $state('')
  let paymentReference = $state('')
  let status = $state<'vacant' | 'inactive'>('vacant')
  let isSubmitting = $state(false)
  let errorMessage = $state('')
  let fieldErrors = $state<{
    propertyId?: string
    unitNumber?: string
    monthlyRent?: string
    id?: string
  }>({})

  const isEditMode = $derived(Boolean(unit))
  const actionPath = $derived(isEditMode ? '?/updateUnit' : '?/createUnit')
  const submitLabel = $derived(isEditMode ? 'Save Changes' : 'Add Unit')
  const propertyOptions = $derived(
    properties.map((property) => ({ name: property.name, value: property.id })),
  )
  const selectClass =
    'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 [color-scheme:dark] [&>option]:bg-zinc-900 [&>option]:text-zinc-100 focus:border-emerald-500 focus:ring-emerald-500'
  const selectClasses = { select: selectClass }
  const statusSelectClasses = {
    select:
      'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 [color-scheme:dark] [&>option]:bg-zinc-900 [&>option]:text-zinc-100 [&>option:checked]:bg-zinc-800 [&>option:checked]:text-zinc-100 focus:border-emerald-500 focus:ring-emerald-500',
  }

  $effect(() => {
    propertyId = unit?.propertyId ?? selectedPropertyId ?? properties[0]?.id ?? ''
    unitNumber = unit?.unitNumber ?? ''
    monthlyRent = unit ? String(unit.monthlyRent) : ''
    paymentReference = unit?.paymentReference ?? ''
    status = unit?.status === 'inactive' ? 'inactive' : 'vacant'
    isSubmitting = false
    errorMessage = ''
    fieldErrors = {}
  })

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
        const data = (result.data as
          | {
              message?: string
              errors?: {
                propertyId?: string
                unitNumber?: string
                monthlyRent?: string
                id?: string
              }
            }
          | undefined)
        errorMessage = data?.message ?? 'Unable to save unit'
        fieldErrors = data?.errors ?? {}
        return
      }

      if (result.type === 'error') {
        errorMessage = 'Unable to save unit right now'
      }
    }
  }
</script>

<form method="post" action={actionPath} class="space-y-3" use:enhance={handleSubmit}>
  {#if isEditMode}
    <input type="hidden" name="id" value={unit?.id ?? ''} />
  {/if}

  <label class="grid gap-1.5">
    <span class="text-sm font-medium text-zinc-200">Property</span>
    <Select
      name="propertyId"
      items={propertyOptions}
      bind:value={propertyId}
      placeholder=""
      classes={selectClasses}
      style="color-scheme: dark;"
      required
    />
    {#if fieldErrors.propertyId}
      <span class="text-xs text-red-300">{fieldErrors.propertyId}</span>
    {/if}
  </label>

  <label class="grid gap-1.5">
    <span class="text-sm font-medium text-zinc-200">Unit number</span>
    <input
      type="text"
      name="unitNumber"
      bind:value={unitNumber}
      required
      maxlength="50"
      class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
      placeholder="A1, B3, 101"
    />
    {#if fieldErrors.unitNumber}
      <span class="text-xs text-red-300">{fieldErrors.unitNumber}</span>
    {/if}
  </label>

  <label class="grid gap-1.5">
    <span class="text-sm font-medium text-zinc-200">Monthly rent (KES)</span>
    <input
      type="number"
      name="monthlyRent"
      bind:value={monthlyRent}
      required
      min="1"
      step="0.01"
      class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
      placeholder="15000"
    />
    {#if fieldErrors.monthlyRent}
      <span class="text-xs text-red-300">{fieldErrors.monthlyRent}</span>
    {/if}
  </label>

  <label class="grid gap-1.5">
    <span class="text-sm font-medium text-zinc-200">Payment reference (optional)</span>
    <input
      type="text"
      name="paymentReference"
      bind:value={paymentReference}
      maxlength="100"
      class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
      placeholder="Reference"
    />
  </label>

  <label class="grid gap-1.5">
    <span class="text-sm font-medium text-zinc-200">Status</span>
    <Select
      name="status"
      items={[
        { name: 'Vacant', value: 'vacant' },
        { name: 'Inactive', value: 'inactive' },
      ]}
      bind:value={status}
      placeholder=""
      classes={statusSelectClasses}
      style="color-scheme: dark; background-color: rgb(24 24 27); color: rgb(244 244 245);"
      required
    />
    {#if isEditMode}
      <span class="text-xs text-zinc-500">Tenant assignment is managed from the Tenants page.</span>
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
      {isSubmitting ? 'Saving...' : submitLabel}
    </button>
  </div>
</form>
