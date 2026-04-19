<script lang="ts">
  import { resolve } from '$app/paths'
  import {
    ArrowLeftToBracketOutline,
    CircleMinusOutline,
    PenOutline,
    TrashBinOutline,
  } from 'flowbite-svelte-icons'
  import { formatKES } from '$lib/utils/trends'
  import type { UnitWithDetails } from '$lib/types/units'

  interface Props {
    unit: UnitWithDetails
    onEdit: (unit: UnitWithDetails) => void
    onDelete: (unit: UnitWithDetails) => void
    onMarkVacant: (unit: UnitWithDetails) => void
    onMarkInactive: (unit: UnitWithDetails) => void
    canManage?: boolean
  }

  let { unit, onEdit, onDelete, onMarkVacant, onMarkInactive, canManage = true }: Props = $props()

  const statusLabel = $derived.by(() =>
    unit.status.charAt(0).toUpperCase() + unit.status.slice(1),
  )

  const statusClass = $derived.by(() => {
    if (unit.status === 'occupied') return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
    if (unit.status === 'inactive') return 'border border-red-500/30 bg-red-500/15 text-red-300'
    return 'border border-zinc-500/30 bg-zinc-500/15 text-zinc-300'
  })
</script>

<tr class="border-b border-zinc-800 text-sm text-zinc-300">
  <td class="px-4 py-3">
    <a href={resolve(`/units/${unit.id}`)} class="text-zinc-100 hover:text-emerald-300">{unit.unitNumber}</a>
  </td>
  <td class="px-4 py-3">
    <a href={resolve(`/properties/${unit.propertyId}`)} class="hover:text-emerald-300">{unit.propertyName}</a>
  </td>
  <td class="px-4 py-3">{formatKES(unit.monthlyRent)}</td>
  <td class="px-4 py-3">
    <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
      {statusLabel}
    </span>
  </td>
  <td class="px-4 py-3">
    {#if unit.tenantName}
      {unit.tenantName}
    {:else}
      <span class="text-zinc-500">Vacant</span>
    {/if}
  </td>
  <td class="px-4 py-3">
    {#if canManage}
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
          onclick={() => onEdit(unit)}
          aria-label="Edit unit"
        >
          <PenOutline class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-900/60 text-red-300 hover:bg-red-950/40"
          onclick={() => onDelete(unit)}
          aria-label="Delete unit"
        >
          <TrashBinOutline class="h-4 w-4" />
        </button>
        {#if unit.status === 'occupied'}
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-amber-900/60 text-amber-300 hover:bg-amber-950/40"
            onclick={() => onMarkVacant(unit)}
            aria-label="Mark unit vacant"
          >
            <ArrowLeftToBracketOutline class="h-4 w-4" />
          </button>
        {/if}
        {#if unit.status !== 'inactive'}
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
            onclick={() => onMarkInactive(unit)}
            aria-label="Mark unit inactive"
          >
            <CircleMinusOutline class="h-4 w-4" />
          </button>
        {/if}
      </div>
    {/if}
  </td>
</tr>
