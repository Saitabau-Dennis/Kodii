import { pgTable, uuid, varchar, text, timestamp, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { notices } from './notices'
import { tenants } from './tenants'

export const noticeReplies = pgTable('notice_replies', {
  id: uuid('id').primaryKey().defaultRandom(),
  noticeId: uuid('notice_id').references(() => notices.id, { onDelete: 'set null' }),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'set null' }),
  fromPhone: varchar('from_phone', { length: 20 }).notNull(),
  message: text('message').notNull(),
  receivedAt: timestamp('received_at').notNull().defaultNow(),
  isRead: boolean('is_read').notNull().default(false),
})

export const noticeRepliesRelations = relations(noticeReplies, ({ one }) => ({
  notice: one(notices, {
    fields: [noticeReplies.noticeId],
    references: [notices.id],
  }),
  tenant: one(tenants, {
    fields: [noticeReplies.tenantId],
    references: [tenants.id],
  }),
}))
