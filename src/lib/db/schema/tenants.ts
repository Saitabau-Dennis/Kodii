import { pgTable, uuid, varchar, date, smallint, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { properties } from './properties'
import { units } from './units'
import { tenantStatusEnum } from './enums'
import { rentInvoices } from './rent-invoices'
import { payments } from './payments'
import { maintenanceTickets } from './maintenance-tickets'
import { notices } from './notices'

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id').notNull().references(() => properties.id),
  unitId: uuid('unit_id').references(() => units.id),
  fullName: varchar('full_name', { length: 255 }).notNull(),
  phoneNumber: varchar('phone_number', { length: 20 }).notNull().unique(),
  idNumber: varchar('id_number', { length: 50 }),
  moveInDate: date('move_in_date').notNull(),
  moveOutDate: date('move_out_date'),
  rentDueDay: smallint('rent_due_day').notNull().default(1),
  status: tenantStatusEnum('status').notNull().default('active'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const tenantsRelations = relations(tenants, ({ one, many }) => ({
  property: one(properties, {
    fields: [tenants.propertyId],
    references: [properties.id],
  }),
  unit: one(units, {
    fields: [tenants.unitId],
    references: [units.id],
  }),
  rentInvoices: many(rentInvoices),
  payments: many(payments),
  maintenanceTickets: many(maintenanceTickets),
  notices: many(notices),
}))
