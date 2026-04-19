<script lang="ts">
  import type { ActionResult } from '@sveltejs/kit'
  import { enhance } from '$app/forms'
  import { invalidateAll } from '$app/navigation'
  import { Button } from 'flowbite-svelte'
  import CommentItem from './CommentItem.svelte'
  import type { TicketComment } from '$lib/types/maintenance'

  interface Props {
    comments: TicketComment[]
    ticketId: string
    isClosed: boolean
  }

  let { comments, ticketId, isClosed }: Props = $props()

  let message = $state('')
  let submitting = $state(false)
  let errorMessage = $state('')

  function handleSubmit() {
    submitting = true
    errorMessage = ''

    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      submitting = false

      if (result.type === 'success') {
        message = ''
        await invalidateAll()
        return
      }

      if (result.type === 'failure') {
        errorMessage = (result.data as { message?: string } | undefined)?.message ?? 'Unable to add note'
        return
      }

      if (result.type === 'error') {
        errorMessage = 'Unable to add note right now'
      }
    }
  }
</script>

<section class="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
  <div>
    <h3 class="text-sm font-medium text-zinc-100">Internal Notes</h3>
    <p class="text-xs text-zinc-500">Notes are only visible to landlord and caretakers</p>
  </div>

  {#if comments.length === 0}
    <p class="text-sm text-zinc-500">No notes yet. Add the first one.</p>
  {:else}
    <div class="space-y-2">
      {#each comments as comment (comment.id)}
        <CommentItem {comment} />
      {/each}
    </div>
  {/if}

  {#if !isClosed}
    <form method="post" action="?/addComment" use:enhance={handleSubmit} class="space-y-2 border-t border-zinc-800 pt-3">
      <input type="hidden" name="id" value={ticketId} />
      <label class="grid gap-1">
        <span class="text-xs text-zinc-400">Add a note</span>
        <textarea
          name="message"
          bind:value={message}
          rows="2"
          minlength="2"
          required
          class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
          placeholder="Add a note..."
        ></textarea>
      </label>

      {#if errorMessage}
        <p class="text-xs text-red-300">{errorMessage}</p>
      {/if}

      <div class="flex justify-end">
        <Button color="primary" size="sm" type="submit" disabled={submitting}>
          {submitting ? 'Adding...' : 'Add Note'}
        </Button>
      </div>
    </form>
  {/if}
</section>
