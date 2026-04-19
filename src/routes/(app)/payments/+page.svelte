<script lang="ts">
  import { page } from '$app/stores'
  import { goto, invalidateAll } from '$app/navigation'
  import { Button, Badge } from 'flowbite-svelte'
  import { CashOutline, CheckCircleOutline, ChevronLeftOutline, ChevronRightOutline } from 'flowbite-svelte-icons'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import PaymentFilters from '$lib/components/payments/PaymentFilters.svelte'
  import PaymentRow from '$lib/components/payments/PaymentRow.svelte'
  import VerifyModal from '$lib/components/payments/VerifyModal.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import { toast } from '$lib/stores/toast'
  import type { PaymentWithDetails } from '$lib/types/payments'

  let { data } = $props()

  let selectedPayment = $state<PaymentWithDetails | null>(null)
  let isVerifyModalOpen = $state(false)
  const selectedStatus = $derived($page.url.searchParams.get('status') || 'all')
  const selectedProperty = $derived($page.url.searchParams.get('property') || '')
  const searchQuery = $derived($page.url.searchParams.get('q') || '')
  const openVerifyFromUrl = $derived($page.url.searchParams.get('verify') === '1')

  function updateFilters(params: Record<string, string>) {
    const newUrl = new URL($page.url)
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        newUrl.searchParams.set(key, value)
      } else {
        newUrl.searchParams.delete(key)
      }
    })
    newUrl.searchParams.set('page', '1')
    goto(newUrl.toString(), { keepFocus: true })
  }

  function handleVerify(payment: PaymentWithDetails) {
    selectedPayment = payment
    isVerifyModalOpen = true
  }

  async function handleVerificationSuccess() {
    isVerifyModalOpen = false
    selectedPayment = null
    await invalidateAll()
  }

  $effect(() => {
    if (!openVerifyFromUrl || data.pendingPayments.length === 0) return
    selectedPayment = data.pendingPayments[0]
    isVerifyModalOpen = true

    const url = new URL($page.url)
    url.searchParams.delete('verify')
    goto(url.toString(), { keepFocus: true, noScroll: true, replaceState: true })
  })
</script>

<div class="space-y-6">
  <div class="flex items-center justify-end">
    <div class="flex items-center gap-2">
      {#if data.pendingCount > 0}
        <Button
          onclick={() => {
            selectedPayment = data.pendingPayments[0] ?? null
            isVerifyModalOpen = selectedPayment !== null
          }}
          class="bg-amber-500 text-amber-950 hover:bg-amber-600"
          size="sm"
        >
          <CheckCircleOutline class="mr-2 h-4 w-4" />
          Verify Payments
          <Badge color="yellow" class="ml-2 bg-amber-950/20 text-amber-950">
            {data.pendingCount}
          </Badge>
        </Button>
      {/if}
    </div>
  </div>

  <PaymentFilters
    properties={data.properties}
    {selectedStatus}
    {selectedProperty}
    {searchQuery}
    onPropertyChange={(value) => updateFilters({ property: value })}
    onStatusChange={(value) => updateFilters({ status: value })}
    onSearchChange={(value) => updateFilters({ q: value })}
  />

  {#if data.payments.length > 0}
    <div class="overflow-hidden rounded-xl border border-zinc-800">
      <div class="overflow-x-auto">
        <table class="w-full text-left">
          <thead class="border-b border-zinc-800">
            <tr>
              <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Tenant</th>
              <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Unit</th>
              <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Expected</th>
              <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Received</th>
              <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">M-Pesa Code</th>
              <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Status</th>
              <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Submitted</th>
              <th class="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each data.payments as payment}
              <PaymentRow {payment} onVerify={handleVerify} />
            {/each}
          </tbody>
        </table>
      </div>

      {#if data.totalPages > 1}
        <div class="flex items-center justify-between border-t border-zinc-800 px-4 py-3">
          <p class="text-xs text-zinc-500">
            Showing <span class="font-medium text-zinc-300">{(data.currentPage - 1) * 10 + 1}</span> to
            <span class="font-medium text-zinc-300">{Math.min(data.currentPage * 10, data.totalCount)}</span> of
            <span class="font-medium text-zinc-300">{data.totalCount}</span> payments
          </p>
          <div class="flex items-center gap-2">
            <Button
              size="xs"
              outline
              color="alternative"
              disabled={data.currentPage === 1}
              href="/payments?page={data.currentPage - 1}&status={selectedStatus}&property={selectedProperty}&q={searchQuery}"
              class="border-zinc-700 text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
            >
              <ChevronLeftOutline class="h-4 w-4" />
            </Button>
            <span class="text-xs text-zinc-400">Page {data.currentPage} of {data.totalPages}</span>
            <Button
              size="xs"
              outline
              color="alternative"
              disabled={data.currentPage === data.totalPages}
              href="/payments?page={data.currentPage + 1}&status={selectedStatus}&property={selectedProperty}&q={searchQuery}"
              class="border-zinc-700 text-zinc-400 hover:bg-zinc-800 disabled:opacity-50"
            >
              <ChevronRightOutline class="h-4 w-4" />
            </Button>
          </div>
        </div>
      {/if}
    </div>
  {:else}
    <EmptyState
      title={searchQuery || selectedStatus !== 'all' || selectedProperty ? "No payments match your search" : "No payments yet"}
      description={searchQuery || selectedStatus !== 'all' || selectedProperty ? "Try adjusting your filters or search term." : "Payments will appear here once submitted by tenants."}
      icon={CashOutline}
    >
      {#if searchQuery || selectedStatus !== 'all' || selectedProperty}
        <Button
          size="sm"
          outline
          color="alternative"
          class="mt-2 border-zinc-700 text-zinc-400 hover:bg-zinc-800"
          onclick={() => updateFilters({ status: 'all', property: '', q: '' })}
        >
          Clear Filters
        </Button>
      {/if}
    </EmptyState>
  {/if}
</div>

{#if selectedPayment}
  <VerifyModal
    payment={selectedPayment}
    open={isVerifyModalOpen}
    onClose={() => {
      isVerifyModalOpen = false
      selectedPayment = null
    }}
    onSuccess={handleVerificationSuccess}
  />
{/if}
