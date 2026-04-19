<script lang="ts">
  import type { ActionResult } from '@sveltejs/kit'
  import { enhance } from '$app/forms'
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { Modal, PaginationNav, Table, Button } from 'flowbite-svelte'
  import { HomeOutline } from 'flowbite-svelte-icons'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import PropertyForm from '$lib/components/properties/PropertyForm.svelte'
  import PropertyRow from '$lib/components/properties/PropertyRow.svelte'
  import { toastStore } from '$lib/stores/toast'
  import type { PropertyWithStats } from '$lib/types/properties'

  let { data } = $props() as { data: any }

  let addModalOpen = $state(false)
  let editModalOpen = $state(false)
  let deleteModalOpen = $state(false)
  let deleteError = $state('')
  let deleteSaving = $state(false)
  let selectedProperty = $state<PropertyWithStats | null>(null)

  const isLandlord = $derived(data.user.role === 'landlord')
  const startItem = $derived(data.totalCount === 0 ? 0 : (data.currentPage - 1) * 10 + 1)
  const endItem = $derived(Math.min(data.currentPage * 10, data.totalCount))
  const propertiesPath = resolve('/properties')

  function handlePageChange(nextPage: number) {
    goto(`${propertiesPath}?page=${nextPage}`)
  }

  function openEdit(property: PropertyWithStats) {
    selectedProperty = property
    editModalOpen = true
  }

  function openDelete(property: PropertyWithStats) {
    selectedProperty = property
    deleteError = ''
    deleteModalOpen = true
  }

  function onCreated() {
    addModalOpen = false
    toastStore.success('Property added')
  }

  function onUpdated() {
    editModalOpen = false
    toastStore.success('Property updated')
  }

  function handleDeleteSubmit() {
    deleteSaving = true
    deleteError = ''

    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      deleteSaving = false

      if (result.type === 'success') {
        deleteModalOpen = false
        selectedProperty = null
        toastStore.success('Property deleted')
        return
      }

      if (result.type === 'failure') {
        deleteError =
          (result.data as { message?: string } | undefined)?.message ?? 'Unable to delete property'
        return
      }

      if (result.type === 'error') {
        deleteError = 'Unable to delete property right now'
      }
    }
  }
</script>

<PageHeader>
  {#snippet left()}
    <div class="text-xs text-zinc-500">
        Showing <span class="text-zinc-300">{startItem}-{endItem}</span> of <span class="text-zinc-300">{data.totalCount}</span>
      </div>
  {/snippet}
  {#snippet right()}
    <div class="flex items-center gap-4">
      <!-- <div class="text-xs text-zinc-500">
        Showing <span class="text-zinc-300">{startItem}-{endItem}</span> of <span class="text-zinc-300">{data.totalCount}</span>
      </div> -->
      {#if isLandlord}
        <Button color="primary" size="sm" onclick={() => (addModalOpen = true)}>Add Property</Button>
      {/if}
    </div>
  {/snippet}
</PageHeader>

{#if data.properties.length === 0}
  <EmptyState message="No properties yet" icon={HomeOutline} />
  {#if isLandlord}
    <div class="mt-3 flex justify-center">
      <Button color="primary" size="sm" onclick={() => (addModalOpen = true)}
        >Add your first property</Button
      >
    </div>
  {/if}
{:else}
  <div class="rounded-lg border border-zinc-800">
    <div class="overflow-x-auto">
      <Table hoverable={true} class="min-w-[980px]">
        <thead class="border-b border-zinc-800 text-xs uppercase text-zinc-400">
          <tr>
            <th class="px-4 py-3 text-left">Name</th>
            <th class="px-4 py-3 text-left">Location</th>
            <th class="px-4 py-3 text-left">Units</th>
            <th class="px-4 py-3 text-left">Occupied</th>
            <th class="px-4 py-3 text-left">Vacant</th>
            <th class="px-4 py-3 text-left">Expected Rent</th>
            <th class="px-4 py-3 text-left">Caretaker</th>
            <th class="px-4 py-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {#each data.properties as property (property.id)}
            <PropertyRow
              {property}
              onEdit={openEdit}
              onDelete={openDelete}
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
  <Modal
    bind:open={addModalOpen}
    size="md"
    dismissable={false}
    class="rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100"
    classes={{ form: 'overflow-hidden rounded-lg', header: 'hidden', body: 'bg-zinc-950 p-0' }}
  >
    <div class="p-4">
      <PropertyForm
        onSuccess={onCreated}
        onCancel={() => {
          addModalOpen = false
        }}
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
      {#if selectedProperty}
        <PropertyForm
          property={selectedProperty}
          onSuccess={onUpdated}
          onCancel={() => {
            editModalOpen = false
          }}
        />
      {/if}
    </div>
  </Modal>

  <Modal
    bind:open={deleteModalOpen}
    modal={true}
    dismissable={false}
    class="fixed inset-x-0 top-[42%] z-50 mx-auto h-fit w-[min(92vw,32rem)] -translate-y-1/2 rounded-xl border border-zinc-700/80 bg-zinc-950 text-zinc-100 shadow-2xl shadow-black/60"
    classes={{
      form: 'overflow-hidden rounded-xl',
      header: 'hidden',
      body: 'bg-zinc-950 p-0',
    }}
  >
    <div class="space-y-4 px-6 py-6">
      <div class="space-y-2">
        <h3 class="text-base font-semibold text-zinc-100">Delete Property</h3>
        <p class="text-sm text-zinc-400">
          Are you sure you want to delete <span class="text-zinc-200">{selectedProperty?.name}</span>?
          This action cannot be undone.
        </p>
      </div>

      {#if deleteError}
        <p class="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300 whitespace-pre-line">
          {deleteError}
        </p>
      {/if}

      <form method="post" action="?/deleteProperty" use:enhance={handleDeleteSubmit}>
        <input type="hidden" name="id" value={selectedProperty?.id ?? ''} />
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
{/if}
