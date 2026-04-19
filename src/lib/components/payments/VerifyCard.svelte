<script lang="ts">
  import { enhance } from '$app/forms'
  import { Button, Input, Textarea, Label } from 'flowbite-svelte'
  import { CheckOutline, CloseOutline, ClipboardCleanOutline } from 'flowbite-svelte-icons'
  import { formatKES, relativeTime } from '$lib/utils/trends'
  import type { PaymentWithDetails } from '$lib/types/payments'
  import { toast } from '$lib/stores/toast'

  interface Props {
    payment: PaymentWithDetails
  }

  let { payment }: Props = $props()

  const initialAmountToConfirm = $derived(payment.amountReceived?.toString() || '')
  let amountToConfirm = $state('')
  let rejectionReason = $state('')
  let isRejecting = $state(false)
  let isSubmitting = $state(false)

  const expected = $derived(payment.amountExpected)
  const entered = $derived(parseFloat(amountToConfirm) || 0)
  const outstanding = $derived(Math.max(0, expected - entered))
  const isPartial = $derived(entered < expected)

  $effect(() => {
    amountToConfirm = initialAmountToConfirm
  })

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      toast.success('M-Pesa code copied')
    } catch (err) {
      toast.error('Failed to copy')
    }
  }

  function handleAction() {
    isSubmitting = true
    return async ({ result }: { result: any }) => {
      isSubmitting = false
      if (result.type === 'success') {
        toast.success(isRejecting ? 'Payment rejected' : 'Payment confirmed')
      } else if (result.type === 'failure') {
        toast.error(result.data?.message || 'Action failed')
      }
    }
  }
</script>

<div class="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 shadow-sm transition hover:border-zinc-700">
  <div class="border-b border-zinc-800 p-4">
    <div class="flex items-start justify-between">
      <div>
        <h3 class="font-medium text-zinc-100">{payment.tenantName}</h3>
        <p class="text-xs text-zinc-500">{payment.tenantPhone}</p>
      </div>
      <div class="text-right">
        <p class="text-sm font-semibold text-zinc-100">Unit {payment.unitNumber}</p>
        <p class="text-[10px] text-zinc-500">{payment.propertyName}</p>
      </div>
    </div>
  </div>

  <div class="space-y-3 p-4">
    <div class="grid grid-cols-2 gap-4 text-xs">
      <div>
        <p class="text-zinc-500">Expected</p>
        <p class="font-medium text-zinc-100">{formatKES(expected)}</p>
      </div>
      <div>
        <p class="text-zinc-500">Submitted</p>
        <p class={`font-medium ${isPartial ? 'text-amber-400' : 'text-emerald-400'}`}>
          {formatKES(payment.amountReceived || 0)}
        </p>
      </div>
      <div>
        <p class="text-zinc-500">M-Pesa Code</p>
        <div class="flex items-center gap-1">
          <span class="font-mono font-medium text-zinc-100 uppercase">{payment.mpesaCode}</span>
          <button
            type="button"
            class="text-zinc-500 hover:text-zinc-300"
            onclick={() => copyToClipboard(payment.mpesaCode || '')}
          >
            <ClipboardCleanOutline class="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div>
        <p class="text-zinc-500">Submitted</p>
        <p class="text-zinc-100">{relativeTime(new Date(payment.submittedAt!))}</p>
      </div>
    </div>

    {#if !isRejecting}
      <form method="POST" action="?/confirmPayment" use:enhance={handleAction} class="mt-4 space-y-4">
        <input type="hidden" name="id" value={payment.id} />
        
        <div class="space-y-1.5">
          <Label class="text-[11px] text-zinc-400">Amount to confirm</Label>
          <Input
            type="number"
            name="amountReceived"
            bind:value={amountToConfirm}
            size="sm"
            class="bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-emerald-500 focus:border-emerald-500"
          />
          {#if isPartial && entered > 0}
            <p class="text-[10px] text-blue-400">
              Outstanding: {formatKES(outstanding)}
            </p>
          {/if}
        </div>

        <div class="flex gap-2">
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || entered <= 0}
            class={`flex-1 ${isPartial ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}
          >
            <CheckOutline class="mr-1.5 h-3.5 w-3.5" />
            {isPartial ? `Confirm ${formatKES(entered)}` : 'Confirm Full'}
          </Button>
          <Button
            type="button"
            size="sm"
            outline
            color="red"
            class="px-2"
            onclick={() => (isRejecting = true)}
          >
            <CloseOutline class="h-4 w-4" />
          </Button>
        </div>
      </form>
    {:else}
      <form method="POST" action="?/rejectPayment" use:enhance={handleAction} class="mt-4 space-y-4">
        <input type="hidden" name="id" value={payment.id} />
        
        <div class="space-y-1.5">
          <Label class="text-[11px] text-zinc-400">Rejection reason</Label>
          <Textarea
            name="reason"
            bind:value={rejectionReason}
            rows={2}
            required
            class="bg-zinc-950 border-zinc-800 text-zinc-100 focus:ring-red-500 focus:border-red-500 text-sm"
          />
        </div>

        <div class="flex gap-2">
          <Button
            type="submit"
            size="sm"
            color="red"
            class="flex-1"
            disabled={isSubmitting || !rejectionReason.trim()}
          >
            Confirm Reject
          </Button>
          <Button
            type="button"
            size="sm"
            outline
            class="border-zinc-700 text-zinc-400 hover:bg-zinc-800"
            onclick={() => (isRejecting = false)}
          >
            Cancel
          </Button>
        </div>
      </form>
    {/if}
  </div>
</div>
