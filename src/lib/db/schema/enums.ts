import { pgEnum } from 'drizzle-orm/pg-core'

export const roleEnum = pgEnum('role', ['landlord', 'caretaker'])

export const inviteStatusEnum = pgEnum('invite_status', ['pending', 'accepted', 'deactivated'])

export const unitStatusEnum = pgEnum('unit_status', ['vacant', 'occupied', 'inactive'])

export const tenantStatusEnum = pgEnum('tenant_status', ['active', 'inactive', 'moved_out'])

export const invoiceStatusEnum = pgEnum('invoice_status', ['unpaid', 'partial', 'paid', 'overdue', 'written_off'])

export const paymentStatusEnum = pgEnum('payment_status', [
  'unpaid',
  'pending_verification',
  'paid',
  'partial',
  'overdue',
  'rejected',
])

export const ticketCategoryEnum = pgEnum('ticket_category', [
  'water',
  'electricity',
  'plumbing',
  'security',
  'other',
])

export const ticketStatusEnum = pgEnum('ticket_status', [
  'open',
  'in_progress',
  'resolved',
  'closed',
])

export const noticeTargetEnum = pgEnum('notice_target', [
  'all_tenants',
  'property',
  'unit',
  'tenant',
])

export const collectionTypeEnum = pgEnum('collection_type', ['paybill', 'till'])
