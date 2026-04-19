<script lang="ts">
  import { resolve } from '$app/paths'
  import {
    ArrowLeftToBracketOutline,
    ArrowRightOutline,
    PenOutline,
    TrashBinOutline,
  } from 'flowbite-svelte-icons'
  import { formatKES } from '$lib/utils/trends'
  import type { TenantWithUnit } from '$lib/types/tenants'

  interface Props {
    tenant: TenantWithUnit
    onEdit: (tenant: TenantWithUnit) => void
    onAssign: (tenant: TenantWithUnit) => void
    onMoveOut: (tenant: TenantWithUnit) => void
    onRemove: (tenant: TenantWithUnit) => void
    canManage?: boolean
  }

  let { tenant, onEdit, onAssign, onMoveOut, onRemove, canManage = true }: Props = $props()

  const statusClass = $derived.by(() => {
    if (tenant.status === 'active') return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
    if (tenant.status === 'moved_out') return 'border border-red-500/30 bg-red-500/15 text-red-300'
    return 'border border-zinc-500/30 bg-zinc-500/15 text-zinc-300'
  })

  const statusLabel = $derived.by(() =>
    tenant.status === 'moved_out' ? 'Moved Out' : tenant.status.charAt(0).toUpperCase() + tenant.status.slice(1),
  )
</script>

<tr class="border-b border-zinc-800 text-sm text-zinc-300">
  <td class="px-4 py-3">
    <a href={resolve(`/tenants/${tenant.id}`)} class="text-zinc-100 hover:text-emerald-300">
      {tenant.fullName}
    </a>
  </td>
  <td class="px-4 py-3">{tenant.phoneNumber}</td>
  <td class="px-4 py-3">
    <a href={resolve(`/properties/${tenant.propertyId}`)} class="hover:text-emerald-300">
      {tenant.propertyName}
    </a>
  </td>
  <td class="px-4 py-3">
    {#if tenant.unitId && tenant.unitNumber}
      <a href={resolve(`/units/${tenant.unitId}`)} class="hover:text-emerald-300">{tenant.unitNumber}</a>
    {:else}
      <span class="text-zinc-500">Not assigned</span>
    {/if}
  </td>
  <td class="px-4 py-3">
    <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
      {statusLabel}
    </span>
  </td>
  <td class="px-4 py-3">
    {#if tenant.outstanding > 0}
      <span class="text-red-300">{formatKES(tenant.outstanding)}</span>
    {:else}
      <span class="text-zinc-500">None</span>
    {/if}
  </td>
  <td class="px-4 py-3">
    {#if canManage}
      <div class="flex flex-wrap items-center gap-2">
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
          onclick={() => onEdit(tenant)}
          aria-label="Edit tenant"
        >
          <PenOutline class="h-4 w-4" />
        </button>
        {#if !tenant.unitId}
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-900/60 text-emerald-300 hover:bg-emerald-950/40"
            onclick={() => onAssign(tenant)}
            aria-label="Assign unit"
          >
            <ArrowRightOutline class="h-4 w-4" />
          </button>
        {/if}
        {#if tenant.status === 'active' && tenant.unitId}
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-amber-900/60 text-amber-300 hover:bg-amber-950/40"
            onclick={() => onMoveOut(tenant)}
            aria-label="Move out tenant"
          >
            <ArrowLeftToBracketOutline class="h-4 w-4" />
          </button>
        {/if}
        {#if tenant.status === 'inactive'}
          <button
            type="button"
            class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-900/60 text-red-300 hover:bg-red-950/40"
            onclick={() => onRemove(tenant)}
            aria-label="Remove tenant"
          >
            <TrashBinOutline class="h-4 w-4" />
          </button>
        {/if}
      </div>
    {/if}
  </td>
</tr>
