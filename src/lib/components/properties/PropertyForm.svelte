<script lang="ts">
  import type { ActionResult } from '@sveltejs/kit'
  import { enhance } from '$app/forms'
  import { invalidateAll } from '$app/navigation'

  type EditableProperty = {
    id: string
    name: string
    location: string | null
    totalUnits: number
    caretakerName: string | null
    caretakerPhone: string | null
    notes: string | null
  }

  interface Props {
    property?: EditableProperty
    onSuccess: () => void
    onCancel: () => void
  }

  let { property, onSuccess, onCancel }: Props = $props()

  let name = $state('')
  let location = $state('')
  let totalUnits = $state(0)
  let caretakerName = $state('')
  let caretakerPhone = $state('')
  let notes = $state('')
  let isSubmitting = $state(false)
  let errorMessage = $state('')
  let fieldErrors = $state<{ name?: string; location?: string; id?: string }>({})

  const isEditMode = $derived(Boolean(property))
  const actionPath = $derived(isEditMode ? '?/updateProperty' : '?/createProperty')
  const submitLabel = $derived(isEditMode ? 'Save Changes' : 'Add Property')

  $effect(() => {
    name = property?.name ?? ''
    location = property?.location ?? ''
    totalUnits = property?.totalUnits ?? 0
    caretakerName = property?.caretakerName ?? ''
    caretakerPhone = property?.caretakerPhone ?? ''
    notes = property?.notes ?? ''
    errorMessage = ''
    fieldErrors = {}
  })

  function handleSubmit() {
    isSubmitting = true
    errorMessage = ''
    fieldErrors = {}

    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      isSubmitting = false

      if (result.type === 'success') {
        await invalidateAll()
        onSuccess()
        return
      }

      if (result.type === 'failure') {
        const data = (result.data as
          | { message?: string; errors?: { name?: string; location?: string; id?: string } }
          | undefined)
        errorMessage = data?.message ?? 'Unable to save property'
        fieldErrors = data?.errors ?? {}
        return
      }

      if (result.type === 'error') {
        errorMessage = 'Unable to save property right now'
      }
    }
  }
</script>

<form method="post" action={actionPath} class="space-y-3" use:enhance={handleSubmit}>
  {#if isEditMode}
    <input type="hidden" name="id" value={property?.id ?? ''} />
  {/if}

  <label class="grid gap-1.5">
    <span class="text-sm font-medium text-zinc-200">Property name</span>
    <input
      type="text"
      name="name"
      bind:value={name}
      required
      maxlength="255"
      class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
      placeholder="Enter property name"
    />
    {#if fieldErrors.name}
      <span class="text-xs text-red-300">{fieldErrors.name}</span>
    {/if}
  </label>

  <label class="grid gap-1.5">
    <span class="text-sm font-medium text-zinc-200">Location</span>
    <input
      type="text"
      name="location"
      bind:value={location}
      required
      maxlength="255"
      class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
      placeholder="Enter location"
    />
    {#if fieldErrors.location}
      <span class="text-xs text-red-300">{fieldErrors.location}</span>
    {/if}
  </label>

  <label class="grid gap-1.5">
    <span class="text-sm font-medium text-zinc-200">Total units</span>
    <input
      type="number"
      name="totalUnits"
      bind:value={totalUnits}
      required
      min="0"
      class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
      placeholder="Enter total units"
    />
  </label>

  <label class="grid gap-1.5">
    <span class="text-sm font-medium text-zinc-200">Caretaker name (optional)</span>
    <input
      type="text"
      name="caretakerName"
      bind:value={caretakerName}
      maxlength="255"
      class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
      placeholder="Caretaker name"
    />
  </label>

  <label class="grid gap-1.5">
    <span class="text-sm font-medium text-zinc-200">Caretaker phone (optional)</span>
    <input
      type="tel"
      name="caretakerPhone"
      bind:value={caretakerPhone}
      maxlength="20"
      class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
      placeholder="Caretaker phone"
    />
  </label>

  <label class="grid gap-1.5">
    <span class="text-sm font-medium text-zinc-200">Notes (optional)</span>
    <textarea
      name="notes"
      bind:value={notes}
      rows="3"
      class="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500"
      placeholder="Additional notes"
    ></textarea>
  </label>

  {#if errorMessage}
    <p class="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">
      {errorMessage}
    </p>
  {/if}

  <div class="flex justify-end gap-2 border-t border-zinc-800 pt-3">
    <button
      type="button"
      onclick={onCancel}
      class="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
    >
      Cancel
    </button>
    <button
      type="submit"
      disabled={isSubmitting}
      class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
    >
      {isSubmitting ? 'Saving...' : submitLabel}
    </button>
  </div>
</form>
