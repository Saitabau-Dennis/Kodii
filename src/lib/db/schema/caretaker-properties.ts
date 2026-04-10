import { pgTable, uuid, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { properties } from './properties'

export const caretakerProperties = pgTable('caretaker_properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  caretakerId: uuid('caretaker_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  assignedBy: uuid('assigned_by').notNull().references(() => users.id),
  assignedAt: timestamp('assigned_at').notNull().defaultNow(),
})

export const caretakerPropertiesRelations = relations(caretakerProperties, ({ one }) => ({
  caretaker: one(users, {
    fields: [caretakerProperties.caretakerId],
    references: [users.id],
  }),
  property: one(properties, {
    fields: [caretakerProperties.propertyId],
    references: [properties.id],
  }),
  assigner: one(users, {
    fields: [caretakerProperties.assignedBy],
    references: [users.id],
  }),
}))
