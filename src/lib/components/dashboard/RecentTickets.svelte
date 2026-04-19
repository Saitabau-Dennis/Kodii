<script lang="ts">
  import { goto } from '$app/navigation'
  import { Table } from 'flowbite-svelte'
  import { ToolsOutline } from 'flowbite-svelte-icons'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'

  export type TicketRow = {
    id: string
    unitNumber: string
    category: string
    status: 'open' | 'in_progress' | 'resolved' | 'closed'
    date: string
  }

  interface Props {
    tickets: TicketRow[]
    title?: string
    viewHref?: string
  }

  let { tickets, title = 'Maintenance Tickets', viewHref = '/maintenance' }: Props = $props()

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  function ticketStatusLabel(status: TicketRow['status']) {
    return status.replace('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  }

  function ticketStatusClasses(status: TicketRow['status']) {
    if (status === 'resolved') return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
    if (status === 'closed') return 'border border-zinc-500/30 bg-zinc-500/15 text-zinc-300'
    if (status === 'in_progress') return 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
    return 'border border-red-500/30 bg-red-500/15 text-red-300'
  }

  function openTicket(ticketId: string) {
    goto(`/maintenance/${ticketId}`)
  }
</script>

<section class="rounded-lg border border-zinc-800">
  <div class="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
    <div>
      <h3 class="text-base font-semibold text-zinc-100">{title}</h3>
    </div>
    <a href={viewHref} class="text-sm text-emerald-400 hover:text-emerald-300">View all →</a>
  </div>

  {#if tickets.length === 0}
    <div class="p-4">
      <EmptyState message="No open tickets" icon={ToolsOutline} />
    </div>
  {:else}
    <div class="overflow-x-auto">
      <Table hoverable={true} class="min-w-[560px]">
        <thead class="text-xs uppercase text-zinc-400">
          <tr>
            <th class="px-4 py-3 text-left">Unit</th>
            <th class="px-4 py-3 text-left">Category</th>
            <th class="px-4 py-3 text-left">Status</th>
            <th class="px-4 py-3 text-left">Date</th>
          </tr>
        </thead>
        <tbody>
          {#each tickets as ticket (ticket.id)}
            <tr
              class="cursor-pointer border-b border-zinc-800 text-sm text-zinc-300"
              onclick={() => openTicket(ticket.id)}
            >
              <td class="px-4 py-3">{ticket.unitNumber}</td>
              <td class="px-4 py-3 capitalize">{ticket.category}</td>
              <td class="px-4 py-3">
                <span
                  class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium tracking-wide ${ticketStatusClasses(
                    ticket.status,
                  )}`}
                >
                  {ticketStatusLabel(ticket.status)}
                </span>
              </td>
              <td class="px-4 py-3">{formatDate(ticket.date)}</td>
            </tr>
          {/each}
        </tbody>
      </Table>
    </div>
  {/if}
</section>
