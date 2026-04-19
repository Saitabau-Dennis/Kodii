<script lang="ts">
  import { CheckCircleOutline, ChevronLeftOutline } from 'flowbite-svelte-icons'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import VerifyCard from '$lib/components/payments/VerifyCard.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'

  let { data } = $props()

  const pendingPayments = $derived(data.payments)
</script>

<div class="space-y-6">
  <div class="flex flex-col gap-2">
    <a href="/payments" class="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-emerald-500">
      <ChevronLeftOutline class="h-3 w-3" />
      Back to Payments
    </a>
    <PageHeader title="Pending Verification">
      {#snippet left()}
        <p class="text-xs text-zinc-500">{pendingPayments.length} payments waiting for your review</p>
      {/snippet}
    </PageHeader>
  </div>

  {#if pendingPayments.length > 0}
    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {#each pendingPayments as payment (payment.id)}
        <VerifyCard {payment} />
      {/each}
    </div>
  {:else}
    <EmptyState
      title="All caught up!"
      description="No payments waiting for verification."
      icon={CheckCircleOutline}
      iconColor="text-emerald-500"
    >
      <a href="/payments" class="mt-2 text-sm font-medium text-emerald-500 hover:underline">
        View all payments →
      </a>
    </EmptyState>
  {/if}
</div>
