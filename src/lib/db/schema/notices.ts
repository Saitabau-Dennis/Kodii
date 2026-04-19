import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { noticeTargetEnum } from './enums'

export const notices = pgTable('notices', {
  id: uuid('id').primaryKey().defaultRandom(),
  title: varchar('title', { length: 255 }),
  message: text('message').notNull(),
  targetType: noticeTargetEnum('target_type').notNull(),
  targetId: uuid('target_id'),
  sentBy: uuid('sent_by').notNull().references(() => users.id),
  sentAt: timestamp('sent_at').notNull().defaultNow(),
  deliveryStatus: varchar('delivery_status', { length: 20 }),
})

export const noticesRelations = relations(notices, ({ one, many }) => ({
  sender: one(users, {
    fields: [notices.sentBy],
    references: [users.id],
  }),
  replies: many(noticeReplies),
}))

import { noticeReplies } from './notice-replies'
