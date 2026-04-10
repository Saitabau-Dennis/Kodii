import { writable } from 'svelte/store';

export type ToastType = 'success' | 'error';

export type Toast = {
	id: number;
	type: ToastType;
	message: string;
	duration: number;
};

const toastsStore = writable<Toast[]>([]);

let nextId = 1;

function addToast(type: ToastType, message: string, duration = 4000) {
	const id = nextId++;
	const toast: Toast = { id, type, message, duration };

	toastsStore.update((items) => [...items, toast]);

	setTimeout(() => {
		toastsStore.update((items) => items.filter((item) => item.id !== id));
	}, duration);

	return id;
}

function removeToast(id: number) {
	toastsStore.update((items) => items.filter((item) => item.id !== id));
}

export const toastStore = {
	subscribe: toastsStore.subscribe,
	success: (message: string, duration?: number) => addToast('success', message, duration),
	error: (message: string, duration?: number) => addToast('error', message, duration),
	remove: removeToast
};
