<script lang="ts">
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'

  interface Props {
    from: string
    to: string
    onApply?: (from: string, to: string) => void
  }

  let { from, to, onApply }: Props = $props()

  let fromInput = $state('')
  let toInput = $state('')

  $effect(() => {
    from
    fromInput = from
  })

  $effect(() => {
    to
    toInput = to
  })

  function dateKey(value: Date): string {
    return value.toISOString().slice(0, 10)
  }

  function quickRange(kind: 'this-month' | 'last-month' | 'last-3-months' | 'this-year') {
    const now = new Date()
    const today = dateKey(now)

    if (kind === 'this-month') {
      return {
        from: dateKey(new Date(now.getFullYear(), now.getMonth(), 1)),
        to: today,
      }
    }

    if (kind === 'last-month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const end = new Date(now.getFullYear(), now.getMonth(), 0)
      return { from: dateKey(start), to: dateKey(end) }
    }

    if (kind === 'last-3-months') {
      return {
        from: dateKey(new Date(now.getFullYear(), now.getMonth() - 2, 1)),
        to: today,
      }
    }

    return {
      from: dateKey(new Date(now.getFullYear(), 0, 1)),
      to: today,
    }
  }

  function isActive(kind: 'this-month' | 'last-month' | 'last-3-months' | 'this-year') {
    const range = quickRange(kind)
    return fromInput === range.from && toInput === range.to
  }

  function setQuick(kind: 'this-month' | 'last-month' | 'last-3-months' | 'this-year') {
    const range = quickRange(kind)
    fromInput = range.from
    toInput = range.to
    apply(range.from, range.to)
  }

  function apply(fromValue = fromInput, toValue = toInput) {
    if (!fromValue || !toValue) return
    if (fromValue > toValue) return

    const url = `${resolve('/reports')}?from=${fromValue}&to=${toValue}`
    onApply?.(fromValue, toValue)
    goto(url)
  }
</script>

<div class="flex flex-wrap items-center gap-3">
  <div class="flex items-center gap-2">
    <span class="text-xs text-zinc-500">From</span>
    <input
      type="date"
      bind:value={fromInput}
      class="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
    />
    <span class="text-xs text-zinc-500">To</span>
    <input
      type="date"
      bind:value={toInput}
      class="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-2 text-sm text-zinc-100 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
    />
    <button
      type="button"
      onclick={() => apply()}
      class="h-9 rounded-lg bg-emerald-500 px-3 text-sm font-medium text-emerald-950 hover:bg-emerald-400 transition-colors"
    >
      Apply
    </button>
  </div>

  <div class="flex items-center gap-1.5 border-l border-zinc-800 pl-3">
    <button
      type="button"
      onclick={() => setQuick('this-month')}
      class={`rounded-md border px-3 py-1.5 text-sm transition ${
        isActive('this-month')
          ? 'border-emerald-500 bg-emerald-500/15 bg-[repeating-linear-gradient(45deg,rgba(16,185,129,0.18)_0,rgba(16,185,129,0.18)_1px,transparent_1px,transparent_10px),repeating-linear-gradient(-45deg,rgba(16,185,129,0.14)_0,rgba(16,185,129,0.14)_1px,transparent_1px,transparent_10px)] text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
          : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400'
      }`}
    >
      This Month
    </button>
    <button
      type="button"
      onclick={() => setQuick('last-month')}
      class={`rounded-md border px-3 py-1.5 text-sm transition ${
        isActive('last-month')
          ? 'border-emerald-500 bg-emerald-500/15 bg-[repeating-linear-gradient(45deg,rgba(16,185,129,0.18)_0,rgba(16,185,129,0.18)_1px,transparent_1px,transparent_10px),repeating-linear-gradient(-45deg,rgba(16,185,129,0.14)_0,rgba(16,185,129,0.14)_1px,transparent_1px,transparent_10px)] text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
          : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400'
      }`}
    >
      Last Month
    </button>
    <button
      type="button"
      onclick={() => setQuick('last-3-months')}
      class={`rounded-md border px-3 py-1.5 text-sm transition ${
        isActive('last-3-months')
          ? 'border-emerald-500 bg-emerald-500/15 bg-[repeating-linear-gradient(45deg,rgba(16,185,129,0.18)_0,rgba(16,185,129,0.18)_1px,transparent_1px,transparent_10px),repeating-linear-gradient(-45deg,rgba(16,185,129,0.14)_0,rgba(16,185,129,0.14)_1px,transparent_1px,transparent_10px)] text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
          : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400'
      }`}
    >
      3 Months
    </button>
    <button
      type="button"
      onclick={() => setQuick('this-year')}
      class={`rounded-md border px-3 py-1.5 text-sm transition ${
        isActive('this-year')
          ? 'border-emerald-500 bg-emerald-500/15 bg-[repeating-linear-gradient(45deg,rgba(16,185,129,0.18)_0,rgba(16,185,129,0.18)_1px,transparent_1px,transparent_10px),repeating-linear-gradient(-45deg,rgba(16,185,129,0.14)_0,rgba(16,185,129,0.14)_1px,transparent_1px,transparent_10px)] text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
          : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400'
      }`}
    >
      This Year
    </button>
  </div>
</div>
