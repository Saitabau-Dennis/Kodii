<script lang="ts">
  import type { ActionResult } from '@sveltejs/kit'
  import { enhance } from '$app/forms'
  import { toastStore } from '$lib/stores/toast'

  interface Props {
    settings: {
      collectionType: 'paybill' | 'till' | null
      paybillNumber: string | null
      tillNumber: string | null
      paybillName: string | null
      tillName: string | null
      collectionAccount: string | null
      accountName: string | null
      accountNumber: string | null
      referenceRule?: string | null
    }
    senderId: string
  }

  let { settings, senderId }: Props = $props()

  let collectionType = $state<'paybill' | 'till'>('paybill')
  let paybillNumber = $state('')
  let tillNumber = $state('')
  let paybillName = $state('')
  let tillName = $state('')
  let accountNumber = $state('')
  let isSaving = $state(false)
  let isTesting = $state(false)
  let errorMessage = $state('')
  let fieldErrors = $state<Record<string, string>>({})

  $effect(() => {
    settings
    collectionType = settings.collectionType ?? 'paybill'
    paybillNumber =
      settings.paybillNumber ??
      (settings.collectionType === 'paybill' ? (settings.collectionAccount ?? '') : '')
    tillNumber =
      settings.tillNumber ??
      (settings.collectionType === 'till' ? (settings.collectionAccount ?? '') : '')
    paybillName =
      settings.paybillName ??
      (settings.collectionType === 'paybill' ? (settings.accountName ?? '') : '')
    tillName =
      settings.tillName ??
      (settings.collectionType === 'till' ? (settings.accountName ?? '') : '')
    accountNumber = settings.accountNumber ?? settings.referenceRule ?? ''
  })

  function handleSave() {
    isSaving = true
    errorMessage = ''
    fieldErrors = {}

    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      isSaving = false

      if (result.type === 'success') {
        toastStore.success('Payment settings updated')
        return
      }

      if (result.type === 'failure') {
        const payload = (result.data as { message?: string; errors?: Record<string, string> } | undefined) ?? {}
        errorMessage = payload.message ?? 'Unable to update payment settings'
        fieldErrors = payload.errors ?? {}
        return
      }

      errorMessage = 'Unable to update payment settings'
    }
  }

  function handleTestSMS() {
    isTesting = true
    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      isTesting = false

      if (result.type === 'success') {
        const payload = (result.data as { maskedPhone?: string } | undefined) ?? {}
        toastStore.success(`Test SMS sent to ${payload.maskedPhone ?? 'your phone'}`)
        return
      }

      const payload =
        result.type === 'failure'
          ? ((result.data as { message?: string } | undefined) ?? {})
          : { message: 'Failed to send test SMS' }
      toastStore.error(payload.message ?? 'Failed to send test SMS')
    }
  }
</script>

