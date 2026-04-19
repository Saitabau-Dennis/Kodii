<script lang="ts">
  import { Modal, Label, Input, Textarea, Button } from 'flowbite-svelte'
  import { enhance } from '$app/forms'
  import { formatKES } from '$lib/utils/trends'
  import type { PaymentWithDetails } from '$lib/types/payments'
  import { CheckOutline, CloseOutline, InfoCircleOutline } from 'flowbite-svelte-icons'
  import { toast } from '$lib/stores/toast'

  interface Props {
    payment: PaymentWithDetails
    open: boolean
    onClose: () => void
    onSuccess: () => void
  }

  let { payment, open = $bindable(), onClose, onSuccess }: Props = $props()

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

  function handleConfirm() {
    isSubmitting = true
    return async ({ result }: { result: any }) => {
      isSubmitting = false
      if (result.type === 'success') {
        toast.success(isRejecting ? 'Payment rejected' : 'Payment confirmed')
        onSuccess()
        open = false
      } else if (result.type === 'failure') {
        toast.error(result.data?.message || 'Action failed')
      }
    }
  }

  function handleClose() {
    open = false
    onClose()
  }
</script>

<Modal
  bind:open
  autoclose={false}
  dismissable={false}
  outsideclose
  onclose={onClose}
  class="!bg-black !dark:bg-black !border-zinc-800 !divide-zinc-800 !overflow-hidden"
  classes={{
    header: '!bg-black !text-zinc-100',
    body: '!bg-black !overflow-hidden',
  }}
>
  {#snippet header()}
    <div class="flex w-full items-center justify-between">
      <h3 class="text-xl font-semibold text-zinc-100">Verify Payment</h3>
      <button
        type="button"
        class="rounded-md p-1 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
        aria-label="Close"
        onclick={handleClose}
      >
        <CloseOutline class="h-5 w-5" />
      </button>
    </div>
  {/snippet}

  <div class="space-y-4">
    <div class="grid grid-cols-2 gap-4 rounded-lg bg-black p-3 text-sm">
      <div>
        <p class="text-xs text-zinc-500">Tenant & Unit</p>
        <p class="font-medium text-zinc-100">{payment.tenantName}</p>
        <p class="text-xs text-zinc-400">Unit {payment.unitNumber}</p>
      </div>
      <div>
        <p class="text-xs text-zinc-500">Property</p>
        <p class="font-medium text-zinc-100">{payment.propertyName}</p>
      </div>
      <div>
        <p class="text-xs text-zinc-500">Expected Amount</p>
        <p class="font-medium text-zinc-100">{formatKES(expected)}</p>
      </div>
      <div>
        <p class="text-xs text-zinc-500">M-Pesa Code</p>
        <p class="font-mono font-medium text-emerald-400 uppercase">{payment.mpesaCode}</p>
      </div>
    </div>

    {#if !isRejecting}
      <form method="POST" action="?/confirmPayment" use:enhance={handleConfirm} class="space-y-4">
        <input type="hidden" name="id" value={payment.id} />

        <div class="space-y-2">
          <Label class="text-zinc-300">Amount to confirm</Label>
          <Input
            type="number"
            name="amountReceived"
            bind:value={amountToConfirm}
            placeholder="0.00"
            required
            class="bg-black border-zinc-700 text-zinc-100 focus:ring-emerald-500 focus:border-emerald-500"
          />
          <p class="text-[10px] text-zinc-500">Adjust if different from actual amount received</p>
        </div>

        {#if isPartial && entered > 0}
          <div class="flex items-start gap-2 rounded-lg bg-blue-900/20 p-3 text-blue-300">
            <InfoCircleOutline class="mt-0.5 h-4 w-4 shrink-0" />
            <div class="text-xs">
              <p class="font-medium">Partial Payment Detected</p>
              <p>This will be recorded as a partial payment. Outstanding balance will be <b>{formatKES(outstanding)}</b>.</p>
            </div>
          </div>
        {/if}

        <div class="flex justify-between gap-3 pt-2">
          <Button
            type="button"
            class="bg-red-600 text-white hover:bg-red-700"
            disabled={isSubmitting}
            onclick={() => (isRejecting = true)}
          >
            Reject Payment
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting || entered <= 0}
            class={isPartial ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}
          >
            {#if isSubmitting}
              <span class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
              Processing...
            {:else}
              <CheckOutline class="mr-2 h-4 w-4" />
              {isPartial ? 'Mark Partial' : 'Confirm Full Payment'}
            {/if}
          </Button>
        </div>
      </form>
    {:else}
      <form method="POST" action="?/rejectPayment" use:enhance={handleConfirm} class="space-y-4">
        <input type="hidden" name="id" value={payment.id} />
        
        <div class="space-y-2">
          <Label class="text-zinc-300">Reason for rejection</Label>
          <Textarea
            name="reason"
            bind:value={rejectionReason}
            placeholder="e.g. M-Pesa code not found in records..."
            required
            rows={3}
            class="bg-black border-zinc-700 text-zinc-100 focus:ring-red-500 focus:border-red-500"
          />
        </div>

        <div class="flex justify-between gap-3 pt-2">
          <Button
            type="button"
            color="alternative"
            class="bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border-zinc-700"
            disabled={isSubmitting}
            onclick={() => (isRejecting = false)}
          >
            Go Back
          </Button>
          <Button
            type="submit"
            color="red"
            disabled={isSubmitting || !rejectionReason.trim()}
          >
            {#if isSubmitting}
              <span class="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
              Processing...
            {:else}
              <CloseOutline class="mr-2 h-4 w-4" />
              Confirm Rejection
            {/if}
          </Button>
        </div>
      </form>
    {/if}
  </div>
</Modal>
