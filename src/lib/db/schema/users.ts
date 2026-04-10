import { pgTable, uuid, varchar, timestamp, foreignKey, boolean } from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { roleEnum, inviteStatusEnum } from './enums'
import { properties } from './properties'
import { otpCodes } from './otp-codes'
import { settings } from './settings'
import { payments } from './payments'
import { maintenanceTickets } from './maintenance-tickets'
import { notices } from './notices'
import { activityLogs } from './activity-logs'
import { caretakerProperties } from './caretaker-properties'

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: varchar('name', { length: 255 }).notNull(),
    phone: varchar('phone', { length: 20 }).notNull().unique(),
    email: varchar('email', { length: 255 }).notNull().unique(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: roleEnum('role').notNull(),
    businessName: varchar('business_name', { length: 255 }),
    invitedBy: uuid('invited_by'),
    inviteStatus: inviteStatusEnum('invite_status'),
    phoneVerified: boolean('phone_verified').notNull().default(false),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    foreignKey({
      columns: [table.invitedBy],
      foreignColumns: [table.id],
      name: 'users_invited_by_users_id_fk',
    }),
  ]
)

export const usersRelations = relations(users, ({ one, many }) => ({
  invitedByUser: one(users, {
    fields: [users.invitedBy],
    references: [users.id],
  }),
  caretakers: many(users),
  properties: many(properties),
  settings: one(settings, {
    fields: [users.id],
    references: [settings.userId],
  }),
  otpCodes: many(otpCodes),
  verifiedPayments: many(payments),
  assignedTickets: many(maintenanceTickets),
  sentNotices: many(notices),
  activityLogs: many(activityLogs),
  caretakerProperties: many(caretakerProperties),
}))
