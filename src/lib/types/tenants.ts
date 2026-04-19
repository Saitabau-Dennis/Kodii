export type TenantWithDetails = {
  id: string
  fullName: string
  phoneNumber: string
  idNumber: string | null
  propertyId: string
  propertyName: string
  unitId: string | null
  unitNumber: string | null
  moveInDate: string
  moveOutDate: string | null
  rentDueDay: number
  securityDeposit: number
  creditBalance: number
  status: 'active' | 'inactive' | 'moved_out'
  outstanding: number
  createdAt: Date
}

export type TenantWithUnit = TenantWithDetails & {
  monthlyRent: number
}

export type TenantStats = {
  totalPaid: number
  outstanding: number
  totalInvoices: number
  securityDeposit: number
  creditBalance: number
  monthsPaidAhead: number
  remainingCredit: number
  monthsStayed: number
}
