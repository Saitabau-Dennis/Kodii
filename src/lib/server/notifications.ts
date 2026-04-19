import { AT_SHORTCODE } from '$env/static/private'
import { sendSMS } from '$lib/server/sms'
import type { TicketCategory, TicketStatus } from '$lib/types/maintenance'

/**
 * Sends a one-time PIN to a user's phone.
 */
export async function sendOTP(phone: string, otp: string): Promise<void> {
  const message = `Your KODII verification PIN is ${otp}. It expires in 10 minutes. Please do not share this code.`
  await sendSMS({ to: phone, message })
}

/**
 * Sends a caretaker invitation SMS.
 */
export async function sendCaretakerInvite(phone: string, inviteMessage: string): Promise<void> {
  await sendSMS({ to: phone, message: inviteMessage })
}

/**
 * Sends a property-assignment SMS to a caretaker.
 */
export async function sendCaretakerPropertyAssignment(
  phone: string,
  assignmentMessage: string,
): Promise<void> {
  await sendSMS({ to: phone, message: assignmentMessage })
}

export async function sendTicketCreatedSMS(
  tenant: { fullName: string; phoneNumber: string },
  unit: { id: string; unitNumber: string },
  category: TicketCategory,
  ticketShortId: string,
): Promise<void> {
  const message = `Your ${category} issue has been logged for Unit ${unit.unitNumber}. Reference: TKT-${ticketShortId}. Our team will assist shortly. Thank you for your patience.`
  await sendSMS({ to: tenant.phoneNumber, message })
}

export async function sendTicketStatusUpdateSMS(
  tenant: { fullName: string; phoneNumber: string },
  unit: { unitNumber: string },
  ticket: { category: TicketCategory; shortId: string },
  status: TicketStatus,
): Promise<void> {
  let message = ''

  if (status === 'in_progress') {
    message = `Your ${ticket.category} issue for Unit ${unit.unitNumber} (Ref: TKT-${ticket.shortId}) is now in progress. Thank you for your patience.`
  } else if (status === 'resolved') {
    message = `Your ${ticket.category} issue for Unit ${unit.unitNumber} (Ref: TKT-${ticket.shortId}) has been resolved. Please let us know if you need any further assistance.`
  } else if (status === 'closed') {
    message = `Your issue for Unit ${unit.unitNumber} (Ref: TKT-${ticket.shortId}) has been closed. Thank you.`
  }

  if (!message) return

  await sendSMS({ to: tenant.phoneNumber, message })
}

export async function sendTicketAssignedSMS(
  caretaker: { name: string; phone: string },
  unit: { unitNumber: string },
  property: { name: string },
  ticket: { category: TicketCategory; description: string },
): Promise<void> {
  const message = `You have been assigned a ${ticket.category} issue at Unit ${unit.unitNumber}, ${property.name}. Description: ${ticket.description}. Please attend to this as soon as possible. Thank you.`

  await sendSMS({ to: caretaker.phone, message })
}

export async function sendSMSReportReplySMS(
  phone: string,
  unitNumber: string,
  ticketShortId: string,
  customMessage?: string,
): Promise<void> {
  const message =
    customMessage ??
    `Your issue has been logged for Unit ${unitNumber}. Reference: TKT-${ticketShortId}. Our team will assist shortly.`

  await sendSMS({ to: phone, message })
}

export async function sendPaymentConfirmedSMS(
  tenant: { fullName: string; phoneNumber: string },
  unit: { unitNumber: string },
  amount: number,
  mpesaCode: string,
): Promise<void> {
  const message = `Your payment of KES ${amount.toLocaleString('en-KE')} for Unit ${unit.unitNumber} has been confirmed. M-Pesa code: ${mpesaCode}. Thank you.`
  await sendSMS({ to: tenant.phoneNumber, message })
}

export async function sendPaymentPartialSMS(
  tenant: { fullName: string; phoneNumber: string },
  unit: { unitNumber: string },
  amount: number,
  remaining: number,
  dueDate: string,
): Promise<void> {
  const message = `Your payment of KES ${amount.toLocaleString('en-KE')} for Unit ${unit.unitNumber} has been received. Outstanding balance: KES ${remaining.toLocaleString('en-KE')}. Kindly pay the balance by ${dueDate}. Thank you.`
  await sendSMS({ to: tenant.phoneNumber, message })
}

export async function sendPaymentRejectedSMS(
  tenant: { fullName: string; phoneNumber: string },
  unit: { unitNumber: string },
  amount: number,
  mpesaCode: string,
  reason: string,
): Promise<void> {
  const message = `Your payment of KES ${amount.toLocaleString('en-KE')} for Unit ${unit.unitNumber} (M-Pesa: ${mpesaCode}) could not be confirmed. Reason: ${reason}. Please contact your landlord for assistance.`
  await sendSMS({ to: tenant.phoneNumber, message })
}

export async function sendRentDueReminderSMS(
  tenant: { fullName: string; phoneNumber: string },
  unit: { unitNumber: string },
  amount: number,
  dueDate: string,
): Promise<void> {
  const message = `Your rent of KES ${amount.toLocaleString('en-KE')} for Unit ${unit.unitNumber} is due on ${dueDate}. After payment, please send: PAY ${unit.unitNumber} ${amount} [mpesa_code] to ${AT_SHORTCODE || 'KODII'}. Thank you.`
  await sendSMS({ to: tenant.phoneNumber, message })
}

export async function sendRentOverdueReminderSMS(
  tenant: { fullName: string; phoneNumber: string },
  unit: { unitNumber: string },
  amount: number,
  dueDate: string,
): Promise<void> {
  const message = `Your rent of KES ${amount.toLocaleString('en-KE')} for Unit ${unit.unitNumber} is overdue since ${dueDate}. Kindly make payment as soon as possible. After payment, please send: PAY ${unit.unitNumber} ${amount} [mpesa_code] to ${AT_SHORTCODE || 'KODII'}. Thank you.`
  await sendSMS({ to: tenant.phoneNumber, message })
}
