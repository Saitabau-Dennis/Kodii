<script lang="ts">
  interface Props {
    title: string
    description?: string
  }

  let { title, description = 'This page is coming soon.' }: Props = $props()
</script>

<section class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
  <h2 class="text-base font-semibold text-zinc-100">{title}</h2>
  <p class="mt-1 text-sm text-zinc-400">{description}</p>
</section>
