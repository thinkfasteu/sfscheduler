// Shared types for Staff Portal and Scheduler

// Base types from existing scheduler
export interface Staff {
  id: number
  name: string
  email?: string
  role: 'minijob' | 'werkstudent' | 'manager' | 'admin' | 'permanent'
  contractHours?: number
  typicalWorkdays?: number
  weekendPreference?: boolean
  version: number
  createdAt?: string
  updatedAt?: string
}

export interface ShiftKey {
  key: string
  name: string
  startTime: string
  endTime: string
  duration: number // hours
}

export type AvailabilityStatus = 'yes' | 'prefer' | 'no'

export interface Availability {
  id: number
  staffId: number
  date: string // YYYY-MM-DD
  shiftKey: string
  status: AvailabilityStatus
  version: number
  createdAt: string
  updatedAt: string
}

// New Staff Portal types

export interface AvailabilitySubmission {
  id: string
  staffId: number
  month: string // YYYY-MM-01
  entries: Record<string, Record<string, AvailabilityStatus>> // {"2025-09-01": {"morning": "yes"}}
  submittedAt?: string
  lockedAt?: string
  status: 'draft' | 'submitted' | 'locked'
  createdAt: string
  updatedAt: string
  createdBy?: number
}

export type SwapRequestStatus = 'open' | 'accepted' | 'withdrawn' | 'manager_review' | 'rejected'

export interface SwapRequest {
  id: string
  createdBy: number
  month: string // YYYY-MM
  date: string // YYYY-MM-DD
  shiftKey: string
  targetStaffId?: number
  status: SwapRequestStatus
  acceptedBy?: number
  messages: SwapMessage[]
  createdAt: string
  updatedAt: string
}

export interface SwapMessage {
  timestamp: string
  from: number
  message: string
}

export type SickReportStatus = 'reported' | 'approved' | 'rejected'

export interface SickReport {
  id: string
  staffId: number
  dateFrom: string
  dateTo: string
  note?: string
  requiresCertificate: boolean
  certificateSubmitted: boolean
  status: SickReportStatus
  approvedBy?: number
  approvedAt?: string
  createdAt: string
  updatedAt: string
  createdBy?: number
}

export type VacationRequestStatus = 'pending' | 'approved' | 'rejected' | 'cancelled'

export interface VacationRequest {
  id: string
  staffId: number
  dateFrom: string
  dateTo: string
  reason?: string
  daysRequested: number
  status: VacationRequestStatus
  approvedBy?: number
  approvedAt?: string
  rejectionReason?: string
  createdAt: string
  updatedAt: string
  createdBy?: number
}

export type HoursStatementSource = 'schedule' | 'self_report' | 'mixed'
export type HoursStatementStatus = 'draft' | 'generated' | 'exported'

export interface HoursStatement {
  id: string
  staffId: number
  month: string // YYYY-MM-01
  generatedAt: string
  source: HoursStatementSource
  totals: HoursTotals
  breakdown: Record<string, DayBreakdown> // {"2025-09-01": {...}}
  status: HoursStatementStatus
  createdAt: string
  updatedAt: string
  createdBy?: number
}

export interface HoursTotals {
  regularHours: number
  overtimeHours: number
  sickDays: number
  vacationDays: number
  totalWorkingDays: number
}

export interface DayBreakdown {
  date: string
  shifts: ShiftBreakdown[]
  totalHours: number
  type: 'work' | 'sick' | 'vacation' | 'holiday'
}

export interface ShiftBreakdown {
  shiftKey: string
  startTime: string
  endTime: string
  hours: number
  isOvertime: boolean
}

// API Response types
export interface ApiResponse<T> {
  data: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasMore: boolean
}

// Form types for UI
export interface AvailabilityFormData {
  month: string
  entries: Record<string, Record<string, AvailabilityStatus>>
}

export interface SwapRequestFormData {
  date: string
  shiftKey: string
  targetStaffId?: number
  message?: string
}

export interface SickReportFormData {
  dateFrom: string
  dateTo: string
  note?: string
  requiresCertificate: boolean
}

export interface VacationRequestFormData {
  dateFrom: string
  dateTo: string
  reason?: string
}

// Availability reminder tracking
export type ReminderType = 'month_start' | 'week_two' | 'final'

export interface AvailabilityReminder {
  id: string
  staffId: number
  month: string // YYYY-MM-01
  reminderType: ReminderType
  sentAt: string
  emailAddress: string
  successful: boolean
  errorMessage?: string
  createdAt: string
  updatedAt: string
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P]
}

export type WithTimestamps<T> = T & {
  createdAt: string
  updatedAt: string
}