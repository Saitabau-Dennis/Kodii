export type TicketCategory = 'water' | 'electricity' | 'plumbing' | 'security' | 'other'

export type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed'

export type TicketWithDetails = {
  id: string
  shortId: string
  propertyId: string
  propertyName: string
  unitId: string
  unitNumber: string
  tenantId: string | null
  tenantName: string | null
  tenantPhone: string | null
  category: TicketCategory
  description: string
  status: TicketStatus
  assignedTo: string | null
  assignedToName: string | null
  createdViasSMS: boolean
  createdAt: Date
  updatedAt: Date
  resolvedAt: Date | null
}

export type TicketComment = {
  id: string
  ticketId: string
  authorId: string
  authorName: string
  authorRole: string
  message: string
  createdAt: Date
}
