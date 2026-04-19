<script lang="ts">
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import { Button, Modal, PaginationNav, Table } from 'flowbite-svelte'
  import { BuildingOutline } from 'flowbite-svelte-icons'
  import UnitForm from '$lib/components/units/UnitForm.svelte'
  import UnitStatCards from '$lib/components/units/UnitStatCards.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import { formatKES } from '$lib/utils/trends'
  import { toastStore } from '$lib/stores/toast'

  let { data } = $props() as { data: any }

  let editModalOpen = $state(false)
  const isLandlord = $derived(data.user.role === 'landlord')
  const paymentStart = $derived(data.paymentTotalCount === 0 ? 0 : (data.paymentPage - 1) * 10 + 1)
  const paymentEnd = $derived(Math.min(data.paymentPage * 10, data.paymentTotalCount))

  function statusLabel(status: 'vacant' | 'occupied' | 'inactive') {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  function unitStatusClass(status: 'vacant' | 'occupied' | 'inactive') {
    if (status === 'occupied') return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
    if (status === 'inactive') return 'border border-red-500/30 bg-red-500/15 text-red-300'
    return 'border border-zinc-500/30 bg-zinc-500/15 text-zinc-300'
  }

  function paymentStatusClass(
    status: 'unpaid' | 'pending_verification' | 'paid' | 'partial' | 'overdue' | 'rejected',
  ) {
    if (status === 'paid') return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
    if (status === 'pending_verification' || status === 'partial')
      return 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
    if (status === 'rejected' || status === 'overdue')
      return 'border border-red-500/30 bg-red-500/15 text-red-300'
    return 'border border-zinc-500/30 bg-zinc-500/15 text-zinc-300'
  }

  function paymentStatusLabel(
    status: 'unpaid' | 'pending_verification' | 'paid' | 'partial' | 'overdue' | 'rejected',
  ) {
    if (status === 'pending_verification') return 'Pending'
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  function ticketStatusClass(status: 'open' | 'in_progress' | 'resolved' | 'closed') {
    if (status === 'resolved') return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
    if (status === 'closed') return 'border border-zinc-500/30 bg-zinc-500/15 text-zinc-300'
    if (status === 'in_progress') return 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
    return 'border border-red-500/30 bg-red-500/15 text-red-300'
  }

  function formatDate(value: string | null) {
    if (!value) return '—'
    return new Date(value).toLocaleDateString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  function ordinal(day: number | null) {
    if (!day) return '—'
    const mod10 = day % 10
    const mod100 = day % 100
    if (mod10 === 1 && mod100 !== 11) return `${day}st`
    if (mod10 === 2 && mod100 !== 12) return `${day}nd`
    if (mod10 === 3 && mod100 !== 13) return `${day}rd`
    return `${day}th`
  }

  function handlePaymentPageChange(nextPage: number) {
    const params = new URLSearchParams(page.url.searchParams)
    if (nextPage > 1) params.set('payPage', String(nextPage))
    else params.delete('payPage')
    const query = params.toString()
    window.location.href = `${resolve(`/units/${data.unit.id}`)}${query ? `?${query}` : ''}`
  }

  function onUpdated() {
    editModalOpen = false
    toastStore.success('Unit updated')
  }

</script>

<section class="space-y-4">
  <a href={resolve('/units')} class="inline-flex text-sm text-zinc-400 hover:text-zinc-200">← Units</a>

  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 class="text-xl font-semibold text-zinc-100">{data.unit.unitNumber}</h2>
      <a
        href={resolve(`/properties/${data.unit.propertyId}`)}
        class="text-sm text-zinc-400 hover:text-zinc-200"
      >
        {data.unit.propertyName}
      </a>
    </div>
    <div class="flex items-center gap-2">
      <span
        class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${unitStatusClass(data.unit.status)}`}
      >
        {statusLabel(data.unit.status)}
      </span>
      {#if isLandlord}
        <Button color="primary" size="sm" onclick={() => (editModalOpen = true)}>Edit Unit</Button>
      {/if}
    </div>
  </div>

  <UnitStatCards
    monthlyRent={data.unit.monthlyRent}
    totalPaid={data.stats.totalPaid}
    outstanding={data.stats.outstanding}
    openTickets={data.stats.openTickets}
  />

  <section class="rounded-lg border border-zinc-800">
    <div class="border-b border-zinc-800 px-4 py-3">
      <h3 class="text-base font-semibold text-zinc-100">Current Tenant</h3>
    </div>
    <div class="p-4">
      {#if data.unit.status === 'occupied' && data.unit.tenantId}
        <div class="space-y-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
          <p class="text-base font-semibold text-zinc-100">{data.unit.tenantName}</p>
          <p class="text-sm text-zinc-400">{data.unit.tenantPhone}</p>
          <p class="text-sm text-zinc-400">Move in date: {formatDate(data.unit.tenantMoveInDate)}</p>
          <p class="text-sm text-zinc-400">Due on the {ordinal(data.unit.tenantRentDueDay)} of every month</p>
          <a href={resolve(`/tenants/${data.unit.tenantId}`)} class="inline-flex text-sm text-emerald-400 hover:text-emerald-300">
            View Tenant
          </a>
        </div>
      {:else}
        <EmptyState message="No tenant assigned" icon={BuildingOutline} />
        <p class="mt-2 text-center text-sm text-zinc-500">Assign a tenant from the Tenants page</p>
      {/if}
    </div>
  </section>

  <section class="rounded-lg border border-zinc-800">
    <div class="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
      <h3 class="text-base font-semibold text-zinc-100">Payment History</h3>
      <a href={`/payments?unit=${data.unit.id}`} class="text-sm text-emerald-400 hover:text-emerald-300">View all →</a>
    </div>

    {#if data.payments.length === 0}
      <div class="p-4">
        <EmptyState message="No payments recorded for this unit" />
      </div>
    {:else}
      <div class="overflow-x-auto">
        <Table hoverable={true} class="min-w-[760px]">
          <thead class="text-xs uppercase text-zinc-400">
            <tr>
              <th class="px-4 py-3 text-left">Date</th>
              <th class="px-4 py-3 text-left">Amount</th>
              <th class="px-4 py-3 text-left">M-Pesa Code</th>
              <th class="px-4 py-3 text-left">Status</th>
              <th class="px-4 py-3 text-left">Verified by</th>
            </tr>
          </thead>
          <tbody>
            {#each data.payments as payment (payment.id)}
              <tr class="border-b border-zinc-800 text-sm text-zinc-300">
                <td class="px-4 py-3">{formatDate(payment.date)}</td>
                <td class="px-4 py-3">{formatKES(payment.amount)}</td>
                <td class="px-4 py-3">{payment.mpesaCode ?? '—'}</td>
                <td class="px-4 py-3">
                  <span
                    class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${paymentStatusClass(payment.status)}`}
                  >
                    {paymentStatusLabel(payment.status)}
                  </span>
                </td>
                <td class="px-4 py-3">{payment.verifiedBy}</td>
              </tr>
            {/each}
          </tbody>
        </Table>
      </div>

      {#if data.paymentTotalPages > 1}
        <div class="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-800 px-4 py-3">
          <p class="text-sm text-zinc-400">Showing {paymentStart} to {paymentEnd} of {data.paymentTotalCount} payments</p>
          <PaginationNav
            currentPage={data.paymentPage}
            totalPages={data.paymentTotalPages}
            onPageChange={handlePaymentPageChange}
          />
        </div>
      {/if}
    {/if}
  </section>

  <section class="rounded-lg border border-zinc-800">
    <div class="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
      <h3 class="text-base font-semibold text-zinc-100">Maintenance Tickets</h3>
      <a href={`/maintenance?unit=${data.unit.id}`} class="text-sm text-emerald-400 hover:text-emerald-300">View all →</a>
    </div>

    {#if data.tickets.length === 0}
      <div class="p-4">
        <EmptyState message="No maintenance tickets for this unit" />
      </div>
    {:else}
      <div class="overflow-x-auto">
        <Table hoverable={true} class="min-w-[760px]">
          <thead class="text-xs uppercase text-zinc-400">
            <tr>
              <th class="px-4 py-3 text-left">Category</th>
              <th class="px-4 py-3 text-left">Description</th>
              <th class="px-4 py-3 text-left">Status</th>
              <th class="px-4 py-3 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {#each data.tickets as ticket (ticket.id)}
              <tr class="border-b border-zinc-800 text-sm text-zinc-300">
                <td class="px-4 py-3 capitalize">{ticket.category}</td>
                <td class="px-4 py-3">{ticket.description}</td>
                <td class="px-4 py-3">
                  <span
                    class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${ticketStatusClass(ticket.status)}`}
                  >
                    {ticket.status === 'in_progress'
                      ? 'In Progress'
                      : ticket.status.charAt(0).toUpperCase() + ticket.status.slice(1)}
                  </span>
                </td>
                <td class="px-4 py-3">{formatDate(ticket.date)}</td>
              </tr>
            {/each}
          </tbody>
        </Table>
      </div>
    {/if}
  </section>

  {#if isLandlord}
    <Modal
      bind:open={editModalOpen}
      size="md"
      dismissable={false}
      class="rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100"
      classes={{ form: 'overflow-hidden rounded-lg', header: 'hidden', body: 'bg-zinc-950 p-0' }}
    >
      <div class="p-4">
        <UnitForm
          unit={data.unit}
          properties={data.properties}
          onSuccess={onUpdated}
          onCancel={() => (editModalOpen = false)}
        />
      </div>
    </Modal>
  {/if}
</section>
