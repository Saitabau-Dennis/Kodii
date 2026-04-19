<script lang="ts">
  type ReportCard = {
    title: string
    value: string
    subtitle: string
    color?: 'default' | 'green' | 'amber' | 'red'
  }

  interface Props {
    cards: ReportCard[]
  }

  let { cards }: Props = $props()
</script>

<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
  {#each cards as card}
    <div class="rounded-lg border border-gray-200 p-4 shadow-sm dark:border-gray-800">
      <p class="text-sm font-medium text-gray-500 dark:text-gray-400">{card.title}</p>
      <p
        class={`mt-2 text-2xl font-bold ${
          card.color === 'amber'
            ? 'text-amber-600 dark:text-amber-400'
            : card.color === 'red'
              ? 'text-red-600 dark:text-red-400'
              : 'text-gray-900 dark:text-white'
        }`}
      >
        {card.value}
      </p>
      <p class="mt-1 text-xs text-gray-400 dark:text-gray-500">{card.subtitle}</p>
    </div>
  {/each}
</div>