<div class="space-y-4">
  <form method="post" action="?/updatePayments" class="space-y-4" use:enhance={handleSave}>
    <input type="hidden" name="collectionType" value={collectionType} />
    {#if collectionType !== 'paybill'}
      <input type="hidden" name="paybillNumber" value={paybillNumber} />
      <input type="hidden" name="paybillName" value={paybillName} />
      <input type="hidden" name="accountNumber" value={accountNumber} />
    {/if}
    {#if collectionType !== 'till'}
      <input type="hidden" name="tillNumber" value={tillNumber} />
      <input type="hidden" name="tillName" value={tillName} />
    {/if}

    <div class="space-y-2">
      <p class="text-sm text-zinc-300">Collection type</p>
      <div class="flex flex-wrap justify-start gap-3">
        <button
          type="button"
          onclick={() => (collectionType = 'paybill')}
          class={`w-full max-w-[220px] rounded-md border px-4 py-5 text-center text-base font-medium transition sm:w-[220px] ${
            collectionType === 'paybill'
              ? 'border-emerald-500 bg-emerald-500/15 bg-[repeating-linear-gradient(45deg,rgba(16,185,129,0.18)_0,rgba(16,185,129,0.18)_1px,transparent_1px,transparent_10px),repeating-linear-gradient(-45deg,rgba(16,185,129,0.14)_0,rgba(16,185,129,0.14)_1px,transparent_1px,transparent_10px)] text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
              : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-900'
          }`}
        >
          <span class="block">Paybill</span>
        </button>
        <button
          type="button"
          onclick={() => (collectionType = 'till')}
          class={`w-full max-w-[220px] rounded-md border px-4 py-5 text-center text-base font-medium transition sm:w-[220px] ${
            collectionType === 'till'
              ? 'border-emerald-500 bg-emerald-500/15 bg-[repeating-linear-gradient(45deg,rgba(16,185,129,0.18)_0,rgba(16,185,129,0.18)_1px,transparent_1px,transparent_10px),repeating-linear-gradient(-45deg,rgba(16,185,129,0.14)_0,rgba(16,185,129,0.14)_1px,transparent_1px,transparent_10px)] text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
              : 'border-zinc-700 bg-zinc-950 text-zinc-300 hover:border-zinc-500 hover:bg-zinc-900'
          }`}
        >
          <span class="block">Till</span>
        </button>
      </div>
    </div>

    <label class="grid max-w-xl gap-1.5">
      <span class="text-sm text-zinc-300">{collectionType === 'paybill' ? 'Paybill Number' : 'Till Number'}</span>
      {#if collectionType === 'paybill'}
        <input
          name="paybillNumber"
          bind:value={paybillNumber}
          required
          placeholder="e.g. 400200"
          class="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
        />
      {:else}
        <input
          name="tillNumber"
          bind:value={tillNumber}
          required
          placeholder="e.g. 522522"
          class="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
        />
      {/if}
      <span class="text-xs text-zinc-500">Tenants will send money to this number</span>
      {#if fieldErrors.collectionAccount}
        <span class="text-xs text-red-300">{fieldErrors.collectionAccount}</span>
      {/if}
    </label>

    <label class="grid max-w-xl gap-1.5">
      <span class="text-sm text-zinc-300">{collectionType === 'paybill' ? 'Account name' : 'Till name'}</span>
      {#if collectionType === 'paybill'}
        <input
          name="paybillName"
          bind:value={paybillName}
          required
          placeholder="e.g. SUNSET PROPERTIES LTD"
          class="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
        />
      {:else}
        <input
          name="tillName"
          bind:value={tillName}
          required
          placeholder="e.g. SUNSET RENTALS"
          class="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
        />
      {/if}
      <span class="text-xs text-zinc-500">
        {collectionType === 'paybill' ? 'The registered account name for your Paybill.' : 'The registered account name for your Till.'}
      </span>
      {#if fieldErrors.accountName}
        <span class="text-xs text-red-300">{fieldErrors.accountName}</span>
      {/if}
    </label>

    {#if collectionType === 'paybill'}
      <label class="grid max-w-xl gap-1.5">
        <span class="text-sm text-zinc-300">Account Number</span>
        <input
          name="accountNumber"
          bind:value={accountNumber}
          required
          placeholder="e.g. 1234567890 or 0712345678"
          class="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100"
        />
        <span class="text-xs text-zinc-500">
          This is the account number tenants should enter after the Paybill number.
        </span>
        {#if fieldErrors.accountNumber}
          <span class="text-xs text-red-300">{fieldErrors.accountNumber}</span>
        {/if}
      </label>
    {/if}

    <div class="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-300">
      <p>To confirm payment, tenants should send:</p>
      <p class="mt-1 font-mono text-xs text-zinc-200">PAY [unit_number] [amount] [mpesa_code]</p>
      <p class="mt-1">to {senderId}</p>
      <p class="mt-1 text-xs text-zinc-500">Example: PAY B3 12000 QJD7X8Y2Z</p>
    </div>

    {#if errorMessage}
      <p class="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">{errorMessage}</p>
    {/if}

    <button
      type="submit"
      disabled={isSaving}
      class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
    >
      {isSaving ? 'Saving...' : 'Save Payment Settings'}
    </button>
  </form>

  <form method="post" action="?/sendTestSMS" use:enhance={handleTestSMS}>
    <button
      type="submit"
      disabled={isTesting}
      class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-500"
    >
      {isTesting ? 'Sending...' : 'Send Test SMS to My Phone'}
    </button>
  </form>
</div>
