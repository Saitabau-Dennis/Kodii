<script lang="ts">
  import { EyeOutline } from 'flowbite-svelte-icons'
  import type { NoticeWithMeta } from '$lib/types/notices'

  interface Props {
    notice: NoticeWithMeta
  }

  let { notice }: Props = $props()

  function formatDate(date: Date | string) {
    return new Date(date).toLocaleString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function badgeClass(kind: 'default' | 'unread') {
    if (kind === 'unread') return 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
    return 'border border-zinc-500/40 bg-zinc-700/40 text-zinc-200'
  }
</script>

<tr class="border-b border-zinc-800 text-sm text-zinc-300">
  <td class="px-4 py-3">
    <a href={`/notices/${notice.id}`} class="text-zinc-100 hover:text-emerald-300">
      {#if notice.title}
        {notice.title}
      {:else}
        <span class="italic text-zinc-500">{notice.message.slice(0, 50)}{notice.message.length > 50 ? '...' : ''}</span>
      {/if}
    </a>
  </td>
  <td class="px-4 py-3">{notice.targetDescription}</td>
  <td class="px-4 py-3">{notice.sentBy}</td>
  <td class="px-4 py-3">{formatDate(notice.sentAt)}</td>
  <td class="px-4 py-3">
    <div class="flex items-center gap-2">
      <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass('default')}`}>
        {notice.replyCount}
      </span>
      {#if notice.unreadReplyCount > 0}
        <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${badgeClass('unread')}`}>
          {notice.unreadReplyCount} unread
        </span>
      {/if}
    </div>
  </td>
  <td class="px-4 py-3">
    <a
      href={`/notices/${notice.id}`}
      class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-900"
      aria-label="View notice"
    >
      <EyeOutline class="h-4 w-4" />
    </a>
  </td>
</tr>
