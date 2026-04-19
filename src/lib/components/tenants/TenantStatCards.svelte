<script lang="ts">
  import { formatKES } from '$lib/utils/trends'

  interface Props {
    totalPaid: number
    outstanding: number
    totalInvoices: number
    monthsStayed: number
    securityDeposit: number
  }

  let { totalPaid, outstanding, totalInvoices, monthsStayed, securityDeposit }: Props = $props()
</script>

<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
  <div class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
    <p class="text-sm font-medium text-zinc-400">Total Paid</p>
    <p class="text-2xl font-bold text-zinc-100">{formatKES(totalPaid)}</p>
  </div>
  <div class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
    <p class="text-sm font-medium text-zinc-400">Outstanding</p>
    <p class="text-2xl font-bold text-zinc-100 {outstanding > 0 ? 'text-red-400' : 'text-zinc-100'}">{formatKES(outstanding)}</p>
  </div>
  <div class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
    <p class="text-sm font-medium text-zinc-400">Security Deposit</p>
    <p class="text-2xl font-bold text-zinc-100">{formatKES(securityDeposit)}</p>
  </div>
  <div class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-3">
    <p class="text-sm font-medium text-zinc-400">Months Stayed</p>
    <p class="text-2xl font-bold text-zinc-100">{monthsStayed}</p>
  </div>
</div>
