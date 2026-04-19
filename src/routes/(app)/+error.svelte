<script lang="ts">
  import { page } from '$app/state'

  let { status, error }: { status: number; error: App.Error } = $props()

  const retryHref = $derived(page.url.pathname + page.url.search)
</script>

<section class="mx-auto flex min-h-full w-full max-w-2xl items-center justify-center px-4 py-10">
  <div class="w-full rounded-xl border border-zinc-800 bg-zinc-950/70 p-6 sm:p-8">
    <p class="text-xs font-semibold tracking-[0.14em] text-zinc-500">REQUEST FAILED ({status})</p>
    <h1 class="mt-2 text-2xl font-semibold text-zinc-100">Something went wrong</h1>
    <p class="mt-3 text-sm text-zinc-400">
      {status >= 500
        ? 'This section is temporarily unavailable. You can retry without leaving the app.'
        : 'This page could not be loaded.'}
    </p>

    {#if error?.message}
      <p class="mt-3 rounded-md border border-zinc-800 bg-black/40 px-3 py-2 text-xs text-zinc-300">
        {error.message}
      </p>
    {/if}

    <div class="mt-5 flex flex-wrap gap-2">
      <a
        href={retryHref}
        class="inline-flex items-center rounded-md bg-emerald-500 px-3 py-2 text-sm font-medium text-white transition hover:bg-emerald-400"
      >
        Try again
      </a>
      <a
        href="/dashboard"
        class="inline-flex items-center rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900"
      >
        Dashboard
      </a>
    </div>
  </div>
</section>
