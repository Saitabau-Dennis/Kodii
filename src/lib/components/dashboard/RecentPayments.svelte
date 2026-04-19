<script lang="ts">
  import { goto } from '$app/navigation'
  import { Table } from 'flowbite-svelte'
  import { CashOutline } from 'flowbite-svelte-icons'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import { formatKES } from '$lib/utils/trends'

  export type PaymentRow = {
    id: string
    tenantName: string
    unitNumber: string
    amount: number
    status: 'unpaid' | 'pending_verification' | 'paid' | 'partial' | 'overdue' | 'rejected'
    date: string
  }

  interface Props {
    payments: PaymentRow[]
    title?: string
    viewHref?: string
  }

  let { payments, title = 'Recent Payments', viewHref = '/payments' }: Props = $props()

  function paymentStatusLabel(status: PaymentRow['status']) {
    if (status === 'pending_verification') return 'Pending Verification'
    if (status === 'partial') return 'Partial Payment'
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  function paymentStatusClass(status: PaymentRow['status']) {
    if (status === 'paid') return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
    if (status === 'pending_verification') return 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
    if (status === 'partial') return 'border border-blue-500/30 bg-blue-500/15 text-blue-300'
    if (status === 'rejected') return 'border border-zinc-500/40 bg-zinc-700/40 text-zinc-200'
    if (status === 'overdue') return 'border border-red-500/30 bg-red-500/15 text-red-300'
    return 'border border-zinc-600/40 bg-zinc-800/40 text-zinc-300'
  }

  function formatDate(value: string) {
    return new Date(value).toLocaleDateString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  function openPayment(paymentId: string) {
    goto(`/payments/${paymentId}`)
  }
</script>

<section class="rounded-lg border border-zinc-800">
  <div class="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
    <div>
      <h3 class="text-base font-semibold text-zinc-100">{title}</h3>
    </div>
    <a href={viewHref} class="text-sm text-emerald-400 hover:text-emerald-300">View all →</a>
  </div>

  {#if payments.length === 0}
    <div class="p-4">
      <EmptyState message="No payments yet" icon={CashOutline} />
    </div>
  {:else}
    <div class="overflow-x-auto">
      <Table hoverable={true} class="min-w-[640px]">
        <thead class="text-xs uppercase text-zinc-400">
          <tr>
            <th class="px-4 py-3 text-left">Tenant</th>
            <th class="px-4 py-3 text-left">Unit</th>
            <th class="px-4 py-3 text-left">Amount</th>
            <th class="px-4 py-3 text-left">Status</th>
            <th class="px-4 py-3 text-left">Date</th>
          </tr>
        </thead>
        <tbody>
          {#each payments as payment (payment.id)}
            <tr
              class="cursor-pointer border-b border-zinc-800 text-sm text-zinc-300"
              onclick={() => openPayment(payment.id)}
            >
              <td class="px-4 py-3">{payment.tenantName}</td>
              <td class="px-4 py-3">{payment.unitNumber}</td>
              <td class="px-4 py-3">{formatKES(payment.amount)}</td>
              <td class="px-4 py-3">
                <span
                  class={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${paymentStatusClass(payment.status)}`}
                >
                  {paymentStatusLabel(payment.status)}
                </span>
              </td>
              <td class="px-4 py-3">{formatDate(payment.date)}</td>
            </tr>
          {/each}
        </tbody>
      </Table>
    </div>
  {/if}
</section>
