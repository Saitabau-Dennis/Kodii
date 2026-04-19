<script lang="ts">
  import { page } from '$app/state'
  import {
    BuildingOutline,
    CashOutline,
    ChartPieOutline,
    BellOutline,
    CogOutline,
    HomeOutline,
    UsersGroupOutline,
    FileChartBarOutline,
    ToolsOutline,
    ChevronDownOutline,
    ChevronRightOutline,
    ChevronDoubleLeftOutline,
    ChevronDoubleRightOutline,
  } from 'flowbite-svelte-icons'
  import { createPixelAvatar } from '$lib/utils/avatar'

  type User = {
    name: string
    role: string
    businessName?: string
  }

  type NavItem = {
    label: string
    href: string
    icon: typeof ChartPieOutline
    landlordOnly?: boolean
  }

  type NavGroup = {
    key: 'rentals' | 'finance' | 'operations'
    label: string
    items: NavItem[]
  }

  interface Props {
    user: User
    collapsed: boolean
    onToggle: () => void
    mobile?: boolean
    onNavigate?: () => void
  }

  let { user, collapsed, onToggle, mobile = false, onNavigate }: Props = $props()

  const pathname = $derived(page.url.pathname)

  const standaloneItems: NavItem[] = [
    { label: 'Dashboard', href: '/dashboard', icon: ChartPieOutline },
    { label: 'Properties', href: '/properties', icon: HomeOutline },
    { label: 'Team', href: '/team', icon: UsersGroupOutline, landlordOnly: true },
    { label: 'Settings', href: '/settings', icon: CogOutline },
  ]

  const groups: NavGroup[] = [
    {
      key: 'rentals',
      label: 'Rentals',
      items: [
        { label: 'Units', href: '/units', icon: BuildingOutline },
        { label: 'Tenants', href: '/tenants', icon: UsersGroupOutline },
      ],
    },
    {
      key: 'finance',
      label: 'Finance',
      items: [
        { label: 'Payments', href: '/payments', icon: CashOutline },
        { label: 'Reports', href: '/reports', icon: FileChartBarOutline },
      ],
    },
    {
      key: 'operations',
      label: 'Operations',
      items: [
        { label: 'Maintenance', href: '/maintenance', icon: ToolsOutline },
        { label: 'Notices', href: '/notices', icon: BellOutline },
      ],
    },
  ]

  let openGroups = $state<Record<NavGroup['key'], boolean>>({
    rentals: false,
    finance: false,
    operations: false,
  })

  function isActive(href: string) {
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  function isGroupActive(group: NavGroup) {
    return group.items.some((item) => isActive(item.href))
  }

  $effect(() => {
    for (const group of groups) {
      if (isGroupActive(group)) {
        openGroups[group.key] = true
      }
    }
  })

  const visibleStandalone = $derived(
    standaloneItems.filter((item) => !item.landlordOnly || user.role !== 'caretaker'),
  )

  const avatarUrl = $derived(createPixelAvatar(user.name, 32))

  const isCollapsed = $derived(!mobile && collapsed)
</script>

<aside
  class={`${mobile ? 'flex min-h-full w-64 flex-col border-r border-zinc-900/40' : `hidden h-screen shrink-0 lg:flex lg:flex-col ${isCollapsed ? 'w-16' : 'w-64'} transition-all duration-200 border-r border-zinc-800`} bg-black`}
>
  <div class="px-4 py-6">
    <a href="/dashboard" class="flex items-center gap-2.5 no-underline">
      {#if isCollapsed}
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 font-black text-black">
          K
        </div>
      {:else}
        <div class="flex items-baseline gap-1.5">
          <span class="text-xl font-black tracking-tighter text-emerald-500">
            KODII
          </span>
          <span class="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-zinc-400">
            BETA
          </span>
        </div>
      {/if}
    </a>
  </div>

  <nav class="flex-1 overflow-y-auto px-2 py-3 text-sm">
    {#each visibleStandalone.filter((item) => item.href === '/dashboard') as item}
      <a
        href={item.href}
        onclick={onNavigate}
        class={`mb-1 flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition hover:bg-zinc-900 hover:text-zinc-100 ${isActive(item.href) ? 'bg-zinc-900 font-medium text-emerald-400' : 'text-zinc-400'}`}
        title={isCollapsed ? item.label : undefined}
      >
        <item.icon class="h-5 w-5 shrink-0" />
        {#if !isCollapsed}
          <span>{item.label}</span>
        {/if}
      </a>
    {/each}

    {#each groups as group}
      {#if !isCollapsed}
        <button
          type="button"
          onclick={() => (openGroups[group.key] = !openGroups[group.key])}
          class={`mt-2 flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm transition hover:bg-zinc-900 hover:text-zinc-100 ${isGroupActive(group) ? 'bg-zinc-900 font-medium text-emerald-400' : 'text-zinc-400'}`}
        >
          <span>{group.label}</span>
          {#if openGroups[group.key]}
            <ChevronDownOutline class="h-4 w-4" />
          {:else}
            <ChevronRightOutline class="h-4 w-4" />
          {/if}
        </button>
      {:else}
        <button
          type="button"
          onclick={() => (openGroups[group.key] = !openGroups[group.key])}
          class={`mt-2 flex w-full items-center justify-center rounded-lg px-2 py-2 transition hover:bg-zinc-900 hover:text-zinc-100 ${isGroupActive(group) ? 'bg-zinc-900 text-emerald-400' : 'text-zinc-400'}`}
          title={group.label}
        >
          <ChevronRightOutline class={`h-4 w-4 transition-transform ${openGroups[group.key] ? 'rotate-90' : ''}`} />
        </button>
      {/if}

      {#if openGroups[group.key]}
        <div class={`${isCollapsed ? 'mt-1 space-y-1' : 'mt-1 ml-2 space-y-1 border-l border-zinc-800 pl-3'}`}>
          {#each group.items as item}
            <a
              href={item.href}
              onclick={onNavigate}
              class={`flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition hover:bg-zinc-900 hover:text-zinc-100 ${isActive(item.href) ? 'bg-zinc-900 font-medium text-emerald-400' : 'text-zinc-400'}`}
              title={isCollapsed ? item.label : undefined}
            >
              <item.icon class="h-5 w-5 shrink-0" />
              {#if !isCollapsed}
                <span>{item.label}</span>
              {/if}
            </a>
          {/each}
        </div>
      {/if}
    {/each}

    {#each visibleStandalone.filter((item) => item.href !== '/dashboard') as item}
      <a
        href={item.href}
        onclick={onNavigate}
        class={`mt-2 flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition hover:bg-zinc-900 hover:text-zinc-100 ${isActive(item.href) ? 'bg-zinc-900 font-medium text-emerald-400' : 'text-zinc-400'}`}
        title={isCollapsed ? item.label : undefined}
      >
        <item.icon class="h-5 w-5 shrink-0" />
        {#if !isCollapsed}
          <span>{item.label}</span>
        {/if}
      </a>
    {/each}
  </nav>

  <div class="border-t border-zinc-800 p-2">
    <div class={`mb-2 flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'} rounded-lg px-2 py-2`}>
      <img src={avatarUrl} alt={user.name} class="h-8 w-8 rounded-none border border-zinc-700" />
      {#if !isCollapsed}
        <div class="min-w-0">
          <p class="truncate text-sm font-medium text-zinc-100">{user.name}</p>
          <p class="text-xs text-zinc-400 capitalize">{user.role}</p>
        </div>
      {/if}
    </div>

    {#if !mobile}
      <button
        type="button"
        onclick={onToggle}
        class={`flex w-full items-center rounded-lg border border-zinc-700 px-2 py-2 text-sm text-zinc-400 transition hover:bg-zinc-900 hover:text-zinc-100 ${isCollapsed ? 'justify-center' : 'gap-3'}`}
        title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {#if isCollapsed}
          <ChevronDoubleRightOutline class="h-5 w-5" />
        {:else}
          <ChevronDoubleLeftOutline class="h-5 w-5" />
          <span>Collapse</span>
        {/if}
      </button>
    {/if}
  </div>
</aside>
