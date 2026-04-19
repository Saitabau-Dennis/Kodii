<script lang="ts">
  import { page } from '$app/state'

  let { status, error }: { status: number; error: App.Error } = $props()

  const retryHref = $derived(page.url.pathname + page.url.search)
</script>

<main class="flex min-h-screen items-center justify-center bg-black px-4 py-10 text-zinc-100">
  <section class="w-full max-w-xl rounded-xl border border-zinc-800 bg-zinc-950/80 p-6 sm:p-8">
    <p class="text-xs font-semibold tracking-[0.14em] text-zinc-500">ERROR {status}</p>
    <h1 class="mt-2 text-2xl font-semibold">Unable to load this page</h1>
    <p class="mt-3 text-sm text-zinc-400">
      {status >= 500 ? 'An unexpected error occurred. Please try again.' : 'This request could not be completed.'}
    </p>

    {#if error?.message}
      <p class="mt-3 rounded-md border border-zinc-800 bg-black/50 px-3 py-2 text-xs text-zinc-300">
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
        href="/"
        class="inline-flex items-center rounded-md border border-zinc-700 px-3 py-2 text-sm font-medium text-zinc-200 transition hover:border-zinc-600 hover:bg-zinc-900"
      >
        Home
      </a>
    </div>
  </section>
</main>
