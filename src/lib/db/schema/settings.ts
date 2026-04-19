import { pgTable, uuid, varchar, smallint, timestamp, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { collectionTypeEnum } from './enums'

export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
  businessName: varchar('business_name', { length: 255 }),
  appUrl: varchar('app_url', { length: 255 }),
  collectionType: collectionTypeEnum('collection_type'),
  paybillNumber: varchar('paybill_number', { length: 20 }),
  tillNumber: varchar('till_number', { length: 20 }),
  paybillName: varchar('paybill_name', { length: 255 }),
  tillName: varchar('till_name', { length: 255 }),
  collectionAccount: varchar('collection_account', { length: 20 }),
  accountName: varchar('account_name', { length: 255 }),
  accountNumber: varchar('account_number', { length: 255 }),
  referenceRule: varchar('reference_rule', { length: 100 }),
  defaultDueDay: smallint('default_due_day').default(1),
  reminderDaysBefore: smallint('reminder_days_before').default(3),
  enableRentReminders: boolean('enable_rent_reminders').notNull().default(true),
  remindOnDueDay: boolean('remind_on_due_day').notNull().default(true),
  enableOverdueReminders: boolean('enable_overdue_reminders').notNull().default(true),
  overdueReminderFrequency: smallint('overdue_reminder_frequency').notNull().default(7),
  overdueMaxReminders: smallint('overdue_max_reminders').notNull().default(3),
  notifyPaymentConfirmed: boolean('notify_payment_confirmed').notNull().default(true),
  notifyPaymentRejected: boolean('notify_payment_rejected').notNull().default(true),
  notifyTicketStatus: boolean('notify_ticket_status').notNull().default(true),
  notifyTicketAssigned: boolean('notify_ticket_assigned').notNull().default(true),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
})

export const settingsRelations = relations(settings, ({ one }) => ({
  user: one(users, {
    fields: [settings.userId],
    references: [users.id],
  }),
}))
