<script lang="ts">
  import type { ActionResult } from '@sveltejs/kit'
  import { enhance } from '$app/forms'
  import { toastStore } from '$lib/stores/toast'

  interface Props {
    settings: {
      enableRentReminders: boolean
      reminderDaysBefore: number | null
      remindOnDueDay: boolean
      enableOverdueReminders: boolean
      overdueReminderFrequency: number | null
      overdueMaxReminders: number | null
      notifyPaymentConfirmed: boolean
      notifyPaymentRejected: boolean
      notifyTicketStatus: boolean
      notifyTicketAssigned: boolean
    }
  }

  let { settings }: Props = $props()

  let enableRentReminders = $state(true)
  let reminderDaysBefore = $state(3)
  let remindOnDueDay = $state(true)
  let enableOverdueReminders = $state(true)
  let overdueReminderFrequency = $state(7)
  let overdueMaxReminders = $state(3)
  let notifyPaymentConfirmed = $state(true)
  let notifyPaymentRejected = $state(true)
  let notifyTicketStatus = $state(true)
  let notifyTicketAssigned = $state(true)

  let isSubmitting = $state(false)
  let errorMessage = $state('')
  let fieldErrors = $state<Record<string, string>>({})

  function pluralize(value: number, singular: string, plural = `${singular}s`) {
    return value === 1 ? singular : plural
  }

  const previewMessages = $derived.by(() => {
    const messages: { title: string; body: string }[] = []
    const reminderDays = Math.max(1, Number(reminderDaysBefore) || 1)
    const overdueDays = Math.max(1, Number(overdueReminderFrequency) || 1)
    const maxOverdueMessages = Math.max(1, Number(overdueMaxReminders) || 1)

    if (enableRentReminders) {
      messages.push({
        title: 'Rent reminder',
        body: `Hi Dennis, your rent for Unit C9 is due in ${reminderDays} ${pluralize(reminderDays, 'day')}. Please pay before due date to avoid penalties. - KODII`,
      })
    }

    if (remindOnDueDay) {
      messages.push({
        title: 'Due today',
        body: 'Hi Dennis, your rent for Unit C9 is due today. Please complete payment to keep your account current. - KODII',
      })
    }

    if (enableOverdueReminders) {
      messages.push({
        title: 'Overdue follow-up',
        body: `Reminder: your rent is overdue. You will receive follow-up every ${overdueDays} ${pluralize(overdueDays, 'day')} (max ${maxOverdueMessages} ${pluralize(maxOverdueMessages, 'message')}) until payment is made. - KODII`,
      })
    }

    if (notifyPaymentConfirmed) {
      messages.push({
        title: 'Payment confirmed',
        body: 'Payment received: KES 12,600 for Unit C9. M-Pesa code: QWE123RT. Thank you. - KODII',
      })
    }

    if (notifyPaymentRejected) {
      messages.push({
        title: 'Payment rejected',
        body: 'We could not verify your recent payment for Unit C9. Please contact management with your M-Pesa code. - KODII',
      })
    }

    if (notifyTicketStatus) {
      messages.push({
        title: 'Maintenance status',
        body: 'Update: Your maintenance ticket (Plumbing - Unit C9) is now In Progress. We will notify you when it is completed. - KODII',
      })
    }

    if (notifyTicketAssigned) {
      messages.push({
        title: 'Ticket assigned',
        body: 'Your maintenance ticket (Plumbing - Unit C9) has been assigned to a caretaker and work will start soon. - KODII',
      })
    }

    return messages
  })

  $effect(() => {
    settings
    enableRentReminders = settings.enableRentReminders
    reminderDaysBefore = settings.reminderDaysBefore ?? 3
    remindOnDueDay = settings.remindOnDueDay
    enableOverdueReminders = settings.enableOverdueReminders
    overdueReminderFrequency = settings.overdueReminderFrequency ?? 7
    overdueMaxReminders = settings.overdueMaxReminders ?? 3
    notifyPaymentConfirmed = settings.notifyPaymentConfirmed
    notifyPaymentRejected = settings.notifyPaymentRejected
    notifyTicketStatus = settings.notifyTicketStatus
    notifyTicketAssigned = settings.notifyTicketAssigned
  })

  function handleSubmit() {
    isSubmitting = true
    errorMessage = ''
    fieldErrors = {}

    return async ({ result, update }: { result: ActionResult; update: () => Promise<void> }) => {
      await update()
      isSubmitting = false

      if (result.type === 'success') {
        toastStore.success('Notification settings saved')
        return
      }

      if (result.type === 'failure') {
        const payload = (result.data as { message?: string; errors?: Record<string, string> } | undefined) ?? {}
        errorMessage = payload.message ?? 'Unable to save notification settings'
        fieldErrors = payload.errors ?? {}
        return
      }

      errorMessage = 'Unable to save notification settings'
    }
  }
</script>

