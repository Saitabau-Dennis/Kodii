<script lang="ts">
  import { Modal } from 'flowbite-svelte'
  import { downloadCSV, toCSV } from '$lib/utils/csv'
  import { toastStore } from '$lib/stores/toast'

  interface Props {
    user: {
      id: string
      role: string
      createdAt: Date
      lastLoginLabel: string
    }
    exportData: {
      properties: Array<{ name: string; location: string | null; totalUnits: number }>
      units: Array<{ unitNumber: string; propertyName: string; status: string; monthlyRent: number }>
      tenants: Array<{ fullName: string; phoneNumber: string; propertyName: string; unitNumber: string | null; status: string }>
      payments: Array<{ tenantName: string; unitNumber: string; amountExpected: number; amountReceived: number | null; status: string; submittedAt: Date | null }>
    }
  }

  let { user, exportData }: Props = $props()

  let deactivateOpen = $state(false)

  const maskedAccountId = $derived(user.id.slice(0, 8))
  const memberSince = $derived(new Date(user.createdAt).toLocaleDateString('en-KE', { dateStyle: 'medium' }))

  function exportMyData() {
    const rows: string[] = []
    rows.push('KODII My Data Export')
    rows.push(`Generated: ${new Date().toISOString()}`)
    rows.push('')

    rows.push('--- PROPERTIES ---')
    rows.push(
      toCSV(
        ['Name', 'Location', 'Total Units'],
        exportData.properties.map((row) => [row.name, row.location ?? '', row.totalUnits]),
      ),
    )
    rows.push('')

    rows.push('--- UNITS ---')
    rows.push(
      toCSV(
        ['Unit', 'Property', 'Status', 'Monthly Rent'],
        exportData.units.map((row) => [row.unitNumber, row.propertyName, row.status, row.monthlyRent]),
      ),
    )
    rows.push('')

    rows.push('--- TENANTS ---')
    rows.push(
      toCSV(
        ['Name', 'Phone', 'Property', 'Unit', 'Status'],
        exportData.tenants.map((row) => [row.fullName, row.phoneNumber, row.propertyName, row.unitNumber ?? '', row.status]),
      ),
    )
    rows.push('')

    rows.push('--- PAYMENTS ---')
    rows.push(
      toCSV(
        ['Tenant', 'Unit', 'Expected', 'Received', 'Status', 'Submitted'],
        exportData.payments.map((row) => [
          row.tenantName,
          row.unitNumber,
          row.amountExpected,
          row.amountReceived ?? '',
          row.status,
          row.submittedAt ? row.submittedAt.toISOString().slice(0, 10) : '',
        ]),
      ),
    )

    const filename = `KODII_MyData_${new Date().toISOString().slice(0, 10)}.csv`
    downloadCSV(filename, rows.join('\n'))
    toastStore.success('Account data export started')
  }
</script>

<div class="space-y-5">
  <section class="rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
    <h4 class="text-base font-semibold text-zinc-100">Account Information</h4>
    <p class="mt-1 text-xs text-zinc-500">Your KODII account details</p>
    <div class="mt-3 grid grid-cols-1 gap-2 text-sm text-zinc-300 sm:grid-cols-2">
      <p><span class="text-zinc-500">Account ID:</span> {maskedAccountId}</p>
      <p>
        <span class="text-zinc-500">Role:</span>
        <span class="ml-1 rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-200">{user.role}</span>
      </p>
      <p><span class="text-zinc-500">Member since:</span> {memberSince}</p>
      <p><span class="text-zinc-500">Last login:</span> {user.lastLoginLabel}</p>
    </div>
  </section>

  <section class="rounded-lg border border-red-900/60 bg-red-950/10 p-4">
    <h4 class="text-base font-semibold text-red-300">Danger Zone</h4>

    <div class="mt-4 space-y-3">
      <div class="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
        <p class="text-sm text-zinc-300">Temporarily disable your account. You can reactivate by contacting support.</p>
        <button
          type="button"
          onclick={() => (deactivateOpen = true)}
          class="mt-2 rounded-lg border border-red-800 px-3 py-1.5 text-sm text-red-300 hover:bg-red-950/50"
        >
          Deactivate Account
        </button>
      </div>

      <div class="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3">
        <p class="text-sm text-zinc-300">Download all your KODII data as a CSV file.</p>
        <button
          type="button"
          onclick={exportMyData}
          class="mt-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-200 hover:bg-zinc-800"
        >
          Export My Data
        </button>
      </div>
    </div>
  </section>

  <Modal bind:open={deactivateOpen} size="md" dismissable={false} class="border border-zinc-800 bg-zinc-950 text-zinc-100" classes={{ header: 'hidden', body: 'bg-zinc-950 p-0' }}>
    <div class="space-y-4 p-5">
      <h4 class="text-base font-semibold text-zinc-100">Confirm account deactivation</h4>
      <p class="text-sm text-zinc-400">
        Are you sure you want to deactivate your account? All your data will be preserved but you will not be able to log in until you contact support.
      </p>
      <form method="post" action="?/deactivateAccount" class="flex justify-end gap-2">
        <button
          type="button"
          onclick={() => (deactivateOpen = false)}
          class="rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-800"
        >
          Cancel
        </button>
        <button
          type="submit"
          class="rounded-lg bg-red-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-400"
        >
          Yes, Deactivate
        </button>
      </form>
    </div>
  </Modal>
</div>
