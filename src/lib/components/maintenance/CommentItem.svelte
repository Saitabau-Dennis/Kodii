<script lang="ts">
  import { relativeTime } from '$lib/utils/trends'
  import type { TicketComment } from '$lib/types/maintenance'

  interface Props {
    comment: TicketComment
  }

  let { comment }: Props = $props()

  const initials = $derived.by(() =>
    comment.authorName
      .split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase(),
  )
</script>

<div class="flex items-start gap-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
  <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-xs font-semibold text-zinc-200">
    {initials}
  </div>

  <div class="min-w-0 flex-1 space-y-1">
    <div class="flex flex-wrap items-center gap-2">
      <span class="text-sm font-medium text-zinc-100">{comment.authorName}</span>
      <span class="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">{comment.authorRole}</span>
      <span class="text-xs text-zinc-500">{relativeTime(new Date(comment.createdAt))}</span>
    </div>

    <p class="whitespace-pre-line text-sm text-zinc-300">{comment.message}</p>
  </div>
</div>
