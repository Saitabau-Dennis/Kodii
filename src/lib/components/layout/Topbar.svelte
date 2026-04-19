<script lang="ts">
  import { Drawer } from 'flowbite-svelte'
  import {
    BarsOutline,
    SearchOutline,
    CogOutline,
    ArrowLeftToBracketOutline,
    HomeOutline,
    CloseOutline,
    UserCircleOutline,
  } from 'flowbite-svelte-icons'
  import { createPixelAvatar } from '$lib/utils/avatar'

  type User = {
    name: string
    role: string
  }

  interface Props {
    user: User
    pathname: string
    onMenuClick: () => void
  }

  let { user, pathname, onMenuClick }: Props = $props()

  const breadcrumbMap: Record<string, string> = {
    dashboard: 'Dashboard',
    properties: 'Properties',
    units: 'Units',
    tenants: 'Tenants',
    payments: 'Payments',
    maintenance: 'Maintenance',
    notices: 'Notices',
    reports: 'Reports',
    team: 'Team',
    settings: 'Settings',
  }

  const breadcrumbs = $derived.by(() => {
    const segments = pathname.split('/').filter(Boolean)

    if (segments.length === 0 || (segments.length === 1 && segments[0] === 'dashboard')) {
      return [{ label: 'Dashboard', href: '/dashboard', active: true }]
    }

    const items = [{ label: 'Home', href: '/dashboard', active: false }]

    let currentPath = ''
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`
      const isLast = index === segments.length - 1

      let label = breadcrumbMap[segment]
      if (!label) {
        if (segment.length > 15 || /\d/.test(segment)) {
          label = 'Details'
        } else {
          label = segment.charAt(0).toUpperCase() + segment.slice(1).replace(/-/g, ' ')
        }
      }

      items.push({ label, href: currentPath, active: isLast })
    })

    return items
  })

  const avatarUrl = $derived(createPixelAvatar(user.name, 32))

  let searchQuery = $state('')
  let profileDrawerOpen = $state(false)
</script>

<header class="flex h-14 items-center justify-between border-b border-zinc-800 bg-black px-3 lg:px-4">
  <div class="flex min-w-0 items-center gap-3">
    <button
      type="button"
      onclick={onMenuClick}
      class="inline-flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100 lg:hidden"
      aria-label="Open navigation"
    >
      <BarsOutline class="h-5 w-5" />
    </button>

    <nav
      class="flex min-w-0 items-center gap-1.5 text-[10px] font-medium lowercase tracking-normal text-zinc-500"
      aria-label="Breadcrumb"
    >
      <span class="text-zinc-800">/</span>
      {#each breadcrumbs as crumb, index}
        {#if index > 0}
          <span class="text-zinc-800">/</span>
        {/if}

        {#if !crumb.active}
          <a href={crumb.href} class="truncate transition-colors hover:text-emerald-400">
            {crumb.label}
          </a>
        {:else}
          <span class="truncate font-bold text-zinc-100">{crumb.label}</span>
        {/if}
      {/each}
    </nav>
  </div>

  <div class="flex items-center gap-2">
    <div class="hidden md:block">
      <label
        class="flex w-64 items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900/30 px-3 py-1.5 text-sm focus-within:border-emerald-500/50"
      >
        <SearchOutline class="h-3.5 w-3.5 shrink-0 text-zinc-500" />
        <input
          type="search"
          bind:value={searchQuery}
          placeholder="Search..."
          class="w-full border-0 bg-transparent p-0 text-xs text-zinc-100 placeholder-zinc-500 outline-none focus:ring-0"
        />
      </label>
    </div>

    <button
      type="button"
      onclick={() => (profileDrawerOpen = true)}
      class="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-zinc-900"
      aria-label="Open profile drawer"
    >
      <img src={avatarUrl} alt={user.name} class="h-8 w-8 rounded-none border border-zinc-700" />
      <span class="hidden text-sm text-zinc-200 sm:block">{user.name}</span>
    </button>
  </div>
</header>

<Drawer
  bind:open={profileDrawerOpen}
  placement="right"
  dismissable={true}
  modal={true}
  class="!bottom-0 !left-auto !right-0 !top-0 !h-[100dvh] !max-h-[100dvh] !w-full sm:!w-80 !border-l !border-zinc-900 !bg-black !text-zinc-100 !p-0 overflow-hidden"
>
  <div class="flex h-full min-h-0 flex-col bg-black">
    <div class="flex items-start justify-between gap-3 border-b border-zinc-900 px-4 py-3">
      <div class="flex items-center gap-3">
        <img src={avatarUrl} alt={user.name} class="h-10 w-10 border border-zinc-800 bg-zinc-950" />
        <div>
          <h3 class="text-sm font-semibold text-zinc-100">{user.name}</h3>
          <p class="text-[10px] uppercase tracking-wider text-zinc-500">{user.role}</p>
        </div>
      </div>
      <button
        type="button"
        class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950 text-zinc-400 hover:bg-zinc-900 hover:text-zinc-100"
        onclick={() => (profileDrawerOpen = false)}
        aria-label="Close profile drawer"
      >
        <CloseOutline class="h-4 w-4" />
      </button>
    </div>

    <div class="px-3 py-3">
      <a
        href="/settings"
        onclick={() => (profileDrawerOpen = false)}
        class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-950 hover:text-zinc-100"
      >
        <CogOutline class="h-4.5 w-4.5" />
        <span>Settings</span>
      </a>
      <a
        href="/logout"
        class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-zinc-950 hover:text-zinc-100"
      >
        <ArrowLeftToBracketOutline class="h-4.5 w-4.5" />
        <span>Logout</span>
      </a>
    </div>

    <div class="mt-auto border-t border-zinc-900 px-4 py-3">
      <p class="text-center text-[10px] text-zinc-600">Kodii Property Management</p>
    </div>
  </div>
</Drawer>
