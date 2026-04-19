<script lang="ts">
  import { goto } from '$app/navigation'
  import { resolve } from '$app/paths'
  import { TabItem, Tabs } from 'flowbite-svelte'
  import AccountTab from '$lib/components/settings/AccountTab.svelte'
  import BusinessForm from '$lib/components/settings/BusinessForm.svelte'
  import NotificationsForm from '$lib/components/settings/NotificationsForm.svelte'
  import PaymentsForm from '$lib/components/settings/PaymentsForm.svelte'
  import SecurityForm from '$lib/components/settings/SecurityForm.svelte'
  import type { PageData } from './$types'

  let { data }: { data: PageData } = $props()

  type SettingsTab = 'business' | 'payments' | 'notifications' | 'security' | 'account'

  let businessOpen = $state(false)
  let paymentsOpen = $state(false)
  let notificationsOpen = $state(false)
  let securityOpen = $state(false)
  let accountOpen = $state(false)

  function setOpenTab(tab: SettingsTab) {
    businessOpen = tab === 'business'
    paymentsOpen = tab === 'payments'
    notificationsOpen = tab === 'notifications'
    securityOpen = tab === 'security'
    accountOpen = tab === 'account'
  }

  function getOpenTab(): SettingsTab {
    if (paymentsOpen) return 'payments'
    if (notificationsOpen) return 'notifications'
    if (securityOpen) return 'security'
    if (accountOpen) return 'account'
    return 'business'
  }

  $effect(() => {
    data.activeTab
    setOpenTab(data.activeTab)
  })

  $effect(() => {
    const selectedTab = getOpenTab()
    if (selectedTab === data.activeTab) return
    goto(`${resolve('/settings')}?tab=${selectedTab}`)
  })
</script>

<div class="space-y-5">
  <div class="rounded-lg border border-zinc-800 bg-zinc-950/60 p-4">
    <Tabs
      tabStyle="none"
      classes={{ content: 'mt-4 p-0 bg-transparent dark:bg-transparent', divider: 'h-px bg-zinc-800' }}
    >
      <TabItem
        title="Business"
        bind:open={businessOpen}
        activeClass="rounded-md border border-emerald-500 bg-emerald-500/15 bg-[repeating-linear-gradient(45deg,rgba(16,185,129,0.18)_0,rgba(16,185,129,0.18)_1px,transparent_1px,transparent_10px),repeating-linear-gradient(-45deg,rgba(16,185,129,0.14)_0,rgba(16,185,129,0.14)_1px,transparent_1px,transparent_10px)] px-3 py-1.5 text-sm text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
        inactiveClass="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-300"
      >
        <section class="space-y-3">
          <div>
            <h3 class="text-base font-semibold text-zinc-100">Business Information</h3>
            <p class="text-xs text-zinc-500">
              This information appears in SMS messages sent to your tenants
            </p>
          </div>
          <BusinessForm user={data.user} settings={data.settings} />
        </section>
      </TabItem>

      <TabItem
        title="Payments"
        bind:open={paymentsOpen}
        activeClass="rounded-md border border-emerald-500 bg-emerald-500/15 bg-[repeating-linear-gradient(45deg,rgba(16,185,129,0.18)_0,rgba(16,185,129,0.18)_1px,transparent_1px,transparent_10px),repeating-linear-gradient(-45deg,rgba(16,185,129,0.14)_0,rgba(16,185,129,0.14)_1px,transparent_1px,transparent_10px)] px-3 py-1.5 text-sm text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
        inactiveClass="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-300"
      >
        <section class="space-y-3">
          <div>
            <h3 class="text-base font-semibold text-zinc-100">Payment Collection</h3>
            <p class="text-xs text-zinc-500">Configure how tenants pay their rent</p>
          </div>
          <PaymentsForm settings={data.settings} senderId={data.senderId} />
        </section>
      </TabItem>

      <TabItem
        title="Notifications"
        bind:open={notificationsOpen}
        activeClass="rounded-md border border-emerald-500 bg-emerald-500/15 bg-[repeating-linear-gradient(45deg,rgba(16,185,129,0.18)_0,rgba(16,185,129,0.18)_1px,transparent_1px,transparent_10px),repeating-linear-gradient(-45deg,rgba(16,185,129,0.14)_0,rgba(16,185,129,0.14)_1px,transparent_1px,transparent_10px)] px-3 py-1.5 text-sm text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
        inactiveClass="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-300"
      >
        <section class="space-y-3">
          <div>
            <h3 class="text-base font-semibold text-zinc-100">SMS Notification Settings</h3>
            <p class="text-xs text-zinc-500">Control when and how tenants receive reminders</p>
          </div>
          <NotificationsForm settings={data.settings} />
        </section>
      </TabItem>

      <TabItem
        title="Security"
        bind:open={securityOpen}
        activeClass="rounded-md border border-emerald-500 bg-emerald-500/15 bg-[repeating-linear-gradient(45deg,rgba(16,185,129,0.18)_0,rgba(16,185,129,0.18)_1px,transparent_1px,transparent_10px),repeating-linear-gradient(-45deg,rgba(16,185,129,0.14)_0,rgba(16,185,129,0.14)_1px,transparent_1px,transparent_10px)] px-3 py-1.5 text-sm text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
        inactiveClass="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-300"
      >
        <section class="space-y-3">
          <div>
            <h3 class="text-base font-semibold text-zinc-100">Change Password</h3>
            <p class="text-xs text-zinc-500">Update your KODII login password</p>
          </div>
          <SecurityForm sessionInfo={data.sessionInfo} />
        </section>
      </TabItem>

      <TabItem
        title="Account"
        bind:open={accountOpen}
        activeClass="rounded-md border border-emerald-500 bg-emerald-500/15 bg-[repeating-linear-gradient(45deg,rgba(16,185,129,0.18)_0,rgba(16,185,129,0.18)_1px,transparent_1px,transparent_10px),repeating-linear-gradient(-45deg,rgba(16,185,129,0.14)_0,rgba(16,185,129,0.14)_1px,transparent_1px,transparent_10px)] px-3 py-1.5 text-sm text-emerald-300 shadow-[0_0_0_1px_rgba(16,185,129,0.25)]"
        inactiveClass="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-300"
      >
        <section class="space-y-3">
          <div>
            <h3 class="text-base font-semibold text-zinc-100">Account Information</h3>
            <p class="text-xs text-zinc-500">Your KODII account details</p>
          </div>
          <AccountTab
            user={{
              id: data.user.id,
              role: data.user.role,
              createdAt: data.user.createdAt,
              lastLoginLabel: data.user.lastLoginLabel,
            }}
            exportData={data.exportData}
          />
        </section>
      </TabItem>
    </Tabs>
  </div>
</div>
