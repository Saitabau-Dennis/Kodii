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

  type TenantInput = {
    id: string
    fullName: string
    phoneNumber: string
    idNumber: string | null
    rentDueDay: number
    securityDeposit: number
  }

  interface Props {
    tenant?: TenantInput
    properties: PropertyOption[]
    mode: 'create' | 'edit'
    onSuccess: () => void
    onCancel: () => void
  }

  let { tenant, properties, mode, onSuccess, onCancel }: Props = $props()

  let fullName = $state('')
  let phoneNumber = $state('')
  let idNumber = $state('')
  let securityDeposit = $state('0')
  const localToday = new Date(new Date().getTime() - new Date().getTimezoneOffset() * 60000)
    .toISOString()
    .split('T')[0]
  let moveInDate = $state(localToday)
  let rentDueDay = $state('1')
  let propertyId = $state('')
  let unitId = $state('')
  let isSubmitting = $state(false)
  let isLoadingUnits = $state(false)
  let errorMessage = $state('')
  let fieldErrors = $state<Record<string, string>>({})
  let unitOptions = $state<Array<{ id: string; unitNumber: string; monthlyRent: number }>>([])

  const isCreateMode = $derived(mode === 'create')
  const actionPath = $derived(isCreateMode ? '?/createTenant' : '?/updateTenant')

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

  $effect(() => {
    fullName = tenant?.fullName ?? ''
    phoneNumber = tenant?.phoneNumber ?? ''
    idNumber = tenant?.idNumber ?? ''
    securityDeposit = tenant ? String(tenant.securityDeposit) : '0'
    rentDueDay = tenant ? String(tenant.rentDueDay) : '1'
    propertyId = ''
    unitId = ''
    moveInDate = localToday
    unitOptions = []
    errorMessage = ''
    fieldErrors = {}
    isSubmitting = false
  })

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
      const data = (await response.json()) as Array<{
        id: string
        unitNumber: string
        monthlyRent: number
      }>
      unitOptions = data
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
        errorMessage = data?.message ?? 'Unable to save tenant'
        fieldErrors = data?.errors ?? {}
        return
      }

      if (result.type === 'error') {
        errorMessage = 'Unable to save tenant right now'
      }
    }
  }
</script>

<form method="post" action={actionPath} class="space-y-3" use:enhance={handleSubmit}>
  {#if !isCreateMode}
    <input type="hidden" name="id" value={tenant?.id ?? ''} />
  {/if}

  <label class="grid gap-1.5">
    <span class="text-sm font-medium text-zinc-200">Full name</span>
    <input
      type="text"
      name="fullName"
      bind:value={fullName}
      required
      minlength="2"
      class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
      placeholder="Tenant full name"
    />
    {#if fieldErrors.fullName}
      <span class="text-xs text-red-300">{fieldErrors.fullName}</span>
    {/if}
  </label>

  <label class="grid gap-1.5">
    <span class="text-sm font-medium text-zinc-200">Phone number</span>
    <input
      type="text"
      name="phoneNumber"
      bind:value={phoneNumber}
      required
      class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
      placeholder="0712 345 678"
    />
    {#if fieldErrors.phoneNumber}
      <span class="text-xs text-red-300">{fieldErrors.phoneNumber}</span>
    {/if}
  </label>

  <label class="grid gap-1.5">
    <span class="text-sm font-medium text-zinc-200">ID number (optional)</span>
    <input
      type="text"
      name="idNumber"
      bind:value={idNumber}
      class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
      placeholder="ID Number"
    />
  </label>

  {#if isCreateMode}
    <label class="grid gap-1.5">
      <span class="text-sm font-medium text-zinc-200">Move in date</span>
      <input
        type="date"
        name="moveInDate"
        bind:value={moveInDate}
        required
        max={localToday}
        class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
      />
      {#if fieldErrors.moveInDate}
        <span class="text-xs text-red-300">{fieldErrors.moveInDate}</span>
      {/if}
    </label>
  {/if}

  <label class="grid gap-1.5">
    <span class="text-sm font-medium text-zinc-200">Rent due day</span>
    <input
      type="number"
      name="rentDueDay"
      bind:value={rentDueDay}
      required
      min="1"
      max="28"
      class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
    />
    {#if fieldErrors.rentDueDay}
      <span class="text-xs text-red-300">{fieldErrors.rentDueDay}</span>
    {/if}
  </label>

  <label class="grid gap-1.5">
    <span class="text-sm font-medium text-zinc-200">Security deposit (KES)</span>
    <input
      type="number"
      name="securityDeposit"
      bind:value={securityDeposit}
      required
      min="0"
      step="0.01"
      class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
      placeholder="0.00"
    />
    {#if fieldErrors.securityDeposit}
      <span class="text-xs text-red-300">{fieldErrors.securityDeposit}</span>
    {/if}
  </label>

  {#if isCreateMode}
    <div class="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 space-y-3">
      <p class="text-xs font-medium uppercase tracking-wide text-zinc-500">Unit Assignment</p>

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
    </div>
  {:else}
    <p class="text-xs text-zinc-500">
      Property and unit assignment are managed through Assign Unit.
    </p>
  {/if}

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
      {isSubmitting ? 'Saving...' : isCreateMode ? 'Add Tenant' : 'Save Changes'}
    </button>
  </div>
</form>
