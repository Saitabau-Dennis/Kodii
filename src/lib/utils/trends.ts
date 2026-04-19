/**
 * Calculates percentage change between two values
 */
export function calcTrend(current: number, previous: number) {
  if (previous === 0) {
    return {
      percentage: 0,
      isUp: true,
      label: 'No data last month',
    }
  }

  const percentage = Math.round(((current - previous) / previous) * 100)
  return {
    percentage: Math.abs(percentage),
    isUp: percentage >= 0,
    label: `${Math.abs(percentage)}% vs last month`,
  }
}

/**
 * Formats a number as KES currency
 */
export function formatKES(amount: number): string {
  return `KES ${amount.toLocaleString('en-KE')}`
}

/**
 * Returns relative time string
 */
export function relativeTime(date: Date): string {
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 60) return `${minutes} minutes ago`
  if (hours < 24) return `${hours} hours ago`
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`

  return date.toLocaleDateString('en-KE', {
    day: 'numeric',
    month: 'short',
  })
}

/**
 * Returns greeting based on time of day
 */
export function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}
