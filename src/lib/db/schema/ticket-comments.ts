import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { maintenanceTickets } from './maintenance-tickets'
import { users } from './users'

export const ticketComments = pgTable('ticket_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  ticketId: uuid('ticket_id')
    .notNull()
    .references(() => maintenanceTickets.id, { onDelete: 'cascade' }),
  authorId: uuid('author_id')
    .notNull()
    .references(() => users.id),
  message: text('message').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const ticketCommentsRelations = relations(ticketComments, ({ one }) => ({
  ticket: one(maintenanceTickets, {
    fields: [ticketComments.ticketId],
    references: [maintenanceTickets.id],
  }),
  author: one(users, {
    fields: [ticketComments.authorId],
    references: [users.id],
  }),
}))
