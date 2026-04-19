import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { properties } from './properties'
import { units } from './units'
import { tenants } from './tenants'
import { users } from './users'
import { ticketCategoryEnum, ticketStatusEnum } from './enums'

export const maintenanceTickets = pgTable('maintenance_tickets', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  unitId: uuid('unit_id').notNull().references(() => units.id),
  tenantId: uuid('tenant_id').references(() => tenants.id),
  category: ticketCategoryEnum('category').notNull(),
  description: text('description').notNull(),
  status: ticketStatusEnum('status').notNull().default('open'),
  assignedTo: uuid('assigned_to').references(() => users.id),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  resolvedAt: timestamp('resolved_at'),
})

export const maintenanceTicketsRelations = relations(maintenanceTickets, ({ one, many }) => ({
  property: one(properties, {
    fields: [maintenanceTickets.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [maintenanceTickets.unitId],
    references: [units.id],
  }),
  tenant: one(tenants, {
    fields: [maintenanceTickets.tenantId],
    references: [tenants.id],
  }),
  assignee: one(users, {
    fields: [maintenanceTickets.assignedTo],
    references: [users.id],
  }),
  comments: many(ticketComments),
}))

import { ticketComments } from './ticket-comments'
