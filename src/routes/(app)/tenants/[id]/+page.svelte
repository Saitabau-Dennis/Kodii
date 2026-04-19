<script lang="ts">
  import { enhance } from '$app/forms'
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import { Button, Modal, PaginationNav, Table } from 'flowbite-svelte'
  import { BellOutline } from 'flowbite-svelte-icons'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import MoveOutForm from '$lib/components/tenants/MoveOutForm.svelte'
  import TenantForm from '$lib/components/tenants/TenantForm.svelte'
  import TenantStatCards from '$lib/components/tenants/TenantStatCards.svelte'
  import { toastStore } from '$lib/stores/toast'
  import { formatKES } from '$lib/utils/trends'
  import type { ActionResult } from '@sveltejs/kit'

  let { data } = $props() as { data: any }

  let editModalOpen = $state(false)
  let moveOutModalOpen = $state(false)
  let applyDepositModalOpen = $state(false)
  let writeOffModalOpen = $state(false)

  let selectedInvoiceId = $state<string | null>(null)
  let isApplyingDeposit = $state(false)
  let isWritingOff = $state(false)

  const isLandlord = $derived(data.user.role === 'landlord')
  const paymentStart = $derived(data.paymentTotalCount === 0 ? 0 : (data.paymentPage - 1) * 10 + 1)
  const paymentEnd = $derived(Math.min(data.paymentPage * 10, data.paymentTotalCount))

  function formatPhoneLocal(phone: string) {
    const digits = phone.replace(/\D/g, '')
    if (digits.length === 12 && digits.startsWith('254')) {
      return `0${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9, 12)}`
    }
    if (digits.length === 10 && digits.startsWith('0')) {
      return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`
    }
    return phone
  }

  function statusLabel(status: 'active' | 'inactive' | 'moved_out') {
    if (status === 'moved_out') return 'Moved Out'
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  function statusClass(status: 'active' | 'inactive' | 'moved_out') {
    if (status === 'active') return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
    if (status === 'moved_out') return 'border border-red-500/30 bg-red-500/15 text-red-300'
    return 'border border-zinc-500/30 bg-zinc-500/15 text-zinc-300'
  }

  function ticketStatusClass(status: 'open' | 'in_progress' | 'resolved' | 'closed') {
    if (status === 'resolved') return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
    if (status === 'closed') return 'border border-zinc-500/30 bg-zinc-500/15 text-zinc-300'
    if (status === 'in_progress') return 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
    return 'border border-red-500/30 bg-red-500/15 text-red-300'
  }

  function paymentStatusClass(
    status: 'unpaid' | 'pending_verification' | 'paid' | 'partial' | 'overdue' | 'rejected',
  ) {
    if (status === 'paid') return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
    if (status === 'pending_verification' || status === 'partial')
      return 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
    if (status === 'overdue' || status === 'rejected')
      return 'border border-red-500/30 bg-red-500/15 text-red-300'
    return 'border border-zinc-500/30 bg-zinc-500/15 text-zinc-300'
  }

  function paymentStatusLabel(
    status: 'unpaid' | 'pending_verification' | 'paid' | 'partial' | 'overdue' | 'rejected',
  ) {
    if (status === 'pending_verification') return 'Pending'
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  function invoiceStatusClass(status: string) {
    if (status === 'paid') return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
    if (status === 'partial') return 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
    if (status === 'overdue') return 'border border-red-500/30 bg-red-500/15 text-red-300'
    return 'border border-zinc-500/30 bg-zinc-500/15 text-zinc-300'
  }

  function invoiceStatusLabel(status: string) {
    if (status === 'written_off') return 'Written Off'
    return status.charAt(0).toUpperCase() + status.slice(1)
  }

  function formatDate(value: string | null) {
    if (!value) return '—'
    return new Date(value).toLocaleDateString('en-KE', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  function handlePaymentPageChange(nextPage: number) {
    const params = new URLSearchParams(page.url.searchParams)
    if (nextPage > 1) params.set('payPage', String(nextPage))
    else params.delete('payPage')
    const query = params.toString()
    window.location.href = `${resolve(`/tenants/${data.tenant.id}`)}${query ? `?${query}` : ''}`
  }

  function onUpdated() {
    editModalOpen = false
    toastStore.success('Tenant updated')
  }

  function onMovedOut() {
    moveOutModalOpen = false
    toastStore.success('Tenant moved out')
  }

  function openWriteOffModal(invoiceId: string) {
    selectedInvoiceId = invoiceId
    writeOffModalOpen = true
  }

  let isResendingSMS = $state(false)
  async function resendSMS() {
    isResendingSMS = true
    const formData = new FormData()
    try {
      const response = await fetch('?/resendInvoiceSMS', {
        method: 'POST',
        body: formData
      })
      const result = await response.json()
      if (result.type === 'success') {
        toastStore.success('Invoice SMS resent successfully')
      } else {
        const data = JSON.parse(result.data)
        toastStore.error(data[1] ?? 'Failed to resend SMS')
      }
    } catch (e) {
      toastStore.error('Failed to resend SMS')
    } finally {
      isResendingSMS = false
    }
  }

  function handleApplyDepositSubmit() {
    isApplyingDeposit = true
    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      isApplyingDeposit = false
      if (result.type === 'success') {
        applyDepositModalOpen = false
        toastStore.success('Deposit applied successfully')
      } else {
        toastStore.error('Failed to apply deposit')
      }
    }
  }

  function handleWriteOffSubmit() {
    isWritingOff = true
    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      isWritingOff = false
      if (result.type === 'success') {
        writeOffModalOpen = false
        toastStore.success('Debt written off')
      } else {
        toastStore.error('Failed to write off debt')
      }
    }
  }
</script>

<section class="space-y-4">
  <a href={resolve('/tenants')} class="inline-flex text-sm text-zinc-400 hover:text-zinc-200">← Tenants</a>

  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 class="text-xl font-semibold text-zinc-100">{data.tenant.fullName}</h2>
      <p class="text-sm text-zinc-400">{formatPhoneLocal(data.tenant.phoneNumber)}</p>
      <p class="text-sm text-zinc-400">
        <a href={resolve(`/properties/${data.tenant.propertyId}`)} class="hover:text-zinc-200">{data.tenant.propertyName}</a>
        {#if data.tenant.unitId}
          <span> → </span>
          <a href={resolve(`/units/${data.tenant.unitId}`)} class="hover:text-zinc-200">{data.tenant.unitNumber}</a>
        {/if}
      </p>
    </div>

    <div class="flex flex-wrap items-center gap-2">
      <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(data.tenant.status)}`}>
        {statusLabel(data.tenant.status)}
      </span>
      {#if data.tenant.status === 'active' && data.invoices.some((i: any) => ['unpaid', 'partial', 'overdue'].includes(i.status))}
        <Button 
          color="alternative" 
          size="sm" 
          onclick={resendSMS} 
          disabled={isResendingSMS}
          class="gap-2"
        >
          <BellOutline class="h-4 w-4" />
          {isResendingSMS ? 'Sending...' : 'Resend SMS Invoice'}
        </Button>
      {/if}
      {#if isLandlord}
        <Button color="primary" size="sm" onclick={() => (editModalOpen = true)}>Edit</Button>
        {#if data.tenant.status === 'active' && data.tenant.unitId}
          <Button color="yellow" size="sm" onclick={() => (moveOutModalOpen = true)}>Move Out</Button>
        {/if}
      {/if}
    </div>
  </div>

  <TenantStatCards
    totalPaid={data.stats.totalPaid}
    outstanding={data.stats.outstanding}
    totalInvoices={data.stats.totalInvoices}
    securityDeposit={data.stats.securityDeposit}
    monthsStayed={data.stats.monthsStayed}
  />

  <section class="rounded-lg border border-zinc-800 bg-zinc-950/70">
    <div class="border-b border-zinc-800 px-4 py-3">
      <h3 class="text-base font-semibold text-zinc-100">Tenant Info</h3>
    </div>
    <div class="grid grid-cols-1 gap-3 p-4 text-sm text-zinc-300 sm:grid-cols-2">
      <p><span class="text-zinc-500">Full name:</span> {data.tenant.fullName}</p>
      <p><span class="text-zinc-500">Phone:</span> {formatPhoneLocal(data.tenant.phoneNumber)}</p>
      <p><span class="text-zinc-500">ID Number:</span> {data.tenant.idNumber ?? '—'}</p>
      <p><span class="text-zinc-500">Move in date:</span> {formatDate(data.tenant.moveInDate)}</p>
      <p><span class="text-zinc-500">Move out date:</span> {formatDate(data.tenant.moveOutDate)}</p>
      <p><span class="text-zinc-500">Rent due day:</span> {data.tenant.rentDueDay}</p>
      <div class="flex items-center gap-3">
        <p><span class="text-zinc-500">Security Deposit:</span> {formatKES(data.tenant.securityDeposit)}</p>
        {#if isLandlord && data.stats.outstanding > 0 && data.tenant.securityDeposit > 0}
          <button
            type="button"
            class="text-xs font-medium text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
            onclick={() => (applyDepositModalOpen = true)}
          >
            Apply to Debt
          </button>
        {/if}
      </div>
      <p><span class="text-zinc-500">Credit Balance:</span> {formatKES(data.stats.creditBalance)}</p>
      <p><span class="text-zinc-500">Months Paid Ahead:</span> {data.stats.monthsPaidAhead}</p>
      <p><span class="text-zinc-500">Remaining Credit:</span> {formatKES(data.stats.remainingCredit)}</p>
      <p>
        <span class="text-zinc-500">Property:</span>
        <a href={resolve(`/properties/${data.tenant.propertyId}`)} class="ml-1 hover:text-emerald-300">{data.tenant.propertyName}</a>
      </p>
      <p>
        <span class="text-zinc-500">Unit:</span>
        {#if data.tenant.unitId}
          <a href={resolve(`/units/${data.tenant.unitId}`)} class="ml-1 hover:text-emerald-300">{data.tenant.unitNumber}</a>
        {:else}
          <span class="ml-1 text-zinc-500">Not assigned</span>
        {/if}
      </p>
      <p>
        <span class="text-zinc-500">Status:</span>
        <span class="ml-1">{statusLabel(data.tenant.status)}</span>
      </p>
    </div>
  </section>

  <section class="rounded-lg border border-zinc-800 bg-zinc-950/70">
    <div class="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
      <h3 class="text-base font-semibold text-zinc-100">Payment History</h3>
      <a href={`/payments?tenant=${data.tenant.id}`} class="text-sm text-emerald-400 hover:text-emerald-300">View all →</a>
    </div>

    {#if data.payments.length === 0}
      <div class="p-4">
        <EmptyState message="No payments recorded" />
      </div>
    {:else}
      <div class="overflow-x-auto">
        <Table hoverable={true} class="min-w-[860px]">
          <thead class="bg-zinc-900 text-xs uppercase text-zinc-400">
            <tr>
              <th class="px-4 py-3 text-left">Date</th>
              <th class="px-4 py-3 text-left">Amount Expected</th>
              <th class="px-4 py-3 text-left">Amount Received</th>
              <th class="px-4 py-3 text-left">M-Pesa Code</th>
              <th class="px-4 py-3 text-left">Status</th>
            </tr>
          </thead>
          <tbody>
            {#each data.payments as payment (payment.id)}
              <tr class="border-b border-zinc-800 text-sm text-zinc-300">
                <td class="px-4 py-3">{formatDate(payment.date)}</td>
                <td class="px-4 py-3">{formatKES(payment.amountExpected)}</td>
                <td class="px-4 py-3">{payment.amountReceived > 0 ? formatKES(payment.amountReceived) : '—'}</td>
                <td class="px-4 py-3">{payment.mpesaCode ?? '—'}</td>
                <td class="px-4 py-3">
                  <span
                    class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${paymentStatusClass(payment.status)}`}
                  >
                    {paymentStatusLabel(payment.status)}
                  </span>
                </td>
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

  {#if isLandlord && data.invoices.some((i: any) => ['unpaid', 'partial', 'overdue'].includes(i.status))}
    <section class="rounded-lg border border-zinc-800 bg-zinc-950/70">
      <div class="border-b border-zinc-800 px-4 py-3">
        <h3 class="text-base font-semibold text-zinc-100">Debt Management</h3>
      </div>
      <div class="overflow-x-auto">
        <Table hoverable={true} class="min-w-[760px]">
          <thead class="bg-zinc-900 text-xs uppercase text-zinc-400">
            <tr>
              <th class="px-4 py-3 text-left">Due Date</th>
              <th class="px-4 py-3 text-left">Amount</th>
              <th class="px-4 py-3 text-left">Status</th>
              <th class="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each data.invoices.filter((i: any) => ['unpaid', 'partial', 'overdue'].includes(i.status)) as invoice (invoice.id)}
              <tr class="border-b border-zinc-800 text-sm text-zinc-300">
                <td class="px-4 py-3">{formatDate(invoice.dueDate)}</td>
                <td class="px-4 py-3">{formatKES(invoice.amount)}</td>
                <td class="px-4 py-3">
                  <span
                    class={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${invoiceStatusClass(invoice.status)}`}
                  >
                    {invoiceStatusLabel(invoice.status)}
                  </span>
                </td>
                <td class="px-4 py-3">
                  <button
                    type="button"
                    class="text-xs font-medium text-red-400 hover:text-red-300 transition-colors"
                    onclick={() => openWriteOffModal(invoice.id)}
                  >
                    Write Off
                  </button>
                </td>
              </tr>
            {/each}
          </tbody>
        </Table>
      </div>
    </section>
  {/if}

  <section class="rounded-lg border border-zinc-800 bg-zinc-950/70">
    <div class="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
      <h3 class="text-base font-semibold text-zinc-100">Maintenance Tickets</h3>
      <a href={`/maintenance?tenant=${data.tenant.id}`} class="text-sm text-emerald-400 hover:text-emerald-300">View all →</a>
    </div>

    {#if data.tickets.length === 0}
      <div class="p-4">
        <EmptyState message="No tickets raised" />
      </div>
    {:else}
      <div class="overflow-x-auto">
        <Table hoverable={true} class="min-w-[760px]">
          <thead class="bg-zinc-900 text-xs uppercase text-zinc-400">
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

  <section class="rounded-lg border border-zinc-800 bg-zinc-950/70">
    <div class="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
      <h3 class="text-base font-semibold text-zinc-100">Notices Sent</h3>
      <a href={`/notices?tenant=${data.tenant.id}`} class="text-sm text-emerald-400 hover:text-emerald-300">View all →</a>
    </div>

    {#if data.notices.length === 0}
      <div class="p-4">
        <EmptyState message="No notices sent to this tenant" />
      </div>
    {:else}
      <div class="overflow-x-auto">
        <Table hoverable={true} class="min-w-[760px]">
          <thead class="bg-zinc-900 text-xs uppercase text-zinc-400">
            <tr>
              <th class="px-4 py-3 text-left">Title</th>
              <th class="px-4 py-3 text-left">Message</th>
              <th class="px-4 py-3 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {#each data.notices as notice (notice.id)}
              <tr class="border-b border-zinc-800 text-sm text-zinc-300">
                <td class="px-4 py-3">{notice.title}</td>
                <td class="px-4 py-3">{notice.message.length > 90 ? `${notice.message.slice(0, 90)}...` : notice.message}</td>
                <td class="px-4 py-3">{formatDate(notice.date)}</td>
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
        <TenantForm
          mode="edit"
          tenant={data.tenant}
          properties={data.properties}
          onSuccess={onUpdated}
          onCancel={() => (editModalOpen = false)}
        />
      </div>
    </Modal>

    <Modal
      bind:open={moveOutModalOpen}
      size="md"
      dismissable={false}
      class="border border-zinc-800 bg-zinc-950 text-zinc-100"
      classes={{ header: 'hidden', body: 'bg-zinc-950 p-0' }}
    >
      <div class="border-b border-zinc-800 px-4 py-3">
        <h3 class="text-base font-semibold text-zinc-100">Move Out Tenant</h3>
      </div>
      <div class="p-4">
        <MoveOutForm
          tenant={data.tenant}
          onSuccess={onMovedOut}
          onCancel={() => (moveOutModalOpen = false)}
        />
      </div>
    </Modal>

    <Modal
      bind:open={applyDepositModalOpen}
      modal={true}
      dismissable={false}
      class="fixed inset-x-0 top-[42%] z-50 mx-auto h-fit w-[min(92vw,32rem)] -translate-y-1/2 rounded-xl border border-zinc-700/80 bg-zinc-950 text-zinc-100 shadow-2xl shadow-black/60"
      classes={{
        form: 'overflow-hidden rounded-xl',
        header: 'hidden',
        body: 'bg-zinc-950 p-0',
      }}
    >
      <div class="space-y-6 px-6 py-6 sm:px-7 sm:py-7">
        <div class="space-y-2">
          <h3 class="text-xl font-semibold leading-tight text-zinc-100">Apply security deposit</h3>
          <p class="max-w-md text-sm leading-relaxed text-zinc-400">
            Are you sure you want to apply the security deposit of
            <span class="font-semibold text-zinc-200">{formatKES(data.tenant.securityDeposit)}</span>
            towards the outstanding debt of
            <span class="font-semibold text-zinc-200">{formatKES(data.stats.outstanding)}</span>?
          </p>
        </div>

        <form
          method="post"
          action="?/applyDeposit"
          class="flex items-center justify-end gap-3 pt-1"
          use:enhance={handleApplyDepositSubmit}
        >
          <button
            type="button"
            class="rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            onclick={() => (applyDepositModalOpen = false)}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isApplyingDeposit}
          >
            {isApplyingDeposit ? 'Applying...' : 'Apply Deposit'}
          </button>
        </form>
      </div>
    </Modal>

    <Modal
      bind:open={writeOffModalOpen}
      modal={true}
      dismissable={false}
      class="fixed inset-x-0 top-[42%] z-50 mx-auto h-fit w-[min(92vw,32rem)] -translate-y-1/2 rounded-xl border border-zinc-700/80 bg-zinc-950 text-zinc-100 shadow-2xl shadow-black/60"
      classes={{
        form: 'overflow-hidden rounded-xl',
        header: 'hidden',
        body: 'bg-zinc-950 p-0',
      }}
    >
      <div class="space-y-6 px-6 py-6 sm:px-7 sm:py-7">
        <div class="space-y-2">
          <h3 class="text-xl font-semibold leading-tight text-zinc-100">Confirm debt write-off</h3>
          <p class="max-w-md text-sm leading-relaxed text-zinc-400">
            You are about to permanently write off this debt. This action cannot be undone and will remove the balance from your active tracking.
          </p>
        </div>

        <form
          method="post"
          action="?/writeOffInvoice"
          class="flex items-center justify-end gap-3 pt-1"
          use:enhance={handleWriteOffSubmit}
        >
          <input type="hidden" name="invoiceId" value={selectedInvoiceId ?? ''} />
          <button
            type="button"
            class="rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
            onclick={() => (writeOffModalOpen = false)}
          >
            Cancel
          </button>
          <button
            type="submit"
            class="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={isWritingOff}
          >
            {isWritingOff ? 'Writing off...' : 'Confirm Write Off'}
          </button>
        </form>
      </div>
    </Modal>
  {/if}
</section>
