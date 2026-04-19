<script lang="ts">
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import { Button, PaginationNav, Table } from 'flowbite-svelte'
  import { ToolsOutline } from 'flowbite-svelte-icons'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import TicketFilters from '$lib/components/maintenance/TicketFilters.svelte'
  import TicketRow from '$lib/components/maintenance/TicketRow.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'

  let { data } = $props() as { data: any }

  const startItem = $derived(data.totalCount === 0 ? 0 : (data.currentPage - 1) * 10 + 1)
  const endItem = $derived(Math.min(data.currentPage * 10, data.totalCount))
  const hasFilters = $derived(
    data.selectedStatus !== 'all' ||
      data.selectedCategory !== 'all' ||
      Boolean(data.selectedProperty) ||
      Boolean(data.selectedUnit) ||
      Boolean(data.selectedTenant),
  )

  function buildUrl(next: {
    page?: number
    property?: string
    status?: string
    category?: string
    unit?: string
    tenant?: string
  }) {
    const params = new URLSearchParams(page.url.searchParams)

    if (next.page && next.page > 1) params.set('page', String(next.page))
    else params.delete('page')

    const property = next.property ?? data.selectedProperty
    if (property) params.set('property', property)
    else params.delete('property')

    const status = next.status ?? data.selectedStatus
    if (status && status !== 'all') params.set('status', status)
    else params.delete('status')

    const category = next.category ?? data.selectedCategory
    if (category && category !== 'all') params.set('category', category)
    else params.delete('category')

    const unit = next.unit ?? data.selectedUnit
    if (unit) params.set('unit', unit)
    else params.delete('unit')

    const tenant = next.tenant ?? data.selectedTenant
    if (tenant) params.set('tenant', tenant)
    else params.delete('tenant')

    const query = params.toString()
    return `${resolve('/maintenance')}${query ? `?${query}` : ''}`
  }

  function handlePageChange(nextPage: number) {
    goto(buildUrl({ page: nextPage }))
  }

  function handlePropertyChange(value: string) {
    goto(buildUrl({ property: value, page: 1 }))
  }

  function handleStatusChange(value: string) {
    goto(buildUrl({ status: value, page: 1 }))
  }

  function handleCategoryChange(value: string) {
    goto(buildUrl({ category: value, page: 1 }))
  }
</script>

<section class="space-y-4">
  <PageHeader>
    {#snippet left()}
      <TicketFilters
        properties={data.properties}
        selectedProperty={data.selectedProperty}
        selectedStatus={data.selectedStatus}
        selectedCategory={data.selectedCategory}
        onPropertyChange={handlePropertyChange}
        onStatusChange={handleStatusChange}
        onCategoryChange={handleCategoryChange}
        clearHref={resolve('/maintenance')}
      />
    {/snippet}
    {#snippet right()}
      <div class="flex items-center gap-4">
        <div class="text-xs text-zinc-500">
          Showing <span class="text-zinc-300">{startItem}-{endItem}</span> of <span class="text-zinc-300">{data.totalCount}</span>
        </div>
        <a href={resolve('/maintenance/new')}>
          <Button color="primary" size="sm">New Ticket</Button>
        </a>
      </div>
    {/snippet}
  </PageHeader>

  {#if data.tickets.length === 0}
    {#if hasFilters}
      <EmptyState message="No tickets match your filters" icon={ToolsOutline} />
      <div class="flex justify-center">
        <a href={resolve('/maintenance')} class="text-sm text-emerald-500 hover:text-emerald-400">Clear filters</a>
      </div>
    {:else}
      <EmptyState message="No maintenance tickets yet" icon={ToolsOutline} />
    {/if}
  {:else}
    <div class="rounded-lg border border-zinc-800">
      <div class="overflow-x-auto">
        <Table hoverable={true} class="min-w-[1160px]">
          <thead class="text-xs uppercase text-zinc-400">
            <tr>
              <th class="px-4 py-3 text-left">Ref</th>
              <th class="px-4 py-3 text-left">Unit</th>
              <th class="px-4 py-3 text-left">Property</th>
              <th class="px-4 py-3 text-left">Category</th>
              <th class="px-4 py-3 text-left">Description</th>
              <th class="px-4 py-3 text-left">Status</th>
              <th class="px-4 py-3 text-left">Assigned To</th>
              <th class="px-4 py-3 text-left">Reported</th>
              <th class="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each data.tickets as ticket (ticket.id)}
              <TicketRow {ticket} />
            {/each}
          </tbody>
        </Table>
      </div>
    </div>
  {/if}

  {#if data.totalPages > 1}
    <div class="flex justify-center sm:justify-end">
      <PaginationNav
        currentPage={data.currentPage}
        totalPages={data.totalPages}
        onPageChange={handlePageChange}
      />
    </div>
  {/if}
</section>
