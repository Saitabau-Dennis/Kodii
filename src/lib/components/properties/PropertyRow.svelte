<script lang="ts">
  import { resolve } from '$app/paths'
  import { PenOutline, TrashBinOutline } from 'flowbite-svelte-icons'
  import { formatKES } from '$lib/utils/trends'
  import type { PropertyWithStats } from '$lib/types/properties'

  interface Props {
    property: PropertyWithStats
    onEdit: (property: PropertyWithStats) => void
    onDelete: (property: PropertyWithStats) => void
    canManage?: boolean
  }

  let { property, onEdit, onDelete, canManage = true }: Props = $props()
</script>

<tr class="border-b border-zinc-800 text-sm text-zinc-300">
  <td class="px-4 py-3">
    <a href={resolve(`/properties/${property.id}`)} class="text-zinc-100 hover:text-emerald-300">
      {property.name}
    </a>
  </td>
  <td class="px-4 py-3">{property.location ?? '—'}</td>
  <td class="px-4 py-3">
    <div class="flex items-center gap-1.5">
      <span class={property.actualUnits >= property.totalUnits ? 'text-zinc-100' : 'text-zinc-400'}>
        {property.actualUnits}
      </span>
      <span class="text-zinc-600">/</span>
      <span class="text-zinc-100">{property.totalUnits}</span>
    </div>
  </td>
  <td class="px-4 py-3">
    <span class="inline-flex items-center rounded-full border border-emerald-500/30 bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
      {property.occupiedUnits}
    </span>
  </td>
  <td class="px-4 py-3">
    <span class="inline-flex items-center rounded-full border border-zinc-500/40 bg-zinc-700/40 px-2 py-0.5 text-[10px] font-semibold text-zinc-200">
      {property.vacantUnits}
    </span>
  </td>
  <td class="px-4 py-3">{formatKES(property.expectedRent)}</td>
  <td class="px-4 py-3">
    {#if property.caretakerName}
      <span>{property.caretakerName}</span>
    {:else}
      <span class="text-zinc-500">Not assigned</span>
    {/if}
  </td>
  <td class="px-4 py-3">
    {#if canManage}
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
          onclick={() => onEdit(property)}
          aria-label="Edit property"
        >
          <PenOutline class="h-4 w-4" />
        </button>
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-900/60 text-red-300 hover:bg-red-950/40"
          onclick={() => onDelete(property)}
          aria-label="Delete property"
        >
          <TrashBinOutline class="h-4 w-4" />
        </button>
      </div>
    {/if}
  </td>
</tr>
