<script lang="ts">
  import type { ActionResult } from '@sveltejs/kit'
  import { enhance } from '$app/forms'
  import { invalidateAll } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { Button } from 'flowbite-svelte'
  import {
    GlassWaterDropletOutline,
    QuestionCircleOutline,
    ShieldOutline,
    ToolsOutline,
  } from 'flowbite-svelte-icons'
  import CommentList from '$lib/components/maintenance/CommentList.svelte'
  import StatusTimeline from '$lib/components/maintenance/StatusTimeline.svelte'
  import type { TicketStatus } from '$lib/types/maintenance'
  import { relativeTime } from '$lib/utils/trends'

  let { data } = $props() as { data: any }

  const isLandlord = $derived(data.user.role === 'landlord')
  const isClosed = $derived(data.ticket.status === 'closed')

  const categoryIcon = $derived.by(() => {
    if (data.ticket.category === 'water') return GlassWaterDropletOutline
    if (data.ticket.category === 'electricity') return ToolsOutline
    if (data.ticket.category === 'plumbing') return ToolsOutline
    if (data.ticket.category === 'security') return ShieldOutline
    return QuestionCircleOutline
  })

  const categoryLabel = $derived.by(() =>
    data.ticket.category.charAt(0).toUpperCase() + data.ticket.category.slice(1),
  )

  const statusLabel = $derived.by(() =>
    data.ticket.status === 'in_progress'
      ? 'In Progress'
      : data.ticket.status.charAt(0).toUpperCase() + data.ticket.status.slice(1),
  )

  const statusClass = $derived.by(() => {
    if (data.ticket.status === 'open') return 'border border-red-500/30 bg-red-500/15 text-red-300'
    if (data.ticket.status === 'in_progress')
      return 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
    if (data.ticket.status === 'resolved')
      return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
    return 'border border-zinc-500/30 bg-zinc-500/15 text-zinc-300'
  })

  const availableCaretakers = $derived(data.caretakers)
  const CategoryIcon = $derived(categoryIcon)
  let selectedCaretaker = $state('')
  let isStatusSubmitting = $state(false)
  let statusFeedback = $state('')
  let statusError = $state('')

  $effect(() => {
    selectedCaretaker = data.ticket.assignedTo ?? ''
  })

  function formatDate(value: Date | string | null) {
    if (!value) return '—'
    return new Date(value).toLocaleString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function withRefresh() {
    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      if (result.type === 'success') {
        await invalidateAll()
      }
    }
  }

  function withStatusProgress(nextStatusLabel: string) {
    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()

      if (result.type === 'success') {
        statusError = ''
        statusFeedback = `Status updated to ${nextStatusLabel}.`
        await invalidateAll()
        return
      }

      statusFeedback = ''
      statusError =
        result.type === 'failure'
          ? ((result.data as { message?: string } | undefined)?.message ??
            'Unable to update ticket status.')
          : 'Unable to update ticket status.'
    }
  }

  function useStatusEnhance(nextStatusLabel: string) {
    return () => {
      isStatusSubmitting = true
      statusError = ''
      statusFeedback = `Updating status to ${nextStatusLabel}...`

      return async (input: { result: ActionResult; update: () => Promise<void> }) => {
        try {
          await withStatusProgress(nextStatusLabel)(input)
        } finally {
          isStatusSubmitting = false
        }
      }
    }
  }

  function canCaretakerMarkInProgress(status: TicketStatus) {
    return status === 'open'
  }

  function canCaretakerMarkResolved(status: TicketStatus) {
    return status === 'in_progress'
  }
</script>

