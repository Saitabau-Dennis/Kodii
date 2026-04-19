<script lang="ts">
  import { resolve } from '$app/paths'
  import {
    EyeOutline,
    GlassWaterDropletOutline,
    QuestionCircleOutline,
    ShieldOutline,
    ToolsOutline,
  } from 'flowbite-svelte-icons'
  import { relativeTime } from '$lib/utils/trends'
  import type { TicketWithDetails } from '$lib/types/maintenance'

  interface Props {
    ticket: TicketWithDetails
  }

  let { ticket }: Props = $props()

  const statusLabel = $derived.by(() =>
    ticket.status === 'in_progress' ? 'in progress' : ticket.status,
  )

  const statusClass = $derived.by(() => {
    if (ticket.status === 'open') return 'border border-red-500/30 bg-red-500/15 text-red-300'
    if (ticket.status === 'in_progress')
      return 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
    if (ticket.status === 'resolved')
      return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
    return 'border border-zinc-500/30 bg-zinc-500/15 text-zinc-300'
  })

  const categoryIcon = $derived.by(() => {
    if (ticket.category === 'water') return GlassWaterDropletOutline
    if (ticket.category === 'electricity') return ToolsOutline
    if (ticket.category === 'plumbing') return ToolsOutline
    if (ticket.category === 'security') return ShieldOutline
    return QuestionCircleOutline
  })

  const categoryLabel = $derived.by(() =>
    ticket.category.charAt(0).toUpperCase() + ticket.category.slice(1),
  )
  const CategoryIcon = $derived(categoryIcon)

  const shortDescription = $derived.by(() =>
    ticket.description.length > 50 ? `${ticket.description.slice(0, 50)}...` : ticket.description,
  )
</script>

<tr class="border-b border-zinc-800 text-sm text-zinc-300">
  <td class="px-4 py-3 font-medium text-zinc-100">TKT-{ticket.shortId}</td>
  <td class="px-4 py-3">
    <a href={resolve(`/units/${ticket.unitId}`)} class="hover:text-emerald-300">{ticket.unitNumber}</a>
  </td>
  <td class="px-4 py-3">
    <a href={resolve(`/properties/${ticket.propertyId}`)} class="hover:text-emerald-300">{ticket.propertyName}</a>
  </td>
  <td class="px-4 py-3">
    <span class="inline-flex items-center gap-1">
      <CategoryIcon class="h-4 w-4" />
      {categoryLabel}
    </span>
  </td>
  <td class="px-4 py-3">{shortDescription}</td>
  <td class="px-4 py-3">
    <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
      {statusLabel}
    </span>
  </td>
  <td class="px-4 py-3">
    {#if ticket.assignedToName}
      {ticket.assignedToName}
    {:else}
      <span class="text-zinc-500">Unassigned</span>
    {/if}
  </td>
  <td class="px-4 py-3">{relativeTime(new Date(ticket.createdAt))}</td>
  <td class="px-4 py-3">
    <a
      href={resolve(`/maintenance/${ticket.id}`)}
      class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
      aria-label="View ticket"
    >
      <EyeOutline class="h-4 w-4" />
    </a>
  </td>
</tr>
