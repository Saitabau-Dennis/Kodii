import { pgTable, uuid, numeric, date, timestamp } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tenants } from './tenants'
import { units } from './units'
import { invoiceStatusEnum } from './enums'
import { payments } from './payments'

export const rentInvoices = pgTable('rent_invoices', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
  unitId: uuid('unit_id').notNull().references(() => units.id),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  dueDate: date('due_date').notNull(),
  status: invoiceStatusEnum('status').notNull().default('unpaid'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})

export const rentInvoicesRelations = relations(rentInvoices, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [rentInvoices.tenantId],
    references: [tenants.id],
  }),
  unit: one(units, {
    fields: [rentInvoices.unitId],
    references: [units.id],
  }),
  payments: many(payments),
}))
