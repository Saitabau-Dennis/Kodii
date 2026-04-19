<script lang="ts">
  import type { ActionResult } from '@sveltejs/kit'
  import { enhance } from '$app/forms'
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import {
    Badge,
    Button,
    Drawer,
    Modal,
    PaginationNav,
    Table,
  } from 'flowbite-svelte'
  import { CloseOutline, TrashBinOutline } from 'flowbite-svelte-icons'
  import { toastStore } from '$lib/stores/toast'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import CaretakerRow from '$lib/components/team/CaretakerRow.svelte'
  import InviteForm from '$lib/components/team/InviteForm.svelte'
  import type { PageData } from './$types'
  import type { CaretakerWithProperties } from '$lib/services/users'

  let { data }: { data: PageData } = $props()

  let inviteModalOpen = $state(false)
  let assignDrawerOpen = $state(false)
  let deactivateModalOpen = $state(false)
  let reactivateModalOpen = $state(false)
  let deleteModalOpen = $state(false)

  let selectedCaretaker = $state<CaretakerWithProperties | null>(null)
  let selectedPropertyIds = $state<string[]>([])

  let assignSaving = $state(false)
  let deactivateSaving = $state(false)
  let reactivateSaving = $state(false)
  let deleteSaving = $state(false)

  const startItem = $derived(data.totalCount === 0 ? 0 : (data.currentPage - 1) * 10 + 1)
  const endItem = $derived(Math.min(data.currentPage * 10, data.totalCount))
  const teamPath = resolve('/team')
  const dateFormatter = new Intl.DateTimeFormat('en-KE', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  })

  function formatAddedDate(value: string | Date) {
    return dateFormatter.format(new Date(value))
  }

  function getStatusLabel(inviteStatus: CaretakerWithProperties['inviteStatus']) {
    return inviteStatus === 'accepted'
      ? 'Accepted'
      : inviteStatus === 'deactivated'
        ? 'Deactivated'
        : 'Invite Pending'
  }

  function getStatusClass(inviteStatus: CaretakerWithProperties['inviteStatus']) {
    if (inviteStatus === 'accepted') return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
    if (inviteStatus === 'deactivated') return 'border border-red-500/30 bg-red-500/15 text-red-300'
    return 'border border-amber-500/30 bg-amber-500/15 text-amber-300'
  }

  function handlePageChange(nextPage: number) {
    goto(`${teamPath}?page=${nextPage}`)
  }

  function openAssignDrawer(caretaker: CaretakerWithProperties) {
    selectedCaretaker = caretaker
    selectedPropertyIds = caretaker.properties.map((property) => property.id)
    assignDrawerOpen = true
  }

  function openDeactivateModal(caretaker: CaretakerWithProperties) {
    selectedCaretaker = caretaker
    deactivateModalOpen = true
  }

  function openReactivateModal(caretaker: CaretakerWithProperties) {
    selectedCaretaker = caretaker
    reactivateModalOpen = true
  }

  function openDeleteModal(caretaker: CaretakerWithProperties) {
    selectedCaretaker = caretaker
    deleteModalOpen = true
  }

  function handleAssignSubmit() {
    assignSaving = true

    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      assignSaving = false

      if (result.type === 'success') {
        assignDrawerOpen = false
        toastStore.success((result.data as { message?: string } | undefined)?.message ?? 'Saved')
      } else if (result.type === 'failure') {
        toastStore.error((result.data as { message?: string } | undefined)?.message ?? 'Unable to save')
      } else if (result.type === 'error') {
        toastStore.error('Unable to save right now')
      }
    }
  }

  function handleDeactivateSubmit() {
    deactivateSaving = true

    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      deactivateSaving = false

      if (result.type === 'success') {
        deactivateModalOpen = false
        toastStore.success((result.data as { message?: string } | undefined)?.message ?? 'Deactivated')
      } else if (result.type === 'failure') {
        toastStore.error((result.data as { message?: string } | undefined)?.message ?? 'Unable to deactivate')
      } else if (result.type === 'error') {
        toastStore.error('Unable to deactivate right now')
      }
    }
  }

  function handleReactivateSubmit() {
    reactivateSaving = true

    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      reactivateSaving = false

      if (result.type === 'success') {
        reactivateModalOpen = false
        toastStore.success((result.data as { message?: string } | undefined)?.message ?? 'Reactivated')
      } else if (result.type === 'failure') {
        toastStore.error((result.data as { message?: string } | undefined)?.message ?? 'Unable to reactivate')
      } else if (result.type === 'error') {
        toastStore.error('Unable to reactivate right now')
      }
    }
  }

  function handleDeleteSubmit() {
    deleteSaving = true

    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      deleteSaving = false

      if (result.type === 'success') {
        deleteModalOpen = false
        toastStore.success((result.data as { message?: string } | undefined)?.message ?? 'Deleted')
      } else if (result.type === 'failure') {
        toastStore.error((result.data as { message?: string } | undefined)?.message ?? 'Unable to delete')
      } else if (result.type === 'error') {
        toastStore.error('Unable to delete right now')
      }
    }
  }
