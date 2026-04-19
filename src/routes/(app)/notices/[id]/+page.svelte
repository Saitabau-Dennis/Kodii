<script lang="ts">
  import { enhance } from '$app/forms'
  import { resolve } from '$app/paths'
  import { Table } from 'flowbite-svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import ReplyRow from '$lib/components/notices/ReplyRow.svelte'

  let { data, form } = $props() as { data: any; form?: { message?: string } }
  let isResending = $state(false)

  function formatDate(date: Date) {
    return new Date(date).toLocaleString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function targetLabel(type: 'all_tenants' | 'property' | 'unit' | 'tenant') {
    if (type === 'all_tenants') return 'All Tenants'
    if (type === 'property') return 'Property'
    if (type === 'unit') return 'Unit'
    return 'Tenant'
  }

  function targetBadgeClass(type: 'all_tenants' | 'property' | 'unit' | 'tenant') {
    if (type === 'all_tenants') return 'border border-zinc-500/40 bg-zinc-700/40 text-zinc-200'
    if (type === 'property') return 'border border-sky-500/30 bg-sky-500/15 text-sky-300'
    if (type === 'unit') return 'border border-violet-500/30 bg-violet-500/15 text-violet-300'
    return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
  }

  function deliveryBadgeClass(status: string | null) {
    if (status === 'sent') return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
    if (status === 'failed') return 'border border-red-500/30 bg-red-500/15 text-red-300'
    return 'border border-zinc-500/40 bg-zinc-700/40 text-zinc-200'
  }
</script>

<section class="space-y-4">
  <a href={resolve('/notices')} class="inline-flex text-sm text-zinc-400 hover:text-zinc-200">← Notices</a>

  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 class="text-xl font-semibold text-zinc-100">{data.notice.title ?? 'Notice'}</h2>
      <p class="text-sm text-zinc-400">{formatDate(data.notice.sentAt)}</p>
    </div>
    <div class="flex flex-wrap items-center justify-end gap-2">
      <form
        method="post"
        action="?/resend"
        use:enhance={() => {
          isResending = true
          return async ({ update }) => {
            await update()
            isResending = false
          }
        }}
      >
        <button
          type="submit"
          disabled={isResending}
          class="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isResending ? 'Resending...' : 'Resend Notice'}
        </button>
      </form>
      <span
        class={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${targetBadgeClass(data.notice.targetType)}`}
      >
        {targetLabel(data.notice.targetType)}
      </span>
      <span class="text-sm text-zinc-400">Sent by: {data.notice.sentBy}</span>
    </div>
  </div>

  {#if form?.message}
    <p class="rounded-lg border border-zinc-700 bg-zinc-900/70 px-3 py-2 text-sm text-zinc-200">{form.message}</p>
  {/if}

  <section class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
    <div class="grid grid-cols-1 gap-2 text-sm text-zinc-300 sm:grid-cols-2">
      <p><span class="text-zinc-500">Target:</span> {data.notice.targetDescription}</p>
      <p><span class="text-zinc-500">Sent by:</span> {data.notice.sentBy}</p>
      <p><span class="text-zinc-500">Sent at:</span> {formatDate(data.notice.sentAt)}</p>
      <p>
        <span class="text-zinc-500">Delivery status:</span>
        <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${deliveryBadgeClass(data.notice.deliveryStatus)}`}>
          {data.notice.deliveryStatus ?? 'unknown'}
        </span>
      </p>
    </div>

    <div class="mt-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
      <p class="mb-1 text-xs font-medium uppercase tracking-wide text-zinc-500">Message</p>
      <div class="max-w-lg rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100">
        [KODII] {data.notice.message}
      </div>
    </div>
  </section>

  <section class="rounded-lg border border-zinc-800 bg-zinc-950/70">
    <div class="border-b border-zinc-800 px-4 py-3">
      <h3 class="text-base font-semibold text-zinc-100">Tenant Replies ({data.replies.length})</h3>
    </div>

    {#if data.replies.length === 0}
      <div class="p-4">
        <EmptyState message="No replies yet" />
        <p class="mt-2 text-center text-sm text-zinc-500">
          Replies will appear here when tenants respond via SMS.
        </p>
      </div>
    {:else}
      <div class="overflow-x-auto">
        <Table hoverable={true} class="min-w-[920px]">
          <thead class="bg-zinc-900 text-xs uppercase text-zinc-400">
            <tr>
              <th class="px-4 py-3 text-left">From</th>
              <th class="px-4 py-3 text-left">Tenant</th>
              <th class="px-4 py-3 text-left">Message</th>
              <th class="px-4 py-3 text-left">Received At</th>
              <th class="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {#each data.replies as reply (reply.id)}
              <ReplyRow {reply} />
            {/each}
          </tbody>
        </Table>
      </div>
    {/if}
  </section>
</section>
