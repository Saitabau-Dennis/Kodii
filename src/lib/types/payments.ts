export type PaymentWithDetails = {
  id: string
  tenantId: string
  tenantName: string
  tenantPhone: string
  unitId: string
  unitNumber: string
  propertyId: string
  propertyName: string
  invoiceId: string | null
  amountExpected: number
  amountReceived: number | null
  unitMonthlyRent: number
  tenantCreditBalance: number
  mpesaCode: string | null
  payerPhone: string | null
  paymentReference: string | null
  status: 'unpaid' | 'pending_verification' | 'paid' | 'partial' | 'overdue' | 'rejected'
  submittedAt: Date | null
  verifiedAt: Date | null
  verifiedBy: string | null
  verifiedByName: string | null
  notes: string | null
}
