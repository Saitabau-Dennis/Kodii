<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title?: string
    subtitle?: string
    left?: Snippet
    right?: Snippet
  }

  let { title, subtitle, left, right }: Props = $props()
</script>

<div class="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
  <div class="flex flex-1 flex-wrap items-center gap-3">
    <div class="flex flex-col">
      {#if title}
        <h2 class="mr-2 text-xl font-bold text-zinc-100">{title}</h2>
      {/if}
      {#if subtitle}
        <p class="text-xs text-zinc-500">{subtitle}</p>
      {/if}
    </div>
    <div class="flex flex-wrap items-center gap-2">
      {@render left?.()}
    </div>
  </div>
  <div class="flex shrink-0 items-center gap-3">
    {@render right?.()}
  </div>
</div>
