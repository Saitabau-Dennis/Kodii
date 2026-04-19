<script lang="ts">
  interface PropertyItem {
    id: string
    name: string
    tenantCount?: number
  }

  interface UnitItem {
    id: string
    unitNumber: string
    tenantName: string | null
    tenantId: string | null
  }

  interface TenantItem {
    id: string
    fullName: string
    phoneNumber: string
    propertyName: string
    unitNumber: string | null
  }

  interface Props {
    targetType: 'all_tenants' | 'property' | 'unit' | 'tenant'
    properties: PropertyItem[]
    unitsByProperty: Record<string, UnitItem[]>
    tenants: TenantItem[]
    onSelectionChange: (ids: string[]) => void
  }

  let { targetType, properties, unitsByProperty, tenants, onSelectionChange }: Props = $props()

  let selectedIds = $state<string[]>([])
  let search = $state('')
  let expandedPropertyIds = $state<string[]>([])

  const filteredTenants = $derived.by(() => {
    const term = search.trim().toLowerCase()
    if (!term) return tenants
    return tenants.filter((tenant) => {
      return (
        tenant.fullName.toLowerCase().includes(term) ||
        tenant.phoneNumber.toLowerCase().includes(term)
      )
    })
  })

  function toggleSelected(id: string) {
    if (selectedIds.includes(id)) {
      selectedIds = selectedIds.filter((item) => item !== id)
      return
    }
    selectedIds = [...selectedIds, id]
  }

  function setAllSelected(ids: string[], checked: boolean) {
    if (!checked) {
      selectedIds = selectedIds.filter((id) => !ids.includes(id))
      return
    }
    selectedIds = Array.from(new Set([...selectedIds, ...ids]))
  }

  function togglePropertyExpand(propertyId: string) {
    if (expandedPropertyIds.includes(propertyId)) {
      expandedPropertyIds = expandedPropertyIds.filter((id) => id !== propertyId)
      return
    }
    expandedPropertyIds = [...expandedPropertyIds, propertyId]
  }

  $effect(() => {
    targetType
    selectedIds = []
    search = ''
    expandedPropertyIds = []
  })

  $effect(() => {
    onSelectionChange(selectedIds)
  })
</script>

{#if targetType === 'all_tenants'}
  <div class="rounded-lg border border-zinc-800 bg-zinc-900/40 p-3 text-sm text-zinc-300">
    This notice will be sent to all <span class="text-zinc-100">{tenants.length}</span> active tenants.
  </div>
{/if}

{#if targetType === 'property'}
  <div class="space-y-2">
    <label class="flex items-center gap-2 text-sm text-zinc-300">
      <input
        type="checkbox"
        checked={properties.length > 0 && properties.every((property) => selectedIds.includes(property.id))}
        onchange={(event) => setAllSelected(properties.map((property) => property.id), (event.currentTarget as HTMLInputElement).checked)}
      />
      Select all
    </label>
    <div class="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/30 p-2">
      {#each properties as property}
        <label class="flex items-center justify-between gap-2 rounded-md px-2 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
          <span class="inline-flex items-center gap-2">
            <input
              type="checkbox"
              checked={selectedIds.includes(property.id)}
              onchange={() => toggleSelected(property.id)}
            />
            {property.name}
          </span>
          <span class="text-xs text-zinc-500">{property.tenantCount ?? 0} tenants</span>
        </label>
      {/each}
    </div>
  </div>
{/if}

{#if targetType === 'unit'}
  <div class="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/30 p-2">
    {#each properties as property}
      <div class="rounded-md border border-zinc-800">
        <button
          type="button"
          class="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-zinc-200"
          onclick={() => togglePropertyExpand(property.id)}
        >
          <span>{property.name}</span>
          <span class="text-xs text-zinc-500">{unitsByProperty[property.id]?.length ?? 0} units</span>
        </button>
        {#if expandedPropertyIds.includes(property.id)}
          <div class="border-t border-zinc-800 p-2">
            {#if (unitsByProperty[property.id]?.length ?? 0) === 0}
              <p class="text-xs text-zinc-500">No occupied units</p>
            {:else}
              <div class="space-y-1">
                {#each unitsByProperty[property.id] as unit}
                  <label class="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(unit.id)}
                      onchange={() => toggleSelected(unit.id)}
                    />
                    Unit {unit.unitNumber} — {unit.tenantName ?? 'Vacant'}
                  </label>
                {/each}
              </div>
            {/if}
          </div>
        {/if}
      </div>
    {/each}
  </div>
{/if}

{#if targetType === 'tenant'}
  <div class="space-y-2">
    <input
      type="search"
      bind:value={search}
      placeholder="Search tenant by name or phone"
      class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
    />
    <label class="flex items-center gap-2 text-sm text-zinc-300">
      <input
        type="checkbox"
        checked={filteredTenants.length > 0 && filteredTenants.every((tenant) => selectedIds.includes(tenant.id))}
        onchange={(event) => setAllSelected(filteredTenants.map((tenant) => tenant.id), (event.currentTarget as HTMLInputElement).checked)}
      />
      Select all
    </label>
    <div class="max-h-64 space-y-1 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900/30 p-2">
      {#if filteredTenants.length === 0}
        <p class="px-2 py-2 text-sm text-zinc-500">No tenants match search</p>
      {:else}
        {#each filteredTenants as tenant}
          <label class="flex items-start gap-2 rounded-md px-2 py-2 text-sm text-zinc-300 hover:bg-zinc-900">
            <input
              type="checkbox"
              checked={selectedIds.includes(tenant.id)}
              onchange={() => toggleSelected(tenant.id)}
            />
            <span>
              <span class="block text-zinc-200">{tenant.fullName}</span>
              <span class="block text-xs text-zinc-500">
                {tenant.phoneNumber} • {tenant.unitNumber ? `Unit ${tenant.unitNumber}` : 'No unit'} • {tenant.propertyName}
              </span>
            </span>
          </label>
        {/each}
      {/if}
    </div>
  </div>
{/if}
