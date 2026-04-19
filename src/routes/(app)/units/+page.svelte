<script lang="ts">
  import type { ActionResult } from '@sveltejs/kit'
  import { enhance } from '$app/forms'
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { page } from '$app/state'
  import { Button, Modal, PaginationNav, Select, Table } from 'flowbite-svelte'
  import { BuildingOutline } from 'flowbite-svelte-icons'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import UnitForm from '$lib/components/units/UnitForm.svelte'
  import UnitRow from '$lib/components/units/UnitRow.svelte'
  import { toastStore } from '$lib/stores/toast'
  import type { UnitWithDetails } from '$lib/types/units'

  let { data } = $props() as { data: any }

  let addModalOpen = $state(false)
  let editModalOpen = $state(false)
  let deleteModalOpen = $state(false)
  let markVacantModalOpen = $state(false)
  let deleteError = $state('')
  let markVacantError = $state('')
  let deleteSaving = $state(false)
  let markVacantSaving = $state(false)
  let selectedUnit = $state<UnitWithDetails | null>(null)
  let markInactiveForm = $state<HTMLFormElement | null>(null)

  const isLandlord = $derived(data.user.role === 'landlord')
  const startItem = $derived(data.totalCount === 0 ? 0 : (data.currentPage - 1) * 10 + 1)
  const endItem = $derived(Math.min(data.currentPage * 10, data.totalCount))
  const selectedStatus = $derived(data.selectedStatus ?? 'all')
  const selectedProperty = $derived(data.selectedProperty ?? '')
  const hasFilters = $derived(Boolean(selectedProperty) || selectedStatus !== 'all')

  const statusPills: Array<'all' | 'occupied' | 'vacant' | 'inactive'> = [
    'all',
    'occupied',
    'vacant',
    'inactive',
  ]

  const selectClasses = {
    select:
      'w-full rounded-md border border-gray-200 bg-gray-100 px-3 py-1.5 text-sm text-gray-600 [color-scheme:dark] dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 [&>option]:bg-gray-100 [&>option]:text-gray-600 dark:[&>option]:bg-gray-800 dark:[&>option]:text-gray-300 focus:border-primary-600 focus:ring-primary-600',
  }

  function buildUnitsUrl(next: { page?: number; property?: string; status?: string }) {
    const params = new URLSearchParams(page.url.searchParams)

    if (next.page && next.page > 1) params.set('page', String(next.page))
    else params.delete('page')

    const property = next.property ?? selectedProperty
    if (property) params.set('property', property)
    else params.delete('property')

    const status = next.status ?? selectedStatus
    if (status && status !== 'all') params.set('status', status)
    else params.delete('status')

    const query = params.toString()
    return `${resolve('/units')}${query ? `?${query}` : ''}`
  }

  function handlePageChange(nextPage: number) {
    goto(buildUnitsUrl({ page: nextPage }))
  }

  function handlePropertyFilterChange(event: Event) {
    const value = (event.currentTarget as HTMLSelectElement).value
    goto(buildUnitsUrl({ property: value, page: 1 }))
  }

  function handleStatusFilterChange(status: 'all' | 'occupied' | 'vacant' | 'inactive') {
    goto(buildUnitsUrl({ status, page: 1 }))
  }

  function openEdit(unit: UnitWithDetails) {
    selectedUnit = unit
    editModalOpen = true
  }

  function openDelete(unit: UnitWithDetails) {
    selectedUnit = unit
    deleteError = ''
    deleteModalOpen = true
  }

  function openMarkVacant(unit: UnitWithDetails) {
    selectedUnit = unit
    markVacantError = ''
    markVacantModalOpen = true
  }

  function onCreated() {
    addModalOpen = false
    toastStore.success('Unit added')
  }

  function onUpdated() {
    editModalOpen = false
    toastStore.success('Unit updated')
  }

  function handleDeleteSubmit() {
    deleteSaving = true
    deleteError = ''

    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      deleteSaving = false

      if (result.type === 'success') {
        deleteModalOpen = false
        selectedUnit = null
        toastStore.success('Unit deleted')
        return
      }

      if (result.type === 'failure') {
        deleteError = (result.data as { message?: string } | undefined)?.message ?? 'Unable to delete unit'
        return
      }

      if (result.type === 'error') deleteError = 'Unable to delete unit right now'
    }
  }

  function handleMarkVacantSubmit() {
    markVacantSaving = true
    markVacantError = ''

    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      markVacantSaving = false

      if (result.type === 'success') {
        markVacantModalOpen = false
        selectedUnit = null
        toastStore.success('Unit marked vacant')
        return
      }

      if (result.type === 'failure') {
        markVacantError =
          (result.data as { message?: string } | undefined)?.message ?? 'Unable to mark unit vacant'
        return
      }

      if (result.type === 'error') markVacantError = 'Unable to mark unit vacant right now'
    }
  }

  function handleMarkInactiveSubmit() {
    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      if (result.type === 'success') {
        toastStore.success('Unit marked inactive')
      } else if (result.type === 'failure') {
        toastStore.error((result.data as { message?: string } | undefined)?.message ?? 'Unable to mark unit inactive')
      } else if (result.type === 'error') {
        toastStore.error('Unable to mark unit inactive')
      }
    }
  }

  function markInactive(unit: UnitWithDetails) {
    selectedUnit = unit
    markInactiveForm?.requestSubmit()
  }
