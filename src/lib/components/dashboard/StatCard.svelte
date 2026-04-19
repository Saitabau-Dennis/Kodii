<script lang="ts">
  import { browser } from '$app/environment'
  import { onDestroy, onMount } from 'svelte'
  import * as echarts from 'echarts'

  interface Props {
    title: string
    value: string
    icon: any
    sparklineData?: number[]
    sparklineType?: 'line' | 'bar'
    trend?: string
    trendUp?: boolean
    showSparkline?: boolean
    accentBorder?: boolean
    accentColor?: 'danger' | 'warning'
  }

  let {
    title,
    value,
    icon,
    sparklineData = [],
    sparklineType = 'line',
    trend = '',
    trendUp = true,
    showSparkline = true,
    accentBorder = false,
    accentColor = 'danger',
  }: Props = $props()
  const Icon = $derived(icon)

  let chartEl = $state<HTMLDivElement | null>(null)
  let chartInstance = $state<echarts.ECharts | null>(null)
  let resizeObserver = $state<ResizeObserver | null>(null)

  function updateChart() {
    if (!showSparkline) return
    if (!chartInstance) return

    chartInstance.setOption({
      animation: false,
      tooltip: { show: false },
      grid: { top: 4, right: 0, bottom: 4, left: 0 },
      xAxis: { type: 'category', show: false, data: sparklineData.map((_, index) => index) },
      yAxis: { type: 'value', show: false },
      series: [
        {
          type: 'line',
          data: sparklineData,
          smooth: true,
          symbol: 'none',
          lineStyle: { color: 'rgba(156, 163, 175, 0.6)', width: 1.5 },
          areaStyle: { color: 'rgba(156, 163, 175, 0.15)' },
          silent: true,
        },
      ],
    })
  }

  onMount(() => {
    if (!browser || !chartEl || !showSparkline) return

    chartInstance = echarts.init(chartEl, undefined, { renderer: 'svg' })
    updateChart()

    resizeObserver = new ResizeObserver(() => {
      chartInstance?.resize()
    })
    resizeObserver.observe(chartEl)
  })

  $effect(() => {
    sparklineData
    sparklineType
    showSparkline
    updateChart()
  })

  onDestroy(() => {
    resizeObserver?.disconnect()
    chartInstance?.dispose()
  })
</script>

<article
  class={`rounded-lg border bg-zinc-950/70 p-3 transition-colors ${
    accentBorder
      ? accentColor === 'danger'
        ? 'border-red-500/70'
        : 'border-amber-500/70'
      : 'border-zinc-800'
  }`}
>
  <div class="flex items-center justify-between gap-2">
    <p class="text-sm font-medium text-zinc-300">{title}</p>
    <span
      class={`inline-flex h-8 w-8 items-center justify-center rounded-full ${
        accentBorder
          ? accentColor === 'danger'
            ? 'bg-red-100 dark:bg-red-900/30 text-red-500'
            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-500'
          : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'
      }`}
    >
      <Icon class="h-4 w-4" />
    </span>
  </div>

  <p class="mt-3 text-2xl font-bold text-zinc-100">{value}</p>
  {#if showSparkline}
    <div bind:this={chartEl} class="mt-3 h-[60px] w-full"></div>
    <p class={`mt-2 text-xs ${trendUp ? 'text-emerald-400' : 'text-red-400'}`}>{trend}</p>
  {/if}
</article>
