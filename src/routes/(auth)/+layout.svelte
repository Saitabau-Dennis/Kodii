<script lang="ts">
	import { page } from '$app/stores';
	import { toastStore } from '$lib/stores/toast';
	import { onDestroy } from 'svelte';

	let { children } = $props();
	let lastToastMessage = '';

	const unsubscribe = page.subscribe(($page) => {
		const message = $page.form?.message;
		if (typeof message !== 'string' || !message || message === lastToastMessage) return;

		toastStore.error(message);
		lastToastMessage = message;
	});

	onDestroy(unsubscribe);
</script>

{@render children()}