</script>

<PageHeader>
  {#snippet left()}
    <div class="flex items-center gap-2">
      <Select
        items={[
          { name: 'All Properties', value: '' },
          ...data.properties.map((property: { id: string; name: string }) => ({
            name: property.name,
            value: property.id,
          })),
        ]}
        value={selectedProperty}
        onchange={handlePropertyFilterChange}
        classes={selectClasses}
        class="h-9 min-w-[200px]"
      />

      <div class="flex items-center gap-2 border-l border-zinc-800 pl-2">
        {#each statusPills as status}
          <button
            type="button"
            class={`whitespace-nowrap rounded-md border px-3 py-1.5 text-sm transition ${
              selectedStatus === status
                ? 'border-emerald-500 bg-emerald-500/15 bg-[repeating-linear-gradient(45deg,rgba(16,185,129,0.18)_0,rgba(16,185,129,0.18)_1px,transparent_1px,transparent_10px),repeating-linear-gradient(-45deg,rgba(16,185,129,0.14)_0,rgba(16,185,129,0.14)_1px,transparent_1px,transparent_10px)] text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
                : 'border-gray-200 text-gray-600 dark:border-gray-700 dark:text-gray-400'
            }`}
            onclick={() => handleStatusFilterChange(status)}
          >
            {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        {/each}
      </div>
    </div>
  {/snippet}

  {#snippet right()}
    <div class="flex items-center gap-4">
      <div class="text-xs text-zinc-500">
        Showing <span class="text-zinc-300">{startItem}-{endItem}</span> of <span class="text-zinc-300">{data.totalCount}</span>
      </div>
      {#if isLandlord}
        <Button color="primary" size="sm" onclick={() => (addModalOpen = true)}>Add Unit</Button>
      {/if}
    </div>
  {/snippet}
</PageHeader>

{#if data.units.length === 0}
  <EmptyState
    message={hasFilters ? 'No units match your filters' : 'No units yet'}
    icon={BuildingOutline}
  />
  <div class="mt-3 flex justify-center gap-3">
    {#if hasFilters}
      <a href={resolve('/units')} class="text-sm text-emerald-400 hover:text-emerald-300">Clear filters</a>
    {/if}
    {#if isLandlord && !hasFilters}
      <Button color="primary" size="sm" onclick={() => (addModalOpen = true)}>Add your first unit</Button>
    {/if}
  </div>
{:else}
  <div class="rounded-lg border border-zinc-800">
    <div class="overflow-x-auto">
      <Table hoverable={true} class="min-w-[900px]">
        <thead class="border-b border-zinc-800 text-xs uppercase text-zinc-400">
          <tr>
            <th class="px-4 py-3 text-left">Unit No.</th>
            <th class="px-4 py-3 text-left">Property</th>
            <th class="px-4 py-3 text-left">Monthly Rent</th>
            <th class="px-4 py-3 text-left">Status</th>
            <th class="px-4 py-3 text-left">Tenant</th>
            <th class="px-4 py-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each data.units as unit (unit.id)}
            <UnitRow
              unit={unit}
              onEdit={openEdit}
              onDelete={openDelete}
              onMarkVacant={openMarkVacant}
              onMarkInactive={markInactive}
              canManage={isLandlord}
            />
          {/each}
        </tbody>
      </Table>
    </div>
  </div>
{/if}

{#if data.totalPages > 1}
  <div class="mt-4 flex justify-center sm:justify-end">
    <PaginationNav
      currentPage={data.currentPage}
      totalPages={data.totalPages}
      onPageChange={handlePageChange}
    />
  </div>
{/if}

{#if isLandlord}
  <form method="post" action="?/markInactive" use:enhance={handleMarkInactiveSubmit} bind:this={markInactiveForm}>
    <input type="hidden" name="id" value={selectedUnit?.id ?? ''} />
  </form>

  <Modal
    bind:open={addModalOpen}
    size="md"
    dismissable={false}
    class="rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100"
    classes={{ form: 'overflow-hidden rounded-lg', header: 'hidden', body: 'bg-zinc-950 p-0' }}
  >
    <div class="p-4">
      <UnitForm
        properties={data.properties}
        selectedPropertyId={selectedProperty}
        onSuccess={onCreated}
        onCancel={() => (addModalOpen = false)}
      />
    </div>
  </Modal>

  <Modal
    bind:open={editModalOpen}
    size="md"
    dismissable={false}
    class="rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100"
    classes={{ form: 'overflow-hidden rounded-lg', header: 'hidden', body: 'bg-zinc-950 p-0' }}
  >
    <div class="p-4">
      {#if selectedUnit}
        <UnitForm
          unit={selectedUnit}
          properties={data.properties}
          onSuccess={onUpdated}
          onCancel={() => (editModalOpen = false)}
        />
      {/if}
    </div>
  </Modal>

  <Modal
    bind:open={deleteModalOpen}
    modal={true}
    dismissable={false}
    class="fixed inset-x-0 top-[42%] z-50 mx-auto h-fit w-[min(92vw,32rem)] -translate-y-1/2 rounded-xl border border-zinc-700/80 bg-zinc-950 text-zinc-100 shadow-2xl shadow-black/60"
    classes={{ form: 'overflow-hidden rounded-xl', header: 'hidden', body: 'bg-zinc-950 p-0' }}
  >
    <div class="space-y-4 px-6 py-6">
      <h3 class="text-base font-semibold text-zinc-100">Delete Unit</h3>
      <p class="text-sm text-zinc-400">
        Are you sure you want to delete Unit {selectedUnit?.unitNumber}? This action cannot be undone.
      </p>

      {#if deleteError}
        <p class="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300 whitespace-pre-line">
          {deleteError}
        </p>
      {/if}

      <form method="post" action="?/deleteUnit" use:enhance={handleDeleteSubmit}>
        <input type="hidden" name="id" value={selectedUnit?.id ?? ''} />
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            onclick={() => (deleteModalOpen = false)}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={deleteSaving}
            class="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
          >
            {deleteSaving ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </form>
    </div>
  </Modal>

  <Modal
    bind:open={markVacantModalOpen}
    modal={true}
    dismissable={false}
    class="fixed inset-x-0 top-[42%] z-50 mx-auto h-fit w-[min(92vw,32rem)] -translate-y-1/2 rounded-xl border border-zinc-700/80 bg-zinc-950 text-zinc-100 shadow-2xl shadow-black/60"
    classes={{ form: 'overflow-hidden rounded-xl', header: 'hidden', body: 'bg-zinc-950 p-0' }}
  >
    <div class="space-y-4 px-6 py-6">
      <h3 class="text-base font-semibold text-zinc-100">Mark as Vacant</h3>
      <p class="text-sm text-zinc-400">
        Are you sure you want to mark Unit {selectedUnit?.unitNumber} as vacant? This will remove the current tenant assignment.
      </p>

      {#if markVacantError}
        <p class="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300 whitespace-pre-line">
          {markVacantError}
        </p>
      {/if}

      <form method="post" action="?/markVacant" use:enhance={handleMarkVacantSubmit}>
        <input type="hidden" name="id" value={selectedUnit?.id ?? ''} />
        <div class="flex justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
            onclick={() => (markVacantModalOpen = false)}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={markVacantSaving}
            class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
          >
            {markVacantSaving ? 'Saving...' : 'Mark Vacant'}
          </button>
        </div>
      </form>
    </div>
  </Modal>
{/if}
