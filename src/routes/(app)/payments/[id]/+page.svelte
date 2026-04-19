<script lang="ts">
  import { Button } from 'flowbite-svelte'
  import {
    ArrowLeftOutline,
    CheckCircleOutline,
    ClipboardCleanOutline,
    CloseCircleOutline,
    ClockOutline,
  } from 'flowbite-svelte-icons'
  import { formatKES, relativeTime } from '$lib/utils/trends'
  import { toast } from '$lib/stores/toast'

  let { data } = $props()
  const payment = $derived(data.payment)

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

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('M-Pesa code copied')
    } catch {
      toast.error('Failed to copy')
    }
  }

  const outstanding = $derived(Math.max(0, payment.amountExpected - (payment.amountReceived || 0)))
  const tenantCreditBalance = $derived(payment.tenantCreditBalance || 0)
  const monthlyRent = $derived(payment.unitMonthlyRent || 0)
  const monthsPaidAhead = $derived(monthlyRent > 0 ? Math.floor(tenantCreditBalance / monthlyRent) : 0)
  const remainingCredit = $derived(monthlyRent > 0 ? tenantCreditBalance % monthlyRent : tenantCreditBalance)
  const submittedAtLabel = $derived(
    payment.submittedAt
      ? new Date(payment.submittedAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })
      : '—'
  )
  const verifiedAtLabel = $derived(
    payment.verifiedAt
      ? new Date(payment.verifiedAt).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' })
      : '—'
  )
</script>

