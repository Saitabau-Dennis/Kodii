/**
 * Retries a database query up to `retries` times with a delay between attempts.
 * Used to handle Neon DB cold start timeouts.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 6,
  delay = 500,
): Promise<T> {
  const maxDelay = 8000

  for (let i = 0; i < retries; i++) {
    try {
      return await fn()
    } catch (err) {
      const isLastAttempt = i === retries - 1
      if (isLastAttempt) throw err

      const backoffDelay = Math.min(delay * 2 ** i, maxDelay)
      const jitter = Math.floor(Math.random() * 250)
      const waitMs = backoffDelay + jitter

      console.warn(
        `[KODII] DB query failed. Retrying in ${waitMs}ms... ` +
          `(attempt ${i + 1} of ${retries})`,
      )
      await new Promise((resolve) => setTimeout(resolve, waitMs))
    }
  }

  throw new Error('[KODII] All database retries failed')
}
