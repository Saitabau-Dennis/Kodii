<script lang="ts">
	import type { Snippet } from 'svelte';
	import { browser } from '$app/environment';
	import { navigating, page } from '$app/state';
	import { onMount } from 'svelte';
	import { Drawer } from 'flowbite-svelte';
	import { CloseOutline } from 'flowbite-svelte-icons';
	import type { LayoutData } from './$types';
	import Sidebar from '$lib/components/layout/Sidebar.svelte';
	import Topbar from '$lib/components/layout/Topbar.svelte';

	const SIDEBAR_STORAGE_KEY = 'kodii_sidebar_collapsed';

	let { data, children }: { data: LayoutData; children: Snippet } = $props();

	let sidebarCollapsed = $state(false);
	let mobileDrawerOpen = $state(false);
	let showProgress = $state(false);
	let showSpinner = $state(false);
	let progress = $state(0);

	const pathname = $derived(page.url.pathname);
	const isNavigating = $derived(Boolean(navigating.to));

	onMount(() => {
		if (!browser) return;
		sidebarCollapsed = localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
	});

	$effect(() => {
		if (!browser) return;
		localStorage.setItem(SIDEBAR_STORAGE_KEY, sidebarCollapsed ? 'true' : 'false');
	});

	function toggleSidebar() {
		sidebarCollapsed = !sidebarCollapsed;
	}

	function openMobileDrawer() {
		mobileDrawerOpen = true;
	}

	function closeMobileDrawer() {
		mobileDrawerOpen = false;
	}

	$effect(() => {
		let timer: ReturnType<typeof setInterval> | undefined;
		let completeTimer: ReturnType<typeof setTimeout> | undefined;

		if (isNavigating) {
			showProgress = true;
			progress = 12;

			timer = setInterval(() => {
				progress = Math.min(progress + Math.random() * 12, 90);
			}, 180);
		} else if (showProgress) {
			progress = 100;
			completeTimer = setTimeout(() => {
				showProgress = false;
				progress = 0;
			}, 220);
		}

		return () => {
			if (timer) clearInterval(timer);
			if (completeTimer) clearTimeout(completeTimer);
		};
	});

	$effect(() => {
		let spinnerTimer: ReturnType<typeof setTimeout> | undefined;

		if (isNavigating) {
			spinnerTimer = setTimeout(() => {
				showSpinner = true;
			}, 200);
		} else {
			showSpinner = false;
		}

		return () => {
			if (spinnerTimer) clearTimeout(spinnerTimer);
		};
	});
</script>

<div class="flex h-screen overflow-hidden bg-black text-zinc-100">
	{#if showProgress}
		<div class="pointer-events-none fixed top-0 right-0 left-0 z-[60] h-0.5 bg-transparent">
			<div
				class="h-full bg-emerald-400 transition-[width] duration-200 ease-out"
				style={`width: ${progress}%`}
			></div>
		</div>
	{/if}

	{#if showSpinner}
		<div class="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
			<div
				class="h-8 w-8 animate-spin rounded-full border-2 border-zinc-700 border-t-emerald-400"
			></div>
		</div>
	{/if}

	<Sidebar user={data.user} collapsed={sidebarCollapsed} onToggle={toggleSidebar} />

	<Drawer
		bind:open={mobileDrawerOpen}
		placement="left"
		modal={true}
		outsideclose={true}
		class="bg-black text-zinc-100 lg:hidden"
	>
		<div class="flex items-center justify-end border-b border-zinc-900/70 px-3 py-2.5">
			<button
				type="button"
				onclick={closeMobileDrawer}
				class="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-800 bg-zinc-950 text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-900 hover:text-zinc-100"
				aria-label="Close navigation"
			>
				<CloseOutline class="h-4 w-4" />
			</button>
		</div>
		<Sidebar
			user={data.user}
			collapsed={false}
			mobile={true}
			onToggle={() => {}}
			onNavigate={closeMobileDrawer}
		/>
	</Drawer>

	<div class="flex min-h-0 min-w-0 flex-1 flex-col">
		<Topbar user={data.user} {pathname} onMenuClick={openMobileDrawer} />

		<main class="no-scrollbar flex-1 overflow-y-auto bg-black px-6 py-4 text-sm lg:px-8 xl:px-10">
			{@render children()}
		</main>
	</div>
</div>
