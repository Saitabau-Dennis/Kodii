import { pgTable, uuid, varchar, numeric, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { properties } from './properties'
import { unitStatusEnum } from './enums'
import { rentInvoices } from './rent-invoices'
import { payments } from './payments'
import { maintenanceTickets } from './maintenance-tickets'

export const units = pgTable('units', {
  id: uuid('id').primaryKey().defaultRandom(),
  propertyId: uuid('property_id').notNull().references(() => properties.id, { onDelete: 'cascade' }),
  unitNumber: varchar('unit_number', { length: 50 }).notNull(),
  monthlyRent: numeric('monthly_rent', { precision: 12, scale: 2 }).notNull().default('0'),
  status: unitStatusEnum('status').notNull().default('vacant'),
  tenantId: uuid('tenant_id'),
  paymentReference: varchar('payment_reference', { length: 100 }),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const unitsRelations = relations(units, ({ one, many }) => ({
  property: one(properties, {
    fields: [units.propertyId],
    references: [properties.id],
  }),
  tenant: one(tenants, {
    fields: [units.tenantId],
    references: [tenants.id],
  }),
  rentInvoices: many(rentInvoices),
  payments: many(payments),
  maintenanceTickets: many(maintenanceTickets),
}))

// imported after to avoid circular reference error
import { tenants } from './tenants'
