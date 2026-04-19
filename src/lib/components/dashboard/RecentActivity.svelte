<script lang="ts">
  import { Table } from 'flowbite-svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import { relativeTime } from '$lib/utils/trends'

  export type ActivityRow = {
    id: string
    action: string
    entityType: string | null
    performedBy: string
    createdAt: string
  }

  interface Props {
    activities: ActivityRow[]
  }

  let { activities }: Props = $props()

  function formatAction(action: string) {
    return action.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  }

  function formatEntity(entityType: string | null) {
    if (!entityType) return '—'
    return entityType.replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase())
  }
</script>

<section class="rounded-lg border border-zinc-800">
  <div class="border-b border-zinc-800 px-4 py-3">
    <h3 class="text-base font-semibold text-zinc-100">Recent Activity</h3>
  </div>

  {#if activities.length === 0}
    <div class="p-4">
      <EmptyState message="No recent activity" />
    </div>
  {:else}
    <div class="overflow-x-auto">
      <Table hoverable={true} class="min-w-[720px]">
        <thead class="text-xs uppercase text-zinc-400">
          <tr>
            <th class="px-4 py-3 text-left">Action</th>
            <th class="px-4 py-3 text-left">Entity</th>
            <th class="px-4 py-3 text-left">Performed by</th>
            <th class="px-4 py-3 text-left">Date & Time</th>
          </tr>
        </thead>
        <tbody>
          {#each activities as activity (activity.id)}
            <tr class="border-b border-zinc-800 text-sm text-zinc-300">
              <td class="px-4 py-3">{formatAction(activity.action)}</td>
              <td class="px-4 py-3">{formatEntity(activity.entityType)}</td>
              <td class="px-4 py-3">{activity.performedBy}</td>
              <td class="px-4 py-3">{relativeTime(new Date(activity.createdAt))}</td>
            </tr>
          {/each}
        </tbody>
      </Table>
    </div>
  {/if}
</section>
