<script lang="ts">
  interface Props {
    password: string
  }

  let { password }: Props = $props()

  const score = $derived.by(() => {
    let value = 0
    if (password.length >= 8) value += 1
    if (password.length >= 12) value += 1
    if (/[A-Z]/.test(password) && /[a-z]/.test(password)) value += 1
    if (/\d/.test(password)) value += 1
    if (/[^A-Za-z0-9]/.test(password)) value += 1
    return value
  })

  const label = $derived.by(() => {
    if (score <= 1) return 'Weak'
    if (score === 2) return 'Fair'
    if (score <= 4) return 'Strong'
    return 'Very Strong'
  })

  const toneClass = $derived.by(() => {
    if (score <= 1) return 'text-red-400'
    if (score === 2) return 'text-amber-400'
    if (score <= 4) return 'text-emerald-400'
    return 'text-primary-400'
  })

  const activeBars = $derived(Math.max(1, Math.min(4, Math.ceil(score / 1.25))))
</script>

<div class="space-y-1.5">
  <div class="flex items-center justify-between text-xs">
    <span class="text-zinc-500">Password strength</span>
    <span class={`font-medium ${toneClass}`}>{label}</span>
  </div>
  <div class="grid grid-cols-4 gap-1.5">
    {#each Array.from({ length: 4 }) as _, index}
      <div
        class={`h-1.5 rounded-full ${
          index < activeBars
            ? score <= 1
              ? 'bg-red-500'
              : score === 2
                ? 'bg-amber-500'
                : score <= 4
                  ? 'bg-emerald-500'
                  : 'bg-primary-500'
            : 'bg-zinc-800'
        }`}
      ></div>
    {/each}
  </div>
</div>
