<script lang="ts">
  import { CheckOutline } from 'flowbite-svelte-icons'
  import type { TicketStatus } from '$lib/types/maintenance'

  interface Props {
    currentStatus: TicketStatus
    createdAt: Date
    updatedAt: Date
    resolvedAt: Date | null
  }

  let { currentStatus, createdAt, updatedAt, resolvedAt }: Props = $props()

  const statuses: TicketStatus[] = ['open', 'in_progress', 'resolved', 'closed']

  const currentIndex = $derived(statuses.indexOf(currentStatus))

  function label(status: TicketStatus) {
    if (status === 'in_progress') return 'In Progress'
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  function timestampFor(status: TicketStatus): Date | null {
    if (status === 'open') return createdAt
    if (status === 'resolved') return resolvedAt ?? (currentStatus === 'resolved' ? updatedAt : null)
    if (status === 'closed') return currentStatus === 'closed' ? updatedAt : null

    if (status === 'in_progress') {
      if (currentStatus === 'in_progress' || currentStatus === 'resolved' || currentStatus === 'closed') {
        return updatedAt
      }
    }

    return null
  }

  function formatDate(date: Date | null) {
    if (!date) return ''
    return new Date(date).toLocaleString('en-KE', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    })
  }
</script>

<div class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
  <h3 class="mb-4 text-sm font-medium text-zinc-200">Status Timeline</h3>

  <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
    {#each statuses as status, index}
      {@const done = index < currentIndex}
      {@const active = index === currentIndex}
      {@const date = done || active ? timestampFor(status) : null}

      <div class="relative rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
        <div class="mb-2 flex items-center gap-2">
          <span
            class={`inline-flex h-5 w-5 items-center justify-center rounded-full border text-xs ${
              done
                ? 'border-emerald-500 bg-emerald-500 text-emerald-950'
                : active
                  ? 'border-emerald-500 bg-emerald-500/20 text-emerald-400'
                  : 'border-zinc-700 text-zinc-500'
            }`}
          >
            {#if done}
              <CheckOutline class="h-3 w-3" />
            {:else}
              {index + 1}
            {/if}
          </span>
          <span class={`text-sm ${done || active ? 'text-zinc-100' : 'text-zinc-500'}`}>{label(status)}</span>
        </div>

        {#if date}
          <p class="text-xs text-zinc-500">{formatDate(date)}</p>
        {/if}
      </div>
    {/each}
  </div>
</div>
