<script lang="ts">
  import { resolve } from '$app/paths'
  import PageHeader from '$lib/components/layout/PageHeader.svelte'
  import NoticeForm from '$lib/components/notices/NoticeForm.svelte'

  let { data } = $props() as { data: any }
</script>

<section class="space-y-4">
  <a href={resolve('/notices')} class="inline-flex text-sm text-zinc-400 hover:text-zinc-200">Notices</a>

  <PageHeader title="Send Notice" />

  <div class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
    <NoticeForm
      properties={data.properties}
      unitsByProperty={data.unitsByProperty}
      tenants={data.tenants}
      canSendAllTenants={data.canSendAllTenants}
    />
  </div>
</section>
