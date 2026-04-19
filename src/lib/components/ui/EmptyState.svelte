<script lang="ts">
  import type { Snippet } from 'svelte'

  interface Props {
    title?: string
    message?: string // For backward compatibility
    description?: string
    icon?: any
    iconColor?: string
    children?: Snippet
  }

  let { title, message, description, icon, iconColor = 'text-zinc-500', children }: Props = $props()
  const Icon = $derived(icon)
  const displayTitle = $derived(title || message || 'No data')
</script>

<div class="flex min-h-[200px] flex-col items-center justify-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950/50 px-6 py-8 text-center">
  {#if Icon}
    <div class="mb-1 rounded-full bg-zinc-900/50 p-3">
      <Icon class={`h-6 w-6 ${iconColor}`} />
    </div>
  {/if}
  <div class="max-w-xs space-y-1">
    <h3 class="text-sm font-semibold text-zinc-200">{displayTitle}</h3>
    {#if description}
      <p class="text-xs text-zinc-500">{description}</p>
    {/if}
  </div>
  {#if children}
    <div class="mt-2">
      {@render children()}
    </div>
  {/if}
</div>
