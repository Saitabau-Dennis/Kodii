export type UnitWithDetails = {
  id: string
  propertyId: string
  propertyName: string
  unitNumber: string
  monthlyRent: number
  status: 'vacant' | 'occupied' | 'inactive'
  tenantId: string | null
  tenantName: string | null
  tenantPhone: string | null
  paymentReference: string | null
  createdAt: Date
}

export type UnitStats = {
  totalPaid: number
  outstanding: number
  lastPaymentDate: Date | null
  lastPaymentAmount: number | null
  openTickets: number
}