<div class="space-y-6">
  <div class="space-y-4">
    <a
      href="/payments"
      class="inline-flex w-fit items-center gap-1.5 rounded-md border border-zinc-800 px-2.5 py-1.5 text-xs font-medium text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-200"
    >
      <ArrowLeftOutline class="h-3.5 w-3.5" />
      Back to Payments
    </a>

    <div class="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div class="space-y-1">
        <h1 class="text-xl font-semibold text-zinc-100 sm:text-2xl">Payment Details</h1>
        <p class="text-xs text-zinc-500">Submitted {submittedAtLabel}</p>
      </div>

      <div class="flex items-center gap-3">
        <span class={`inline-flex items-center rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest ${statusClasses[payment.status]}`}>
          {statusLabels[payment.status]}
        </span>
        {#if payment.status === 'pending_verification' && data.user.role === 'landlord'}
          <Button href="/payments?verify=1" size="sm" class="bg-emerald-600 text-xs hover:bg-emerald-700">
            Verify Now
          </Button>
        {/if}
      </div>
    </div>
  </div>

  <div class="grid grid-cols-1 items-start gap-6 xl:grid-cols-12">
    <section class="rounded-xl border border-zinc-800  p-5 xl:col-span-8">
      <div class="grid grid-cols-1 gap-4 border-b border-zinc-800 pb-5 sm:grid-cols-3">
        <div>
          <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Expected</p>
          <p class="mt-2 text-lg font-bold text-zinc-100">{formatKES(payment.amountExpected)}</p>
        </div>
        <div>
          <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Received</p>
          <p
            class={`mt-2 text-lg font-bold ${
              payment.amountReceived && payment.amountReceived < payment.amountExpected
                ? 'text-red-400'
                : 'text-emerald-400'
            }`}
          >
            {payment.amountReceived !== null ? formatKES(payment.amountReceived) : '—'}
          </p>
        </div>
        <div>
          <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Outstanding</p>
          <p class={`mt-2 text-lg font-bold ${outstanding > 0 ? 'text-red-400' : 'text-zinc-300'}`}>
            {formatKES(outstanding)}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 border-b border-zinc-800 py-5 sm:grid-cols-2">
        <div class="space-y-2">
          <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Tenant</p>
          <a href="/tenants/{payment.tenantId}" class="text-sm font-semibold text-zinc-100 hover:text-emerald-400">
            {payment.tenantName}
          </a>
          <p class="text-xs text-zinc-400">{payment.tenantPhone}</p>
        </div>
        <div class="space-y-2">
          <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Unit & Property</p>
          <a href="/units/{payment.unitId}" class="text-sm font-semibold text-zinc-100 hover:text-emerald-400">
            Unit {payment.unitNumber}
          </a>
          <p class="text-xs text-zinc-400">{payment.propertyName}</p>
        </div>
      </div>

      <div class="space-y-5 pt-5">
        <div class="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">M-Pesa Code</p>
            <div class="mt-2 flex items-center gap-2">
              <span class="font-mono text-sm font-semibold uppercase tracking-wider text-emerald-400">
                {payment.mpesaCode || '—'}
              </span>
              {#if payment.mpesaCode}
                <button
                  type="button"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                  onclick={() => copyToClipboard(payment.mpesaCode!)}
                  aria-label="Copy M-Pesa code"
                >
                  <ClipboardCleanOutline class="h-3.5 w-3.5" />
                </button>
              {/if}
            </div>
          </div>
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Payer Phone</p>
            <p class="mt-2 text-sm font-medium text-zinc-200">{payment.payerPhone || '—'}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Submitted At</p>
            <p class="mt-1 text-xs text-zinc-400">{submittedAtLabel}</p>
          </div>
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Verified At</p>
            <p class="mt-1 text-xs text-zinc-400">{verifiedAtLabel}</p>
          </div>
        </div>

        {#if payment.paymentReference}
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Internal Reference</p>
            <p class="mt-2 text-sm text-zinc-300">{payment.paymentReference}</p>
          </div>
        {/if}

        {#if payment.notes}
          <div>
            <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Notes</p>
            <p class="mt-2 rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-300">
              {payment.notes}
            </p>
          </div>
        {/if}
      </div>
    </section>

    <aside class="rounded-xl border border-zinc-800 bg-zinc-950/60 p-5 xl:col-span-4">
      <h2 class="text-sm font-semibold text-zinc-200">Verification & Actions</h2>

      <div class="mt-4 space-y-4">
        {#if payment.status === 'pending_verification'}
          <div class="rounded-lg border border-amber-500/25 bg-amber-500/10 p-4">
            <div class="flex items-start gap-2.5">
              <ClockOutline class="mt-0.5 h-4 w-4 text-amber-400" />
              <div class="space-y-1">
                <p class="text-xs font-semibold uppercase tracking-widest text-amber-300">Pending Action</p>
                <p class="text-sm text-zinc-300">This payment is waiting for manual verification.</p>
              </div>
            </div>
          </div>
        {:else if payment.status === 'rejected'}
          <div class="rounded-lg border border-red-500/25 bg-red-500/10 p-4">
            <div class="flex items-start gap-2.5">
              <CloseCircleOutline class="mt-0.5 h-4 w-4 text-red-400" />
              <div class="space-y-1">
                <p class="text-xs font-semibold uppercase tracking-widest text-red-300">Rejected</p>
                <p class="text-sm text-zinc-300">{payment.notes || 'No reason provided.'}</p>
              </div>
            </div>
          </div>
        {:else}
          <div class="rounded-lg border border-emerald-500/25 bg-emerald-500/10 p-4">
            <div class="flex items-start gap-2.5">
              <CheckCircleOutline class="mt-0.5 h-4 w-4 text-emerald-400" />
              <div class="space-y-1">
                <p class="text-xs font-semibold uppercase tracking-widest text-emerald-300">Verified</p>
                <p class="text-sm text-zinc-300">
                  {payment.verifiedAt ? relativeTime(new Date(payment.verifiedAt)) : 'Verification complete.'}
                </p>
              </div>
            </div>
          </div>
        {/if}

        <div class="space-y-3 border-t border-zinc-800 pt-4">
          <div class="flex items-center justify-between text-xs">
            <span class="text-zinc-500">Verified By</span>
            <span class="font-medium text-zinc-200">{payment.verifiedByName || 'System'}</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-zinc-500">Verification Time</span>
            <span class="text-zinc-300">{verifiedAtLabel}</span>
          </div>
          <div class="flex items-center justify-between text-xs">
            <span class="text-zinc-500">Current Status</span>
            <span class="text-zinc-300">{statusLabels[payment.status]}</span>
          </div>
        </div>

        {#if payment.status === 'partial' || outstanding > 0}
          <div class="space-y-3 border-t border-zinc-800 pt-4">
            <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Balance Summary</p>
            <div class="flex items-center justify-between text-sm">
              <span class="text-zinc-500">Expected</span>
              <span class="font-semibold text-zinc-200">{formatKES(payment.amountExpected)}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-zinc-500">Received</span>
              <span class="font-semibold text-emerald-400">{formatKES(payment.amountReceived || 0)}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="font-semibold uppercase tracking-wider text-zinc-400">Outstanding</span>
              <span class="font-bold text-red-400">{formatKES(outstanding)}</span>
            </div>
          </div>
        {/if}

        {#if tenantCreditBalance > 0}
          <div class="space-y-3 border-t border-zinc-800 pt-4">
            <p class="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">Overpayment Credit</p>
            <div class="flex items-center justify-between text-sm">
              <span class="text-zinc-500">Credit Balance</span>
              <span class="font-semibold text-emerald-300">{formatKES(tenantCreditBalance)}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-zinc-500">Months Paid Ahead</span>
              <span class="font-semibold text-zinc-200">{monthsPaidAhead}</span>
            </div>
            <div class="flex items-center justify-between text-sm">
              <span class="text-zinc-500">Remaining Credit</span>
              <span class="font-semibold text-zinc-300">{formatKES(remainingCredit)}</span>
            </div>
          </div>
        {/if}

        <div class="space-y-2 border-t border-zinc-800 pt-4">
          <a
            href="/payments"
            class="block rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 transition hover:bg-zinc-900 hover:text-zinc-100"
          >
            Back to all payments
          </a>
          {#if payment.status === 'pending_verification' && data.user.role === 'landlord'}
            <a
              href="/payments?verify=1"
              class="block rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200 transition hover:bg-amber-500/15"
            >
              Open verification queue
            </a>
          {/if}
        </div>
      </div>
    </aside>
  </div>
</div>
