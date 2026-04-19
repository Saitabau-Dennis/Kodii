<script lang="ts">
  import { Badge } from 'flowbite-svelte'
  import type { OverdueTenant } from '$lib/types/reports'
  import { formatKES } from '$lib/utils/trends'

  interface Props {
    tenant: OverdueTenant
  }

  let { tenant }: Props = $props()

  const daysToneClass = $derived.by(() => {
    if (tenant.daysOverdue > 30) return 'border-red-900/70 bg-red-950/40 text-red-300'
    if (tenant.daysOverdue >= 15) return 'border-amber-900/70 bg-amber-950/30 text-amber-300'
    return 'border-yellow-900/70 bg-yellow-950/30 text-yellow-300'
  })
</script>

<tr class="border-t border-gray-100 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300">
  <td class="px-4 py-3 font-medium text-gray-900 dark:text-white">{tenant.tenantName}</td>
  <td class="px-4 py-3">{tenant.tenantPhone}</td>
  <td class="px-4 py-3">{tenant.unitNumber}</td>
  <td class="px-4 py-3">{tenant.propertyName}</td>
  <td class="px-4 py-3 font-medium text-red-600 dark:text-red-400">{formatKES(tenant.amountOverdue)}</td>
  <td class="px-4 py-3">
    <Badge class={`w-fit border px-2 py-0.5 text-[10px] ${daysToneClass}`}>
      {tenant.daysOverdue} days
    </Badge>
  </td>
  <td class="px-4 py-3 text-xs text-gray-500 dark:text-gray-400">
    {tenant.lastPaymentDate ? tenant.lastPaymentDate.toLocaleDateString('en-KE') : 'Never'}
  </td>
</tr>
