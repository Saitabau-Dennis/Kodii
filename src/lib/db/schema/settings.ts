import { pgTable, uuid, varchar, smallint, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { collectionTypeEnum } from './enums'

export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  businessName: varchar('business_name', { length: 255 }),
  collectionType: collectionTypeEnum('collection_type'),
  collectionAccount: varchar('collection_account', { length: 20 }),
  accountName: varchar('account_name', { length: 255 }),
  referenceRule: varchar('reference_rule', { length: 100 }),
  defaultDueDay: smallint('default_due_day').default(1),
  reminderDaysBefore: smallint('reminder_days_before').default(3),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const settingsRelations = relations(settings, ({ one }) => ({
  user: one(users, {
    fields: [settings.userId],
    references: [users.id],
  }),
}))
