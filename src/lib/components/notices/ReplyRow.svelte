<script lang="ts">
  import { relativeTime } from '$lib/utils/trends'
  import type { NoticeReply } from '$lib/types/notices'

  interface Props {
    reply: NoticeReply
  }

  let { reply }: Props = $props()

  function replyStatusClass(isRead: boolean) {
    return isRead
      ? 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
      : 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
  }
</script>

<tr class={`border-b border-zinc-800 text-sm text-zinc-300 ${!reply.isRead ? 'bg-amber-950/10' : ''}`}>
  <td class="px-4 py-3">{reply.fromPhone}</td>
  <td class="px-4 py-3">{reply.tenantName ?? 'Unknown'}</td>
  <td class="px-4 py-3">{reply.message}</td>
  <td class="px-4 py-3">{relativeTime(new Date(reply.receivedAt))}</td>
  <td class="px-4 py-3">
    <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${replyStatusClass(reply.isRead)}`}>
      {reply.isRead ? 'Read' : 'Unread'}
    </span>
  </td>
</tr>
