import { db } from '$lib/server/db'
import { settings } from '$lib/db/schema'

/**
 * Creates default settings for a landlord account.
 */
export async function createDefaultSettings(
  userId: string,
  businessName?: string | null
): Promise<void> {
  await db
    .insert(settings)
    .values({
      userId,
      businessName: businessName ?? null,
      defaultDueDay: 1,
      reminderDaysBefore: 3,
    })
    .onConflictDoNothing({ target: settings.userId })
}
