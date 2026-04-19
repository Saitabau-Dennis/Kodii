export type PropertyWithStats = {
  id: string
  name: string
  location: string | null
  totalUnits: number
  caretakerName: string | null
  caretakerPhone: string | null
  notes: string | null
  createdAt: Date
  actualUnits: number
  occupiedUnits: number
  vacantUnits: number
  expectedRent: number
}

export type PropertyStats = {
  totalUnits: number
  actualUnits: number
  occupiedUnits: number
  vacantUnits: number
  expectedRent: number
  confirmedRent: number
  outstanding: number
  openTickets: number
}
