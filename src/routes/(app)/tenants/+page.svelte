<script lang="ts">
	import type { ActionResult } from '@sveltejs/kit';
	import { enhance } from '$app/forms';
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { Button, Modal, PaginationNav, Select, Table } from 'flowbite-svelte';
	import { UserOutline } from 'flowbite-svelte-icons';
	import PageHeader from '$lib/components/layout/PageHeader.svelte';
	import EmptyState from '$lib/components/ui/EmptyState.svelte';
	import AssignUnitForm from '$lib/components/tenants/AssignUnitForm.svelte';
	import MoveOutForm from '$lib/components/tenants/MoveOutForm.svelte';
	import TenantForm from '$lib/components/tenants/TenantForm.svelte';
	import TenantRow from '$lib/components/tenants/TenantRow.svelte';
	import { toastStore } from '$lib/stores/toast';
	import type { TenantWithUnit } from '$lib/types/tenants';

	let { data } = $props() as { data: any };

	let addModalOpen = $state(false);
	let editModalOpen = $state(false);
	let assignModalOpen = $state(false);
	let moveOutModalOpen = $state(false);
	let removeModalOpen = $state(false);
	let removeError = $state('');
	let removeSaving = $state(false);
	let selectedTenant = $state<TenantWithUnit | null>(null);

	const isLandlord = $derived(data.user.role === 'landlord');
	const selectedStatus = $derived(data.selectedStatus ?? 'all');
	const selectedProperty = $derived(data.selectedProperty ?? '');
	const hasFilters = $derived(Boolean(selectedProperty) || selectedStatus !== 'all');
	const startItem = $derived(data.totalCount === 0 ? 0 : (data.currentPage - 1) * 10 + 1);
	const endItem = $derived(Math.min(data.currentPage * 10, data.totalCount));

	const statusPills: Array<'all' | 'active' | 'inactive' | 'moved_out'> = [
		'all',
		'active',
		'inactive',
		'moved_out'
	];

	const selectClass =
		'w-full rounded-md border border-zinc-700 bg-zinc-950/70 px-3 py-1.5 text-sm text-zinc-200 [&>option]:bg-zinc-950 [&>option]:text-zinc-200 focus:border-emerald-500 focus:ring-emerald-500/30';
	const inactivePillClass =
		'border-zinc-700 bg-zinc-950/70 text-zinc-300 hover:border-zinc-500 hover:text-zinc-100';
	const selectClasses = { select: selectClass };

	function formatPhoneLocal(phone: string) {
		const digits = phone.replace(/\D/g, '');
		if (digits.length === 12 && digits.startsWith('254')) {
			return `0${digits.slice(3, 6)} ${digits.slice(6, 9)} ${digits.slice(9, 12)}`;
		}
		if (digits.length === 10 && digits.startsWith('0')) {
			return `${digits.slice(0, 4)} ${digits.slice(4, 7)} ${digits.slice(7, 10)}`;
		}
		return phone;
	}

	function buildTenantsUrl(next: { page?: number; property?: string; status?: string }) {
		const params = new URLSearchParams(page.url.searchParams);

		if (next.page && next.page > 1) params.set('page', String(next.page));
		else params.delete('page');

		const property = next.property ?? selectedProperty;
		if (property) params.set('property', property);
		else params.delete('property');

		const status = next.status ?? selectedStatus;
		if (status && status !== 'all') params.set('status', status);
		else params.delete('status');

		const query = params.toString();
		return `${resolve('/tenants')}${query ? `?${query}` : ''}`;
	}

	function handlePageChange(nextPage: number) {
		goto(buildTenantsUrl({ page: nextPage }));
	}

	function handlePropertyFilterChange(event: Event) {
		const value = (event.currentTarget as HTMLSelectElement).value;
		goto(buildTenantsUrl({ property: value, page: 1 }));
	}

	function handleStatusFilterChange(status: 'all' | 'active' | 'inactive' | 'moved_out') {
		goto(buildTenantsUrl({ status, page: 1 }));
	}

	function openEdit(tenant: TenantWithUnit) {
		selectedTenant = tenant;
		editModalOpen = true;
	}

	function openAssign(tenant: TenantWithUnit) {
		selectedTenant = tenant;
		assignModalOpen = true;
	}

	function openMoveOut(tenant: TenantWithUnit) {
		selectedTenant = tenant;
		moveOutModalOpen = true;
	}

	function openRemove(tenant: TenantWithUnit) {
		selectedTenant = tenant;
		removeError = '';
		removeModalOpen = true;
	}

	function onCreated() {
		addModalOpen = false;
		toastStore.success('Tenant added');
	}

	function onUpdated() {
		editModalOpen = false;
		toastStore.success('Tenant updated');
	}

	function onAssigned() {
		assignModalOpen = false;
		toastStore.success('Unit assigned');
	}

	function onMovedOut() {
		moveOutModalOpen = false;
		toastStore.success('Tenant moved out');
	}

	function handleRemoveSubmit() {
		removeSaving = true;
		removeError = '';

		return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
			await update();
			removeSaving = false;

			if (result.type === 'success') {
				removeModalOpen = false;
				selectedTenant = null;
				toastStore.success('Tenant removed');
				return;
			}

			if (result.type === 'failure') {
				removeError =
					(result.data as { message?: string } | undefined)?.message ?? 'Unable to remove tenant';
				return;
			}

			if (result.type === 'error') {
				removeError = 'Unable to remove tenant right now';
			}
		};
	}
