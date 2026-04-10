import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { users } from './users'
import { units } from './units'
import { maintenanceTickets } from './maintenance-tickets'
import { caretakerProperties } from './caretaker-properties'

export const properties = pgTable('properties', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  location: text('location'),
  caretakerName: varchar('caretaker_name', { length: 255 }),
  caretakerPhone: varchar('caretaker_phone', { length: 20 }),
  notes: text('notes'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  owner: one(users, {
    fields: [properties.ownerId],
    references: [users.id],
  }),
  units: many(units),
  maintenanceTickets: many(maintenanceTickets),
  caretakerProperties: many(caretakerProperties),
}))
