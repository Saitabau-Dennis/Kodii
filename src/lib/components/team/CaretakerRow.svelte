<script lang="ts">
  import { TrashBinOutline } from 'flowbite-svelte-icons'
  import type { CaretakerWithProperties } from '$lib/services/users'

  interface Props {
    caretaker: CaretakerWithProperties
    onAssign: (caretaker: CaretakerWithProperties) => void
    onDeactivate: (caretaker: CaretakerWithProperties) => void
    onReactivate: (caretaker: CaretakerWithProperties) => void
    onDelete: (caretaker: CaretakerWithProperties) => void
  }

  let { caretaker, onAssign, onDeactivate, onReactivate, onDelete }: Props = $props()

  const addedDate = $derived(
    new Intl.DateTimeFormat('en-KE', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
    }).format(new Date(caretaker.createdAt)),
  )

  const statusLabel = $derived(
    caretaker.inviteStatus === 'accepted'
      ? 'Accepted'
      : caretaker.inviteStatus === 'deactivated'
        ? 'Deactivated'
        : 'Invite Pending',
  )

  const statusClass = $derived(
    caretaker.inviteStatus === 'accepted'
      ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
      : caretaker.inviteStatus === 'deactivated'
        ? 'border border-red-500/30 bg-red-500/15 text-red-300'
        : 'border border-amber-500/30 bg-amber-500/15 text-amber-300',
  )
</script>

<tr class="border-b border-zinc-800 bg-transparent text-sm text-zinc-300">
  <td class="px-4 py-3">{caretaker.name}</td>
  <td class="px-4 py-3">{caretaker.phone}</td>
  <td class="px-4 py-3">
    <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClass}`}>
      {statusLabel}
    </span>
  </td>
  <td class="px-4 py-3">{caretaker.properties.length}</td>
  <td class="px-4 py-3">{addedDate}</td>
  <td class="px-4 py-3">
    <div class="flex flex-wrap gap-2">
      <button
        type="button"
        class="rounded-lg border border-zinc-700 px-2 py-1 text-xs font-medium text-zinc-200 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
        onclick={() => onAssign(caretaker)}
        disabled={caretaker.inviteStatus === 'deactivated'}
      >
        Assign Properties
      </button>

      {#if caretaker.inviteStatus === 'accepted'}
        <button
          type="button"
          class="rounded-lg border border-red-900/60 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-950/40"
          onclick={() => onDeactivate(caretaker)}
        >
          Deactivate
        </button>
      {:else if caretaker.inviteStatus === 'deactivated'}
        <button
          type="button"
          class="rounded-lg border border-emerald-900/60 px-2 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-950/40"
          onclick={() => onReactivate(caretaker)}
        >
          Reactivate
        </button>
      {/if}

      <button
        type="button"
        class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-red-900/60 text-red-300 hover:bg-red-950/40 transition-colors"
        onclick={() => onDelete(caretaker)}
        aria-label="Delete caretaker"
      >
        <TrashBinOutline class="h-4 w-4" />
      </button>
    </div>
  </td>
</tr>
