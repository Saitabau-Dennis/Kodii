export type FinancialSummary = {
  expectedRent: number
  confirmedRent: number
  outstanding: number
  collectionRate: number
}

export type RentByProperty = {
  propertyId: string
  propertyName: string
  unitCount: number
  expectedRent: number
  confirmedRent: number
  outstanding: number
  collectionRate: number
  overdueCount: number
}

export type OccupancySummary = {
  totalUnits: number
  occupiedUnits: number
  vacantUnits: number
  inactiveUnits: number
}

export type OccupancyByProperty = {
  propertyId: string
  propertyName: string
  totalUnits: number
  occupiedUnits: number
  vacantUnits: number
  inactiveUnits: number
  occupancyRate: number
}

export type OverdueTenant = {
  tenantId: string
  tenantName: string
  tenantPhone: string
  unitNumber: string
  propertyName: string
  amountOverdue: number
  daysOverdue: number
  lastPaymentDate: Date | null
}

export type PendingPaymentReportItem = {
  id: string
  tenantName: string
  unitNumber: string
  amount: number
  mpesaCode: string | null
  submittedAt: Date | null
}

export type PendingPaymentsResult = {
  rows: PendingPaymentReportItem[]
  totalCount: number
}

export type MaintenanceSummary = {
  openCount: number
  inProgressCount: number
  resolvedCount: number
}

export type MaintenanceByProperty = {
  propertyId: string
  propertyName: string
  openCount: number
  inProgressCount: number
  resolvedCount: number
  closedCount: number
  total: number
}