<form method="post" action="?/updateNotifications" class="space-y-5" use:enhance={handleSubmit}>
  <section class="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
    <div>
      <h4 class="text-base font-semibold text-zinc-100">Rent Due Reminders</h4>
      <p class="text-xs text-zinc-500">Send SMS reminders to tenants before rent is due</p>
    </div>

    <label class="flex items-center gap-2 text-sm text-zinc-300">
      <input type="checkbox" name="enableRentReminders" bind:checked={enableRentReminders} class="rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500" />
      Enable rent reminders
    </label>

    <label class="grid max-w-sm gap-1.5">
      <span class="text-sm text-zinc-300">Send reminder X days before due date</span>
      <input
        type="number"
        name="reminderDaysBefore"
        min="1"
        max="14"
        bind:value={reminderDaysBefore}
        disabled={!enableRentReminders}
        class="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 disabled:opacity-50"
      />
      <span class="text-xs text-zinc-500">e.g. 3 means tenants get reminded 3 days early</span>
      {#if fieldErrors.reminderDaysBefore}
        <span class="text-xs text-red-300">{fieldErrors.reminderDaysBefore}</span>
      {/if}
    </label>

    <label class="flex items-center gap-2 text-sm text-zinc-300">
      <input type="checkbox" name="remindOnDueDay" bind:checked={remindOnDueDay} class="rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500" />
      Send reminder on the due date itself
    </label>
  </section>

  <section class="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
    <div>
      <h4 class="text-base font-semibold text-zinc-100">Overdue Reminders</h4>
      <p class="text-xs text-zinc-500">Send reminders when rent is past due</p>
    </div>

    <label class="flex items-center gap-2 text-sm text-zinc-300">
      <input type="checkbox" name="enableOverdueReminders" bind:checked={enableOverdueReminders} class="rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500" />
      Enable overdue reminders
    </label>

    <label class="grid max-w-sm gap-1.5">
      <span class="text-sm text-zinc-300">Send overdue reminder every X days</span>
      <input
        type="number"
        name="overdueReminderFrequency"
        min="1"
        max="30"
        bind:value={overdueReminderFrequency}
        disabled={!enableOverdueReminders}
        class="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 disabled:opacity-50"
      />
      <span class="text-xs text-zinc-500">
        Tenants with overdue rent get reminded every X days until paid
      </span>
      {#if fieldErrors.overdueReminderFrequency}
        <span class="text-xs text-red-300">{fieldErrors.overdueReminderFrequency}</span>
      {/if}
    </label>

    <label class="grid max-w-sm gap-1.5">
      <span class="text-sm text-zinc-300">Stop after X reminders</span>
      <input
        type="number"
        name="overdueMaxReminders"
        min="1"
        max="10"
        bind:value={overdueMaxReminders}
        disabled={!enableOverdueReminders}
        class="h-9 rounded-lg border border-zinc-700 bg-zinc-900 px-3 text-sm text-zinc-100 disabled:opacity-50"
      />
      <span class="text-xs text-zinc-500">Prevents excessive SMS to tenants</span>
      {#if fieldErrors.overdueMaxReminders}
        <span class="text-xs text-red-300">{fieldErrors.overdueMaxReminders}</span>
      {/if}
    </label>
  </section>

  <section class="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
    <h4 class="text-base font-semibold text-zinc-100">Payment Confirmations</h4>
    <label class="flex items-center gap-2 text-sm text-zinc-300">
      <input type="checkbox" name="notifyPaymentConfirmed" bind:checked={notifyPaymentConfirmed} class="rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500" />
      Send SMS when payment is confirmed
    </label>
    <label class="flex items-center gap-2 text-sm text-zinc-300">
      <input type="checkbox" name="notifyPaymentRejected" bind:checked={notifyPaymentRejected} class="rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500" />
      Send SMS when payment is rejected
    </label>
  </section>

  <section class="space-y-3 rounded-lg border border-zinc-800 bg-zinc-950/40 p-4">
    <h4 class="text-base font-semibold text-zinc-100">Maintenance Updates</h4>
    <label class="flex items-center gap-2 text-sm text-zinc-300">
      <input type="checkbox" name="notifyTicketStatus" bind:checked={notifyTicketStatus} class="rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500" />
      Send SMS when ticket status changes
    </label>
    <label class="flex items-center gap-2 text-sm text-zinc-300">
      <input type="checkbox" name="notifyTicketAssigned" bind:checked={notifyTicketAssigned} class="rounded border-zinc-600 bg-zinc-900 text-emerald-500 focus:ring-emerald-500" />
      Send SMS when ticket is assigned
    </label>
  </section>

  <section class="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/40 p-3">
    <h4 class="text-base font-semibold text-zinc-100">SMS Preview</h4>
    {#if previewMessages.length > 0}
      <div class="space-y-2">
        {#each previewMessages as message}
          <div class="rounded-md border border-zinc-800 bg-black/70 p-2.5">
            <p class="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{message.title}</p>
            <p class="mt-1 text-xs leading-relaxed text-zinc-300">{message.body}</p>
          </div>
        {/each}
      </div>
    {:else}
      <p class="text-xs text-zinc-500">All SMS notifications are currently disabled.</p>
    {/if}
  </section>

  {#if errorMessage}
    <p class="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-300">{errorMessage}</p>
  {/if}

  <button
    type="submit"
    disabled={isSubmitting}
    class="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-emerald-950 hover:brightness-105 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-300"
  >
    {isSubmitting ? 'Saving...' : 'Save Notification Settings'}
  </button>
</form>