<section class="space-y-4">
  <a href={resolve('/maintenance')} class="inline-flex text-sm text-zinc-400 hover:text-zinc-200">
    ← Maintenance
  </a>

  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 class="text-xl font-semibold text-zinc-100">TKT-{data.ticket.shortId}</h2>
      <p class="text-sm text-zinc-400">
        {categoryLabel} issue for Unit {data.ticket.unitNumber}, {data.ticket.propertyName}
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}>
        {statusLabel}
      </span>

      {#if data.ticket.status === 'open'}
        {#if isLandlord}
          <form method="post" action="?/updateStatus" use:enhance={useStatusEnhance('In Progress')}>
            <input type="hidden" name="id" value={data.ticket.id} />
            <input type="hidden" name="status" value="in_progress" />
            <Button size="xs" color="primary" type="submit" disabled={isStatusSubmitting}>In Progress</Button>
          </form>
          <form method="post" action="?/updateStatus" use:enhance={useStatusEnhance('Closed')}>
            <input type="hidden" name="id" value={data.ticket.id} />
            <input type="hidden" name="status" value="closed" />
            <Button size="xs" color="dark" type="submit" disabled={isStatusSubmitting}>Close</Button>
          </form>
        {:else if canCaretakerMarkInProgress(data.ticket.status)}
          <form method="post" action="?/updateStatus" use:enhance={useStatusEnhance('In Progress')}>
            <input type="hidden" name="id" value={data.ticket.id} />
            <input type="hidden" name="status" value="in_progress" />
            <Button size="xs" color="primary" type="submit" disabled={isStatusSubmitting}>In Progress</Button>
          </form>
        {/if}
      {:else if data.ticket.status === 'in_progress'}
        {#if isLandlord}
          <form method="post" action="?/updateStatus" use:enhance={useStatusEnhance('Resolved')}>
            <input type="hidden" name="id" value={data.ticket.id} />
            <input type="hidden" name="status" value="resolved" />
            <Button size="xs" color="primary" type="submit" disabled={isStatusSubmitting}>Resolved</Button>
          </form>
          <form method="post" action="?/updateStatus" use:enhance={useStatusEnhance('Closed')}>
            <input type="hidden" name="id" value={data.ticket.id} />
            <input type="hidden" name="status" value="closed" />
            <Button size="xs" color="dark" type="submit" disabled={isStatusSubmitting}>Close</Button>
          </form>
        {:else if canCaretakerMarkResolved(data.ticket.status)}
          <form method="post" action="?/updateStatus" use:enhance={useStatusEnhance('Resolved')}>
            <input type="hidden" name="id" value={data.ticket.id} />
            <input type="hidden" name="status" value="resolved" />
            <Button size="xs" color="primary" type="submit" disabled={isStatusSubmitting}>Mark Resolved</Button>
          </form>
        {/if}
      {:else if data.ticket.status === 'resolved'}
        {#if isLandlord}
          <form method="post" action="?/updateStatus" use:enhance={useStatusEnhance('Closed')}>
            <input type="hidden" name="id" value={data.ticket.id} />
            <input type="hidden" name="status" value="closed" />
            <Button size="xs" color="dark" type="submit" disabled={isStatusSubmitting}>Close</Button>
          </form>
          <form method="post" action="?/reopenTicket" use:enhance={useStatusEnhance('Open')}>
            <input type="hidden" name="id" value={data.ticket.id} />
            <Button size="xs" color="alternative" type="submit" disabled={isStatusSubmitting}>Reopen</Button>
          </form>
        {/if}
      {:else if data.ticket.status === 'closed' && isLandlord}
        <form method="post" action="?/reopenTicket" use:enhance={useStatusEnhance('Open')}>
          <input type="hidden" name="id" value={data.ticket.id} />
          <Button size="xs" color="alternative" type="submit" disabled={isStatusSubmitting}>Reopen</Button>
        </form>
      {/if}
    </div>
  </div>
  {#if isStatusSubmitting || statusFeedback || statusError}
    <div class="mt-1 flex items-center gap-2 text-xs">
      {#if isStatusSubmitting}
        <span class="inline-flex h-3.5 w-3.5 animate-spin rounded-full border border-zinc-600 border-t-emerald-400"></span>
      {/if}
      {#if statusError}
        <p class="text-red-300">{statusError}</p>
      {:else if statusFeedback}
        <p class={isStatusSubmitting ? 'text-zinc-400' : 'text-emerald-300'}>{statusFeedback}</p>
      {/if}
    </div>
  {/if}

  <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
    <section class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
      <h3 class="mb-3 text-sm font-medium text-zinc-100">Ticket Info</h3>
      <div class="space-y-2 text-sm text-zinc-300">
        <p>
          <span class="text-zinc-500">Property:</span>
          <a href={resolve(`/properties/${data.ticket.propertyId}`)} class="ml-1 hover:text-emerald-300">{data.ticket.propertyName}</a>
        </p>
        <p>
          <span class="text-zinc-500">Unit:</span>
          <a href={resolve(`/units/${data.ticket.unitId}`)} class="ml-1 hover:text-emerald-300">{data.ticket.unitNumber}</a>
        </p>
        <p>
          <span class="text-zinc-500">Tenant:</span>
          {#if data.ticket.tenantName}
            <span class="ml-1">{data.ticket.tenantName} ({data.ticket.tenantPhone})</span>
          {:else}
            <span class="ml-1 text-zinc-500">No tenant</span>
          {/if}
        </p>
        <p>
          <span class="text-zinc-500">Reported by:</span>
          <span class="ml-1">{data.ticket.createdViasSMS ? 'Tenant via SMS' : 'Staff via web app'}</span>
        </p>
        <p>
          <span class="text-zinc-500">Reported at:</span>
          <span class="ml-1">{formatDate(data.ticket.createdAt)}</span>
        </p>
      </div>
    </section>

    <section class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
      <h3 class="mb-3 text-sm font-medium text-zinc-100">Status & Assignment</h3>
      <div class="space-y-2 text-sm text-zinc-300">
        <p class="inline-flex items-center gap-2">
          <span class="text-zinc-500">Category:</span>
          <CategoryIcon class="h-4 w-4" />
          {categoryLabel}
        </p>
        <p>
          <span class="text-zinc-500">Status:</span>
          <span
            class={`ml-1 inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass}`}
          >
            {statusLabel}
          </span>
        </p>
        <p>
          <span class="text-zinc-500">Assigned to:</span>
          {#if data.ticket.assignedToName}
            <span class="ml-1">{data.ticket.assignedToName}</span>
          {:else}
            <span class="ml-1 text-zinc-500">Unassigned</span>
          {/if}
        </p>
        <p>
          <span class="text-zinc-500">Created:</span>
          <span class="ml-1">{relativeTime(new Date(data.ticket.createdAt))}</span>
        </p>
        <p>
          <span class="text-zinc-500">Last updated:</span>
          <span class="ml-1">{relativeTime(new Date(data.ticket.updatedAt))}</span>
        </p>
        {#if data.ticket.resolvedAt}
          <p>
            <span class="text-zinc-500">Resolved at:</span>
            <span class="ml-1">{formatDate(data.ticket.resolvedAt)}</span>
          </p>
        {/if}
      </div>
    </section>
  </div>

  <section class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
    <div class="mb-2 flex items-center gap-2">
      <h3 class="text-sm font-medium text-zinc-100">Description</h3>
      {#if data.ticket.createdViasSMS}
        <span class="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">Reported via SMS</span>
      {/if}
    </div>
    <p class="whitespace-pre-line text-sm text-zinc-300">{data.ticket.description}</p>
  </section>

  <StatusTimeline
    currentStatus={data.ticket.status}
    createdAt={new Date(data.ticket.createdAt)}
    updatedAt={new Date(data.ticket.updatedAt)}
    resolvedAt={data.ticket.resolvedAt ? new Date(data.ticket.resolvedAt) : null}
  />

  {#if isLandlord && !isClosed}
    <section class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
      <h3 class="mb-3 text-sm font-medium text-zinc-100">Assign Caretaker</h3>

      <form method="post" action="?/assignCaretaker" use:enhance={withRefresh} class="flex flex-wrap items-end gap-2">
        <input type="hidden" name="id" value={data.ticket.id} />
        <label class="grid gap-1">
          <span class="text-xs text-zinc-400">Caretaker</span>
          <select
            name="caretakerId"
            bind:value={selectedCaretaker}
            class="min-w-[220px] rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100"
          >
            <option value="">Select caretaker</option>
            {#each availableCaretakers as caretaker}
              <option value={caretaker.id}>{caretaker.name}</option>
            {/each}
          </select>
        </label>
        <Button type="submit" color="primary" size="sm" disabled={!selectedCaretaker}>
          {data.ticket.assignedTo ? 'Reassign' : 'Assign'}
        </Button>
      </form>

      {#if data.ticket.assignedTo}
        <form method="post" action="?/unassignCaretaker" use:enhance={withRefresh} class="mt-3">
          <input type="hidden" name="id" value={data.ticket.id} />
          <Button type="submit" color="dark" size="xs">Unassign</Button>
        </form>
      {/if}
    </section>
  {/if}

  <CommentList comments={data.comments} ticketId={data.ticket.id} isClosed={isClosed} />
</section>
