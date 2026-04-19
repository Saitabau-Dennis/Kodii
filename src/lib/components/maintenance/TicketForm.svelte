<script lang="ts">
  import type { ActionResult } from '@sveltejs/kit'
  import { enhance } from '$app/forms'
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { Button, Select } from 'flowbite-svelte'

  interface PropertyItem {
    id: string
    name: string
  }

  interface CaretakerItem {
    id: string
    name: string
    propertyIds: string[]
  }

  interface UnitItem {
    id: string
    unitNumber: string
    monthlyRent: number
    status: 'vacant' | 'occupied' | 'inactive'
    tenantName: string | null
  }

  interface Props {
    properties: PropertyItem[]
    caretakers: CaretakerItem[]
    unitsByProperty: Record<string, UnitItem[]>
    senderId: string
  }

  let { properties, caretakers, unitsByProperty, senderId }: Props = $props()

  let propertyId = $state('')
  let unitId = $state('')
  let category = $state('other')
  let description = $state('')
  let assignedTo = $state('')
  let internalNote = $state('')

  let units = $state<UnitItem[]>([])
  let loadingUnits = $state(false)
  let submitting = $state(false)
  let errorMessage = $state('')

  const categoryOptions = [
    { name: 'Water', value: 'water' },
    { name: 'Electricity', value: 'electricity' },
    { name: 'Plumbing', value: 'plumbing' },
    { name: 'Security', value: 'security' },
    { name: 'Other', value: 'other' },
  ]

  const filteredCaretakers = $derived(
    propertyId
      ? caretakers.filter((caretaker) => caretaker.propertyIds.includes(propertyId))
      : [],
  )

  function loadUnits(nextPropertyId: string) {
    if (!nextPropertyId) {
      units = []
      unitId = ''
      return
    }

    loadingUnits = true
    const list = unitsByProperty[nextPropertyId] ?? []
    units = list
    if (!units.some((unit) => unit.id === unitId)) {
      unitId = ''
    }
    loadingUnits = false
  }

  function onPropertyChange(event: Event) {
    propertyId = (event.currentTarget as HTMLSelectElement).value
    unitId = ''
    assignedTo = ''
    loadUnits(propertyId)
  }

  function handleSubmit() {
    submitting = true
    errorMessage = ''

    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      submitting = false

      if (result.type === 'redirect') {
        await goto(result.location)
        return
      }

      if (result.type === 'failure') {
        errorMessage =
          (result.data as { message?: string } | undefined)?.message ?? 'Unable to create ticket'
        return
      }

      if (result.type === 'error') {
        errorMessage = 'Unable to create ticket right now'
      }
    }
  }
</script>

<form method="post" action="?/createTicket" use:enhance={handleSubmit} class="space-y-4">
  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <div class="space-y-3">
      <label class="grid gap-1.5">
        <span class="text-sm font-medium text-zinc-200">Property</span>
        <Select
          items={[
            { name: 'Select property', value: '' },
            ...properties.map((property) => ({ name: property.name, value: property.id })),
          ]}
          value={propertyId}
          onchange={onPropertyChange}
          classes={{
            select:
              'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 [color-scheme:dark] [&>option]:bg-zinc-900 [&>option]:text-zinc-100 focus:border-emerald-500 focus:ring-emerald-500',
          }}
        />
        <input type="hidden" name="property_id" value={propertyId} />
      </label>

      <label class="grid gap-1.5">
        <span class="text-sm font-medium text-zinc-200">Unit</span>
        <select
          bind:value={unitId}
          name="unit_id"
          disabled={!propertyId || loadingUnits}
          class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">{loadingUnits ? 'Loading units...' : 'Select unit'}</option>
          {#each units as unit}
            <option value={unit.id}>Unit {unit.unitNumber} — {unit.tenantName ?? 'Vacant'}</option>
          {/each}
        </select>
      </label>

      <label class="grid gap-1.5">
        <span class="text-sm font-medium text-zinc-200">Category</span>
        <Select
          items={categoryOptions}
          value={category}
          onchange={(event: Event) => (category = (event.currentTarget as HTMLSelectElement).value)}
          classes={{
            select:
              'w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 [color-scheme:dark] [&>option]:bg-zinc-900 [&>option]:text-zinc-100 focus:border-emerald-500 focus:ring-emerald-500',
          }}
        />
        <input type="hidden" name="category" value={category} />
      </label>

      <label class="grid gap-1.5">
        <span class="text-sm font-medium text-zinc-200">Description</span>
        <textarea
          name="description"
          bind:value={description}
          rows="4"
          minlength="10"
          required
          placeholder="Describe the issue in detail..."
          class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
        ></textarea>
      </label>
    </div>

    <div class="space-y-3">
      <label class="grid gap-1.5">
        <span class="text-sm font-medium text-zinc-200">Assign to caretaker (optional)</span>
        <select
          bind:value={assignedTo}
          name="assigned_to"
          disabled={!propertyId}
          class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <option value="">Unassigned</option>
          {#each filteredCaretakers as caretaker}
            <option value={caretaker.id}>{caretaker.name}</option>
          {/each}
        </select>
      </label>

      <label class="grid gap-1.5">
        <span class="text-sm font-medium text-zinc-200">Internal note (optional)</span>
        <textarea
          name="internal_note"
          bind:value={internalNote}
          rows="2"
          placeholder="Add any additional notes for the team..."
          class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
        ></textarea>
      </label>

      <div class="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
        <p class="text-sm text-zinc-300">
          Tenants can also report issues via SMS by sending:
          <span class="text-zinc-100">REPORT [unit_number] [description]</span>
          to <span class="text-zinc-100">{senderId}</span>
        </p>
      </div>
    </div>
  </div>

  {#if errorMessage}
    <p class="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">{errorMessage}</p>
  {/if}

  <div class="flex flex-wrap items-center justify-end gap-3 border-t border-zinc-800 pt-3">
    <a href={resolve('/maintenance')} class="text-sm text-zinc-400 hover:text-zinc-200">Cancel</a>
    <Button type="submit" color="primary" size="sm" disabled={submitting}>
      {submitting ? 'Logging...' : 'Log Ticket'}
    </Button>
  </div>
</form>
