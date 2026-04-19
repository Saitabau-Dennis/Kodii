<script lang="ts">
  import { resolve } from '$app/paths'
  import TicketForm from '$lib/components/maintenance/TicketForm.svelte'

  let { data } = $props() as { data: any }
</script>

<section class="space-y-4">
  <a href={resolve('/maintenance')} class="inline-flex text-sm text-zinc-400 hover:text-zinc-200">
    ← Maintenance
  </a>

  <div>
    <h2 class="text-xl font-semibold text-zinc-100">New Ticket</h2>
    <p class="text-sm text-zinc-400">Log a new maintenance issue</p>
  </div>

  <div class="rounded-lg border border-zinc-800 bg-zinc-950/70 p-4">
    <TicketForm
      properties={data.properties}
      caretakers={data.caretakers}
      unitsByProperty={data.unitsByProperty}
      senderId={data.senderId}
    />
  </div>
</section>
