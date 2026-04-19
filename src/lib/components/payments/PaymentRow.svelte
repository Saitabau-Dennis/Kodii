<script lang="ts">
  import { Button, Tooltip } from 'flowbite-svelte'
  import { FileLinesOutline, CheckCircleOutline, ClipboardCleanOutline } from 'flowbite-svelte-icons'
  import { formatKES, relativeTime } from '$lib/utils/trends'
  import type { PaymentWithDetails } from '$lib/types/payments'
  import { toast } from '$lib/stores/toast'

  interface Props {
    payment: PaymentWithDetails
    onVerify: (payment: PaymentWithDetails) => void
  }

  let { payment, onVerify }: Props = $props()

  const statusLabels = {
    pending_verification: 'Pending Verification',
    paid: 'Paid',
    partial: 'Partial Payment',
    overdue: 'Overdue',
    rejected: 'Rejected',
    unpaid: 'Unpaid',
  } as const

  const statusClasses = {
    pending_verification: 'border border-amber-500/30 bg-amber-500/15 text-amber-300',
    paid: 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300',
    partial: 'border border-blue-500/30 bg-blue-500/15 text-blue-300',
    overdue: 'border border-red-500/30 bg-red-500/15 text-red-300',
    rejected: 'border border-zinc-500/40 bg-zinc-700/40 text-zinc-200',
    unpaid: 'border border-zinc-600/40 bg-zinc-800/40 text-zinc-300',
  } as const

  const actionTooltipClass =
    'rounded-md border border-zinc-700/80 bg-zinc-900/95 px-2.5 py-1.5 text-[11px] font-medium tracking-wide text-zinc-200 shadow-lg shadow-black/30 backdrop-blur-sm'

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('M-Pesa code copied')
    } catch (err) {
      toast.error('Failed to copy')
    }
  }
</script>

<tr class="border-b border-zinc-800 text-sm text-zinc-300">
  <td class="px-4 py-3">
    <div class="flex flex-col">
      <a href="/tenants/{payment.tenantId}" class="font-medium text-zinc-100 hover:text-emerald-500">
        {payment.tenantName}
      </a>
      <span class="text-[10px] text-zinc-500">{payment.tenantPhone}</span>
    </div>
  </td>
  
  <td class="px-4 py-3">
    <a href="/units/{payment.unitId}" class="font-medium text-zinc-100 hover:text-emerald-500">
      {payment.unitNumber}
    </a>
  </td>

  <td class="px-4 py-3">
    <span class="text-zinc-100">{formatKES(payment.amountExpected)}</span>
  </td>

  <td class="px-4 py-3">
    {#if payment.amountReceived !== null}
      <span class={payment.amountReceived < payment.amountExpected ? 'text-red-400' : 'text-emerald-400'}>
        {formatKES(payment.amountReceived)}
      </span>
    {:else}
      <span class="text-zinc-500">—</span>
    {/if}
  </td>

  <td class="px-4 py-3">
    <div class="flex items-center gap-1.5">
      <span class="font-mono text-xs uppercase text-zinc-300">
        {payment.mpesaCode || '—'}
      </span>
      {#if payment.mpesaCode}
        <button
          type="button"
          class="text-zinc-500 hover:text-zinc-300"
          onclick={() => copyToClipboard(payment.mpesaCode!)}
        >
          <ClipboardCleanOutline class="h-3.5 w-3.5" />
        </button>
      {/if}
    </div>
  </td>

  <td class="px-4 py-3">
    <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusClasses[payment.status]}`}>
      {statusLabels[payment.status]}
    </span>
  </td>

  <td class="px-4 py-3">
    <span class="text-xs text-zinc-400">
      {payment.submittedAt ? relativeTime(new Date(payment.submittedAt)) : '—'}
    </span>
  </td>

  <td class="px-4 py-3">
    <div class="flex items-center gap-1">
      <a
        class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-emerald-500"
        href="/payments/{payment.id}"
      >
        <FileLinesOutline class="h-4 w-4" />
      </a>
      <Tooltip placement="top" type="custom" arrow={false} class={actionTooltipClass}>View Details</Tooltip>

      {#if payment.status === 'pending_verification'}
        <button
          type="button"
          class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-amber-500"
          onclick={() => onVerify(payment)}
        >
          <CheckCircleOutline class="h-4 w-4" />
        </button>
        <Tooltip placement="top" type="custom" arrow={false} class={actionTooltipClass}>Verify Payment</Tooltip>
      {/if}
    </div>
  </td>
</tr>
