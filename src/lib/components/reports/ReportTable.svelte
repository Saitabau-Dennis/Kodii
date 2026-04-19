<script lang="ts">
  import { Table } from 'flowbite-svelte'
  import { downloadCSV, toCSV } from '$lib/utils/csv'

  interface Props {
    title: string
    subtitle?: string
    headers: string[]
    rows: (string | number | null)[][]
    exportFilename: string
    emptyMessage: string
    footerRow?: (string | number | null)[] | null
  }

  let { title, subtitle, headers, rows, exportFilename, emptyMessage, footerRow = null }: Props = $props()

  function exportSection() {
    const content = toCSV(headers, rows)
    downloadCSV(exportFilename, content)
  }
</script>

<section class="mt-8">
  <div class="mb-4 flex flex-col gap-3 border-b border-gray-200 pb-3 dark:border-gray-800 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h3 class="text-base font-semibold text-gray-900 dark:text-white">{title}</h3>
      {#if subtitle}
        <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{subtitle}</p>
      {/if}
    </div>
    <button
      type="button"
      class="w-fit rounded-md border border-gray-300 px-3 py-1.5 text-xs text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:bg-gray-800"
      onclick={() => exportSection()}
    >
      Export CSV
    </button>
  </div>

  <div class="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-800">
    <div class="overflow-x-auto">
      <Table hoverable={true} class="min-w-[900px]">
        <thead class="text-xs font-medium uppercase tracking-wider text-gray-500 dark:text-gray-400">
          <tr>
            {#each headers as header}
              <th class="px-4 py-3 text-left">{header}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#if rows.length === 0}
            <tr>
              <td colspan={headers.length} class="px-4 py-6 text-center text-sm text-zinc-500">{emptyMessage}</td>
            </tr>
          {:else}
            {#each rows as row}
              <tr class="border-t border-gray-100 text-sm text-gray-700 dark:border-gray-800 dark:text-gray-300">
                {#each row as cell}
                  <td class="px-4 py-3">{cell ?? '—'}</td>
                {/each}
              </tr>
            {/each}
          {/if}
        </tbody>
        {#if footerRow && rows.length > 0}
          <tfoot class="border-t border-gray-200 text-sm font-medium text-gray-900 dark:border-gray-700 dark:text-white">
            <tr>
              {#each footerRow as cell}
                <td class="px-4 py-3">{cell ?? '—'}</td>
              {/each}
            </tr>
          </tfoot>
        {/if}
      </Table>
    </div>
  </div>
</section>