</script>

<PageHeader>
	{#snippet left()}
		<div class="flex items-center gap-2">
			<Select
				items={[
					{ name: 'All Properties', value: '' },
					...data.properties.map((property: { id: string; name: string }) => ({
						name: property.name,
						value: property.id
					}))
				]}
				value={selectedProperty}
				onchange={handlePropertyFilterChange}
				classes={selectClasses}
				class="h-9 min-w-[200px]"
			/>

			<div class="flex items-center gap-2 border-l border-zinc-800 pl-2">
				{#each statusPills as status}
					<button
						type="button"
						class={`rounded-md border px-3 py-1.5 text-sm whitespace-nowrap transition ${
							selectedStatus === status
								? 'border-emerald-500 bg-emerald-500/15 bg-[repeating-linear-gradient(45deg,rgba(16,185,129,0.18)_0,rgba(16,185,129,0.18)_1px,transparent_1px,transparent_10px),repeating-linear-gradient(-45deg,rgba(16,185,129,0.14)_0,rgba(16,185,129,0.14)_1px,transparent_1px,transparent_10px)] text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]'
								: inactivePillClass
						}`}
						onclick={() => handleStatusFilterChange(status)}
					>
						{status === 'all'
							? 'All'
							: status === 'moved_out'
								? 'Moved Out'
								: status.charAt(0).toUpperCase() + status.slice(1)}
					</button>
				{/each}
			</div>
		</div>
	{/snippet}

	{#snippet right()}
		<div class="flex items-center gap-4">
			<div class="text-xs text-zinc-500">
				Showing <span class="text-zinc-300">{startItem}-{endItem}</span> of
				<span class="text-zinc-300">{data.totalCount}</span>
			</div>
			{#if isLandlord}
				<Button color="primary" size="sm" onclick={() => (addModalOpen = true)}>Add Tenant</Button>
			{/if}
		</div>
	{/snippet}
</PageHeader>

{#if data.tenants.length === 0}
	<EmptyState
		message={hasFilters ? 'No tenants match your filters' : 'No tenants yet'}
		icon={UserOutline}
	/>
	<div class="mt-3 flex justify-center gap-3">
		{#if hasFilters}
			<a href={resolve('/tenants')} class="text-sm text-emerald-400 hover:text-emerald-300"
				>Clear filters</a
			>
		{/if}
		{#if isLandlord && !hasFilters}
			<Button color="primary" size="sm" onclick={() => (addModalOpen = true)}
				>Add your first tenant</Button
			>
		{/if}
	</div>
{:else}
	<div class="rounded-lg border border-zinc-800">
		<div class="overflow-x-auto">
			<Table hoverable={true} class="min-w-[1060px]">
				<thead class="border-b border-zinc-800 text-xs text-zinc-400 uppercase">
					<tr>
						<th class="px-4 py-3 text-left">Name</th>
						<th class="px-4 py-3 text-left">Phone</th>
						<th class="px-4 py-3 text-left">Property</th>
						<th class="px-4 py-3 text-left">Unit</th>
						<th class="px-4 py-3 text-left">Status</th>
						<th class="px-4 py-3 text-left">Outstanding</th>
						<th class="px-4 py-3 text-left">Actions</th>
					</tr>
				</thead>
				<tbody>
					{#each data.tenants as tenant (tenant.id)}
						<TenantRow
							tenant={{ ...tenant, phoneNumber: formatPhoneLocal(tenant.phoneNumber) }}
							onEdit={openEdit}
							onAssign={openAssign}
							onMoveOut={openMoveOut}
							onRemove={openRemove}
							canManage={isLandlord}
						/>
					{/each}
				</tbody>
			</Table>
		</div>
	</div>
{/if}

{#if data.totalPages > 1}
	<div class="mt-4 flex justify-center sm:justify-end">
		<PaginationNav
			currentPage={data.currentPage}
			totalPages={data.totalPages}
			onPageChange={handlePageChange}
		/>
	</div>
{/if}

{#if isLandlord}
	<Modal
		bind:open={addModalOpen}
		size="md"
		dismissable={false}
		class="rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100"
		classes={{ form: 'overflow-hidden rounded-lg', header: 'hidden', body: 'bg-zinc-950 p-0' }}
	>
		<div class="p-4">
			<TenantForm
				mode="create"
				properties={data.properties}
				onSuccess={onCreated}
				onCancel={() => (addModalOpen = false)}
			/>
		</div>
	</Modal>

	<Modal
		bind:open={editModalOpen}
		size="md"
		dismissable={false}
		class="rounded-lg border border-zinc-800 bg-zinc-950 text-zinc-100"
		classes={{ form: 'overflow-hidden rounded-lg', header: 'hidden', body: 'bg-zinc-950 p-0' }}
	>
		<div class="p-4">
			{#if selectedTenant}
				<TenantForm
					tenant={selectedTenant}
					mode="edit"
					properties={data.properties}
					onSuccess={onUpdated}
					onCancel={() => (editModalOpen = false)}
				/>
			{/if}
		</div>
	</Modal>

	<Modal
		bind:open={assignModalOpen}
		size="md"
		dismissable={false}
		class="border border-zinc-800 bg-zinc-950 text-zinc-100"
		classes={{ header: 'hidden', body: 'bg-zinc-950 p-0' }}
	>
		<div class="border-b border-zinc-800 px-4 py-3">
			<h3 class="text-base font-semibold text-zinc-100">Assign Unit</h3>
		</div>
		<div class="p-4">
			{#if selectedTenant}
				<AssignUnitForm
					tenantId={selectedTenant.id}
					tenantName={selectedTenant.fullName}
					properties={data.properties}
					onSuccess={onAssigned}
					onCancel={() => (assignModalOpen = false)}
				/>
			{/if}
		</div>
	</Modal>

	<Modal
		bind:open={moveOutModalOpen}
		size="md"
		dismissable={false}
		class="border border-zinc-800 bg-zinc-950 text-zinc-100"
		classes={{ header: 'hidden', body: 'bg-zinc-950 p-0' }}
	>
		<div class="border-b border-zinc-800 px-4 py-3">
			<h3 class="text-base font-semibold text-zinc-100">Move Out Tenant</h3>
		</div>
		<div class="p-4">
			{#if selectedTenant}
				<MoveOutForm
					tenant={selectedTenant}
					onSuccess={onMovedOut}
					onCancel={() => (moveOutModalOpen = false)}
				/>
			{/if}
		</div>
	</Modal>

	<Modal
		bind:open={removeModalOpen}
		modal={true}
		dismissable={false}
		class="fixed inset-x-0 top-[42%] z-50 mx-auto h-fit w-[min(92vw,32rem)] -translate-y-1/2 rounded-xl border border-zinc-700/80 bg-zinc-950 text-zinc-100 shadow-2xl shadow-black/60"
		classes={{
			form: 'overflow-hidden rounded-xl',
			header: 'hidden',
			body: 'bg-zinc-950 p-0'
		}}
	>
		<div class="space-y-4 px-6 py-6">
			<div class="space-y-2">
				<h3 class="text-base font-semibold text-zinc-100">Remove Tenant</h3>
				<p class="text-sm text-zinc-400">
					Are you sure you want to remove <span class="text-zinc-200"
						>{selectedTenant?.fullName}</span
					>? Their history will be kept but they will be marked as inactive.
				</p>
			</div>

			{#if removeError}
				<p
					class="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm whitespace-pre-line text-red-300"
				>
					{removeError}
				</p>
			{/if}

			<form method="post" action="?/removeTenant" use:enhance={handleRemoveSubmit}>
				<input type="hidden" name="id" value={selectedTenant?.id ?? ''} />
				<div class="flex justify-end gap-2">
					<button
						type="button"
						class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
						onclick={() => (removeModalOpen = false)}
					>
						Cancel
					</button>
					<button
						type="submit"
						disabled={removeSaving}
						class="rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
					>
						{removeSaving ? 'Removing...' : 'Remove'}
					</button>
				</div>
			</form>
		</div>
	</Modal>
{/if}
