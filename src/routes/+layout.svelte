<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';
	import './layout.css';
	import favicon from '$lib/assets/favicon.svg';
	import Toast from '$lib/components/ui/Toast.svelte';
	import { toastStore } from '$lib/stores/toast';
	import { onDestroy } from 'svelte';

	let { children } = $props();
	let lastQueryToast = '';

	const unsubscribe = page.subscribe(($page) => {
		const success = $page.url.searchParams.get('success');
		const error = $page.url.searchParams.get('error');
		const currentToast = success ?? error;

		if (!currentToast || currentToast === lastQueryToast) return;

		if (success) {
			toastStore.success(success);
		} else if (error) {
			toastStore.error(error);
		}

		lastQueryToast = currentToast;

		if (!browser) return;

		const cleanedUrl = new URL($page.url);
		cleanedUrl.searchParams.delete('success');
		cleanedUrl.searchParams.delete('error');
		window.history.replaceState({}, '', cleanedUrl);
	});

	onDestroy(unsubscribe);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link
		rel="stylesheet"
		href="https://fonts.googleapis.com/css2?family=Onest:wght@100..900&family=Orbitron:wght@700..900&display=swap"
	/>
</svelte:head>
<Toast />
{@render children()}
