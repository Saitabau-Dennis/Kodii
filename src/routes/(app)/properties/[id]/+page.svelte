<script lang="ts">
  import { resolve } from '$app/paths'
  import { Button, Modal, Table } from 'flowbite-svelte'
  import {
    BuildingOutline,
    CheckCircleOutline,
    HomeOutline,
    ExclamationCircleOutline,
  } from 'flowbite-svelte-icons'
  import StatCard from '$lib/components/dashboard/StatCard.svelte'
  import RecentPayments from '$lib/components/dashboard/RecentPayments.svelte'
  import RecentTickets from '$lib/components/dashboard/RecentTickets.svelte'
  import EmptyState from '$lib/components/ui/EmptyState.svelte'
  import PropertyForm from '$lib/components/properties/PropertyForm.svelte'
  import { formatKES } from '$lib/utils/trends'
  import { toastStore } from '$lib/stores/toast'

  let { data } = $props() as { data: any }
  let editModalOpen = $state(false)
  const isLandlord = $derived(data.user.role === 'landlord')

  function unitBadgeClass(status: 'vacant' | 'occupied' | 'inactive') {
    if (status === 'occupied') return 'border border-emerald-500/30 bg-emerald-500/15 text-emerald-300'
    if (status === 'inactive') return 'border border-red-500/30 bg-red-500/15 text-red-300'
    return 'border border-zinc-500/40 bg-zinc-700/40 text-zinc-200'
  }

  function onUpdated() {
    editModalOpen = false
    toastStore.success('Property updated')
  }
</script>

<section class="space-y-4">
  <a href={resolve('/properties')} class="inline-flex text-sm text-zinc-400 hover:text-zinc-200">← Properties</a>

  <div class="flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 class="text-xl font-semibold text-zinc-100">{data.property.name}</h2>
      <p class="text-sm text-zinc-400">{data.property.location ?? 'No location'}</p>
      <p class="text-sm text-zinc-500">
        Caretaker:
        {#if data.property.caretakerName}
          <span class="text-zinc-300">{data.property.caretakerName}</span>
        {:else}
          <span>Not assigned</span>
        {/if}
      </p>
    </div>
    {#if isLandlord}
      <Button color="primary" size="sm" onclick={() => (editModalOpen = true)}>Edit Property</Button>
    {/if}
  </div>

  <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
    <StatCard
      title="Total Units"
      value={data.stats.totalUnits.toString()}
      icon={BuildingOutline}
      showSparkline={false}
    />
    <StatCard
      title="Occupied"
      value={data.stats.occupiedUnits.toString()}
      icon={CheckCircleOutline}
      showSparkline={false}
    />
    <StatCard
      title="Vacant"
      value={data.stats.vacantUnits.toString()}
      icon={HomeOutline}
      showSparkline={false}
    />
    <StatCard
      title="Outstanding Balance"
      value={formatKES(data.stats.outstanding)}
      icon={ExclamationCircleOutline}
      showSparkline={false}
    />
  </div>

  <section class="rounded-lg border border-zinc-800 bg-zinc-950/70">
    <div class="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
      <h3 class="text-base font-semibold text-zinc-100">Units</h3>
      {#if isLandlord}
        <a
          href={resolve(`/units?property=${data.property.id}`)}
          class="text-sm text-emerald-400 hover:text-emerald-300"
        >
          Add Unit
        </a>
      {/if}
    </div>

    {#if data.units.length === 0}
      <div class="p-4">
        <EmptyState message="No units in this property" icon={BuildingOutline} />
        {#if isLandlord}
          <div class="mt-3 flex justify-center">
            <a
              href={resolve(`/units?property=${data.property.id}`)}
              class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:brightness-105"
            >
              Add Unit
            </a>
          </div>
        {/if}
      </div>
    {:else}
      <div class="overflow-x-auto">
        <Table hoverable={true} class="min-w-[760px]">
          <thead class="bg-zinc-900 text-xs uppercase text-zinc-400">
            <tr>
              <th class="px-4 py-3 text-left">Unit Number</th>
              <th class="px-4 py-3 text-left">Rent (KES)</th>
              <th class="px-4 py-3 text-left">Status</th>
              <th class="px-4 py-3 text-left">Tenant</th>
              <th class="px-4 py-3 text-left">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each data.units as unit (unit.id)}
              <tr class="border-b border-zinc-800 text-sm text-zinc-300">
                <td class="px-4 py-3">{unit.unitNumber}</td>
                <td class="px-4 py-3">{formatKES(unit.monthlyRent)}</td>
                <td class="px-4 py-3">
                  <span class={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${unitBadgeClass(unit.status)}`}>
                    {unit.status}
                  </span>
                </td>
                <td class="px-4 py-3">
                  {#if unit.tenantName}
                    {unit.tenantName}
                  {:else}
                    <span class="text-zinc-500">Vacant</span>
                  {/if}
                </td>
                <td class="px-4 py-3">
                  <a href={resolve(`/units/${unit.id}`)} class="text-zinc-200 hover:text-emerald-300">View unit</a>
                </td>
              </tr>
            {/each}
          </tbody>
        </Table>
      </div>
    {/if}
  </section>

  <div class="grid grid-cols-1 gap-4 lg:grid-cols-5">
    <div class="lg:col-span-3">
      <RecentPayments
        payments={data.recentPayments}
        viewHref={`/payments?property=${data.property.id}`}
      />
    </div>
    <div class="lg:col-span-2">
      <RecentTickets
        tickets={data.recentTickets}
        title="Open Tickets"
        viewHref={`/maintenance?property=${data.property.id}`}
      />
    </div>
  </div>

  {#if isLandlord}
    <Modal
      bind:open={editModalOpen}
      size="md"
      dismissable={false}
      class="rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100"
      classes={{ form: 'overflow-hidden rounded-lg', header: 'hidden', body: 'bg-zinc-950 p-0' }}
    >
      <div class="p-4">
        <PropertyForm
          property={data.property}
          onSuccess={onUpdated}
          onCancel={() => {
            editModalOpen = false
          }}
        />
      </div>
    </Modal>
  {/if}
</section>
