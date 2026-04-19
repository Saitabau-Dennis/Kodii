<script lang="ts">
  import { formatKES } from '$lib/utils/trends'

  interface Props {
    monthlyRent: number
    totalPaid: number
    outstanding: number
    openTickets: number
  }

  let { monthlyRent, totalPaid, outstanding, openTickets }: Props = $props()
</script>

<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
  <article class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
    <p class="text-sm text-zinc-400">Monthly Rent</p>
    <p class="mt-1 text-xl font-semibold text-zinc-100">{formatKES(monthlyRent)}</p>
  </article>
  <article class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
    <p class="text-sm text-zinc-400">Total Paid</p>
    <p class="mt-1 text-xl font-semibold text-zinc-100">{formatKES(totalPaid)}</p>
  </article>
  <article class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
    <p class="text-sm text-zinc-400">Outstanding</p>
    <p class="mt-1 text-xl font-semibold text-zinc-100">{formatKES(outstanding)}</p>
  </article>
  <article class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
    <p class="text-sm text-zinc-400">Open Tickets</p>
    <p class="mt-1 text-xl font-semibold text-zinc-100">{openTickets}</p>
  </article>
</div>
