import { pgTable, uuid, numeric, varchar, timestamp, text } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { tenants } from './tenants'
import { units } from './units'
import { rentInvoices } from './rent-invoices'
import { users } from './users'
import { paymentStatusEnum } from './enums'

export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').notNull().references(() => tenants.id),
  unitId: uuid('unit_id').notNull().references(() => units.id),
  invoiceId: uuid('invoice_id').references(() => rentInvoices.id),
  amountExpected: numeric('amount_expected', { precision: 12, scale: 2 }).notNull(),
  amountReceived: numeric('amount_received', { precision: 12, scale: 2 }),
  mpesaCode: varchar('mpesa_code', { length: 20 }),
  payerPhone: varchar('payer_phone', { length: 20 }),
  paymentReference: varchar('payment_reference', { length: 100 }),
  status: paymentStatusEnum('status').notNull().default('pending_verification'),
  submittedAt: timestamp('submitted_at'),
  verifiedAt: timestamp('verified_at'),
  verifiedBy: uuid('verified_by').references(() => users.id),
  notes: text('notes'),
})

export const paymentsRelations = relations(payments, ({ one }) => ({
  tenant: one(tenants, {
    fields: [payments.tenantId],
    references: [tenants.id],
  }),
  unit: one(units, {
    fields: [payments.unitId],
    references: [units.id],
  }),
  invoice: one(rentInvoices, {
    fields: [payments.invoiceId],
    references: [rentInvoices.id],
  }),
  verifier: one(users, {
    fields: [payments.verifiedBy],
    references: [users.id],
  }),
}))