</script>

<PageHeader>
  {#snippet left()}
    <div class="text-xs text-zinc-500">
      Showing {startItem} to {endItem} of {data.totalCount} caretakers
    </div>
  {/snippet}
  {#snippet right()}
    <Button color="primary" size="sm" onclick={() => (inviteModalOpen = true)}>Invite Caretaker</Button>
  {/snippet}
</PageHeader>

<div class="space-y-3 sm:space-y-4">
  <div class="space-y-3 sm:hidden">
    {#if data.caretakers.length === 0}
      <div class="rounded-lg border border-zinc-800 px-4 py-6 text-center text-sm text-zinc-500">
        No caretakers yet.
      </div>
    {:else}
      {#each data.caretakers as caretaker (caretaker.id)}
        <article class="rounded-lg border border-zinc-800 p-4">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h3 class="truncate text-sm font-semibold text-zinc-100">{caretaker.name}</h3>
              <p class="mt-0.5 text-xs text-zinc-400">{caretaker.phone}</p>
            </div>
            <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${getStatusClass(caretaker.inviteStatus)}`}>
              {getStatusLabel(caretaker.inviteStatus)}
            </span>
          </div>

          <div class="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div class="px-1 py-1.5">
              <p class="text-zinc-500">Properties</p>
              <p class="mt-0.5 text-sm font-medium text-zinc-200">{caretaker.properties.length}</p>
            </div>
            <div class="px-1 py-1.5">
              <p class="text-zinc-500">Date added</p>
              <p class="mt-0.5 text-sm font-medium text-zinc-200">{formatAddedDate(caretaker.createdAt)}</p>
            </div>
          </div>

          <div class="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              class="rounded-lg border border-zinc-700 px-2.5 py-1.5 text-xs font-medium text-zinc-200 hover:bg-zinc-900 disabled:cursor-not-allowed disabled:opacity-50"
              onclick={() => openAssignDrawer(caretaker)}
              disabled={caretaker.inviteStatus === 'deactivated'}
            >
              Assign Properties
            </button>

            {#if caretaker.inviteStatus === 'accepted'}
              <button
                type="button"
                class="rounded-lg border border-red-900/60 px-2.5 py-1.5 text-xs font-medium text-red-300 hover:bg-red-950/40"
                onclick={() => openDeactivateModal(caretaker)}
              >
                Deactivate
              </button>
            {:else if caretaker.inviteStatus === 'deactivated'}
              <button
                type="button"
                class="rounded-lg border border-emerald-900/60 px-2.5 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-950/40"
                onclick={() => openReactivateModal(caretaker)}
              >
                Reactivate
              </button>
            {/if}

            <button
              type="button"
              class="inline-flex h-8.5 w-8.5 items-center justify-center rounded-md border border-red-900/60 text-red-300 transition-colors hover:bg-red-950/40"
              onclick={() => openDeleteModal(caretaker)}
              aria-label="Delete caretaker"
            >
              <TrashBinOutline class="h-4 w-4" />
            </button>
          </div>
        </article>
      {/each}
    {/if}
  </div>

  <div class="hidden rounded-lg border border-zinc-800 sm:block">
    <div class="overflow-x-auto">
      <Table hoverable={true} class="min-w-[760px]">
        <thead class="border-b border-zinc-800 text-xs uppercase text-zinc-400">
          <tr>
            <th class="px-4 py-3 text-left">Name</th>
            <th class="px-4 py-3 text-left">Phone</th>
            <th class="px-4 py-3 text-left">Status</th>
            <th class="px-4 py-3 text-left">Properties Assigned</th>
            <th class="px-4 py-3 text-left">Date Added</th>
            <th class="px-4 py-3 text-left">Actions</th>
          </tr>
        </thead>

        <tbody>
          {#if data.caretakers.length === 0}
            <tr>
              <td colspan="6" class="px-4 py-6 text-center text-sm text-zinc-500">No caretakers yet.</td>
            </tr>
          {:else}
            {#each data.caretakers as caretaker (caretaker.id)}
              <CaretakerRow
                {caretaker}
                onAssign={openAssignDrawer}
                onDeactivate={openDeactivateModal}
                onReactivate={openReactivateModal}
                onDelete={openDeleteModal}
              />
            {/each}
          {/if}
        </tbody>
      </Table>
    </div>
  </div>
</div>

{#if data.totalPages > 1}
  <div class="mt-4 flex justify-center sm:justify-end">
    <PaginationNav
      currentPage={data.currentPage}
      totalPages={data.totalPages}
      onPageChange={handlePageChange}
    />
  </div>
{/if}

<Modal
  bind:open={reactivateModalOpen}
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
      <h3 class="text-xl font-semibold leading-tight text-zinc-100">Confirm reactivation</h3>
      <p class="max-w-md text-sm leading-relaxed text-zinc-400">
        You are about to restore account access for
        <span class="font-semibold text-zinc-200">{selectedCaretaker?.name ?? 'this caretaker'}</span>.
      </p>
    </div>

    <form
      method="post"
      action="?/reactivateCaretaker"
      class="flex items-center justify-end gap-3 pt-1"
      use:enhance={handleReactivateSubmit}
    >
      <input type="hidden" name="caretakerId" value={selectedCaretaker?.id ?? ''} />
      <button
        type="button"
        class="rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        onclick={() => (reactivateModalOpen = false)}
      >
        Cancel
      </button>
      <button
        type="submit"
        class="rounded-lg bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={reactivateSaving}
      >
        {reactivateSaving ? 'Reactivating...' : 'Reactivate'}
      </button>
    </form>
  </div>
</Modal>

<Modal
  bind:open={inviteModalOpen}
  size="md"
  dismissable={false}
  class="border border-zinc-800 bg-zinc-950 text-zinc-100"
  classes={{ header: 'hidden', body: 'bg-zinc-950 p-0' }}
>
  <div class="px-4 py-3">
    <div class="flex items-start justify-between gap-3">
      <div>
        <h3 class="text-base font-semibold text-zinc-100">Invite Caretaker</h3>
        <p class="mt-0.5 text-sm text-zinc-400">Add a caretaker and send setup instructions by SMS</p>
      </div>
      <button
        type="button"
        class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-800 hover:text-zinc-100"
        onclick={() => (inviteModalOpen = false)}
        aria-label="Close invite modal"
      >
        <CloseOutline class="h-4 w-4" />
      </button>
    </div>
  </div>

  <div class="p-4">
    <InviteForm
      on:success={(event) => {
        inviteModalOpen = false
        toastStore.success(event.detail.message)
      }}
      on:error={(event) => {
        toastStore.error(event.detail.message)
      }}
    />
  </div>
</Modal>

<Drawer
  bind:open={assignDrawerOpen}
  placement="right"
  dismissable={false}
  modal={true}
  class="!right-0 !left-auto !top-0 !bottom-0 !h-screen w-full sm:w-96 border-l border-zinc-800 bg-zinc-950 text-zinc-100"
>
  <div class="flex h-full flex-col p-4">
    <div class="flex items-start justify-between gap-3 border-b border-zinc-800 pb-3">
      <div>
        <h3 class="text-base font-semibold text-zinc-100">Assign Properties</h3>
        <p class="text-sm text-zinc-400">Select properties this caretaker can manage</p>
        {#if selectedCaretaker}
          <p class="mt-1 text-sm text-zinc-300">{selectedCaretaker.name}</p>
        {/if}
      </div>
      <button
        type="button"
        class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-700 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
        onclick={() => (assignDrawerOpen = false)}
        aria-label="Close assign properties drawer"
      >
        <CloseOutline class="h-4 w-4" />
      </button>
    </div>

    <form
      method="post"
      action="?/assignProperties"
      class="mt-3 flex flex-1 flex-col gap-3"
      use:enhance={handleAssignSubmit}
    >
      <input type="hidden" name="caretakerId" value={selectedCaretaker?.id ?? ''} />

      <div class="flex-1 space-y-2 overflow-y-auto pr-1">
        {#if data.properties.length === 0}
          <p class="text-sm text-zinc-500">No properties found.</p>
        {:else}
          {#each data.properties as property (property.id)}
            <label class="flex items-start gap-2 rounded-lg border border-zinc-800 bg-zinc-900/40 p-2">
              <input
                type="checkbox"
                name="propertyIds"
                value={property.id}
                bind:group={selectedPropertyIds}
                class="mt-1 h-4 w-4"
              />
              <span class="text-sm text-zinc-300">
                <span class="block font-medium">{property.name}</span>
                <span class="text-xs text-zinc-500">{property.location ?? 'No location'}</span>
              </span>
            </label>
          {/each}
        {/if}
      </div>

      <div class="mt-auto flex justify-end gap-2 border-t border-zinc-800 pt-3">
        <Button color="light" size="sm" type="button" onclick={() => (assignDrawerOpen = false)}
          >Cancel</Button
        >
        <Button color="primary" size="sm" type="submit" disabled={assignSaving}
          >{assignSaving ? 'Saving...' : 'Save'}</Button
        >
      </div>
    </form>
  </div>
</Drawer>

<Modal
  bind:open={deactivateModalOpen}
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
      <h3 class="text-xl font-semibold leading-tight text-zinc-100">Confirm deactivation</h3>
      <p class="max-w-md text-sm leading-relaxed text-zinc-400">
        You are about to remove account access for
        <span class="font-semibold text-zinc-200">{selectedCaretaker?.name ?? 'this caretaker'}</span>.
      </p>
    </div>

    <form
      method="post"
      action="?/deactivateCaretaker"
      class="flex items-center justify-end gap-3 pt-1"
      use:enhance={handleDeactivateSubmit}
    >
      <input type="hidden" name="caretakerId" value={selectedCaretaker?.id ?? ''} />
      <button
        type="button"
        class="rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        onclick={() => (deactivateModalOpen = false)}
      >
        Cancel
      </button>
      <button
        type="submit"
        class="rounded-lg bg-rose-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-400 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={deactivateSaving}
      >
        {deactivateSaving ? 'Deactivating...' : 'Deactivate'}
      </button>
    </form>
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
  <div class="space-y-6 px-6 py-6 sm:px-7 sm:py-7">
    <div class="space-y-2">
      <h3 class="text-xl font-semibold leading-tight text-zinc-100">Confirm deletion</h3>
      <p class="max-w-md text-sm leading-relaxed text-zinc-400">
        You are about to permanently delete
        <span class="font-semibold text-zinc-200">{selectedCaretaker?.name ?? 'this caretaker'}</span>. This action cannot be undone.
      </p>
    </div>

    <form
      method="post"
      action="?/deleteCaretaker"
      class="flex items-center justify-end gap-3 pt-1"
      use:enhance={handleDeleteSubmit}
    >
      <input type="hidden" name="caretakerId" value={selectedCaretaker?.id ?? ''} />
      <button
        type="button"
        class="rounded-lg border border-zinc-700 bg-zinc-900 px-5 py-2.5 text-sm font-medium text-zinc-200 transition hover:border-zinc-500 hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60"
        onclick={() => (deleteModalOpen = false)}
      >
        Cancel
      </button>
      <button
        type="submit"
        class="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
        disabled={deleteSaving}
      >
        {deleteSaving ? 'Deleting...' : 'Delete Permanently'}
      </button>
    </form>
  </div>
</Modal>
