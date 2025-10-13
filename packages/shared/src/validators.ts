import { z } from 'zod'
import type { 
  AvailabilityStatus, 
  SwapRequestStatus, 
  SickReportStatus, 
  VacationRequestStatus 
} from './types'

// Base validation schemas
export const staffRoleSchema = z.enum(['minijob', 'werkstudent', 'manager', 'admin'])
export const availabilityStatusSchema = z.enum(['yes', 'prefer', 'no'])
export const swapRequestStatusSchema = z.enum(['open', 'accepted', 'withdrawn', 'manager_review', 'rejected'])
export const sickReportStatusSchema = z.enum(['reported', 'approved', 'rejected'])
export const vacationRequestStatusSchema = z.enum(['pending', 'approved', 'rejected', 'cancelled'])

// Date validation helpers
const dateStringSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
const monthStringSchema = z.string().regex(/^\d{4}-\d{2}-01$/, 'Invalid month format (YYYY-MM-01)')
const yearMonthSchema = z.string().regex(/^\d{4}-\d{2}$/, 'Invalid year-month format (YYYY-MM)')

// Staff validation
export const staffSchema = z.object({
  id: z.number().positive(),
  name: z.string().min(1, 'Name is required').max(100),
  role: staffRoleSchema,
  contractHours: z.number().positive().optional(),
  typicalWorkdays: z.number().min(1).max(7).optional(),
  weekendPreference: z.boolean().optional(),
  permanentPreferredShift: z.enum(['none', 'early', 'midday']).optional(),
  version: z.number().positive(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
})

export const createStaffSchema = staffSchema.omit({ id: true, version: true, createdAt: true, updatedAt: true })

// Availability Submission validation
export const availabilitySubmissionSchema = z.object({
  id: z.string().uuid(),
  staffId: z.number().positive(),
  month: monthStringSchema,
  entries: z.record(
    dateStringSchema,
    z.record(z.string(), availabilityStatusSchema)
  ),
  submittedAt: z.string().optional(),
  lockedAt: z.string().optional(),
  status: z.enum(['draft', 'submitted', 'locked']),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.number().positive().optional(),
})

export const createAvailabilitySubmissionSchema = z.object({
  month: monthStringSchema,
  entries: z.record(
    dateStringSchema,
    z.record(z.string(), availabilityStatusSchema)
  ),
})

export const updateAvailabilitySubmissionSchema = createAvailabilitySubmissionSchema.partial()

// Swap Request validation
export const swapMessageSchema = z.object({
  timestamp: z.string(),
  from: z.number().positive(),
  message: z.string().min(1).max(500),
})

export const swapRequestSchema = z.object({
  id: z.string().uuid(),
  createdBy: z.number().positive(),
  month: yearMonthSchema,
  date: dateStringSchema,
  shiftKey: z.string().min(1),
  targetStaffId: z.number().positive().optional(),
  status: swapRequestStatusSchema,
  acceptedBy: z.number().positive().optional(),
  messages: z.array(swapMessageSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const createSwapRequestSchema = z.object({
  date: dateStringSchema,
  shiftKey: z.string().min(1),
  targetStaffId: z.number().positive().optional(),
  message: z.string().max(500).optional(),
})

export const updateSwapRequestSchema = z.object({
  status: swapRequestStatusSchema.optional(),
  message: z.string().max(500).optional(),
})

// Sick Report validation
export const sickReportSchema = z.object({
  id: z.string().uuid(),
  staffId: z.number().positive(),
  dateFrom: dateStringSchema,
  dateTo: dateStringSchema,
  note: z.string().max(1000).optional(),
  requiresCertificate: z.boolean(),
  certificateSubmitted: z.boolean(),
  status: sickReportStatusSchema,
  approvedBy: z.number().positive().optional(),
  approvedAt: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.number().positive().optional(),
}).refine((data) => {
  return new Date(data.dateTo) >= new Date(data.dateFrom)
}, {
  message: 'End date must be after or equal to start date',
  path: ['dateTo'],
})

export const createSickReportSchema = z.object({
  dateFrom: dateStringSchema,
  dateTo: dateStringSchema,
  note: z.string().max(1000).optional(),
  requiresCertificate: z.boolean().default(false),
}).refine((data) => {
  return new Date(data.dateTo) >= new Date(data.dateFrom)
}, {
  message: 'End date must be after or equal to start date',
  path: ['dateTo'],
})

// Vacation Request validation
export const vacationRequestSchema = z.object({
  id: z.string().uuid(),
  staffId: z.number().positive(),
  dateFrom: dateStringSchema,
  dateTo: dateStringSchema,
  reason: z.string().max(500).optional(),
  daysRequested: z.number().positive(),
  status: vacationRequestStatusSchema,
  approvedBy: z.number().positive().optional(),
  approvedAt: z.string().optional(),
  rejectionReason: z.string().max(500).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.number().positive().optional(),
}).refine((data) => {
  return new Date(data.dateTo) >= new Date(data.dateFrom)
}, {
  message: 'End date must be after or equal to start date',
  path: ['dateTo'],
})

export const createVacationRequestSchema = z.object({
  dateFrom: dateStringSchema,
  dateTo: dateStringSchema,
  reason: z.string().max(500).optional(),
}).refine((data) => {
  return new Date(data.dateTo) >= new Date(data.dateFrom)
}, {
  message: 'End date must be after or equal to start date',
  path: ['dateTo'],
})

// Hours Statement validation
export const hoursTotalsSchema = z.object({
  regularHours: z.number().min(0),
  overtimeHours: z.number().min(0),
  sickDays: z.number().min(0),
  vacationDays: z.number().min(0),
  totalWorkingDays: z.number().min(0),
})

export const shiftBreakdownSchema = z.object({
  shiftKey: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  hours: z.number().min(0),
  isOvertime: z.boolean(),
})

export const dayBreakdownSchema = z.object({
  date: dateStringSchema,
  shifts: z.array(shiftBreakdownSchema),
  totalHours: z.number().min(0),
  type: z.enum(['work', 'sick', 'vacation', 'holiday']),
})

export const hoursStatementSchema = z.object({
  id: z.string().uuid(),
  staffId: z.number().positive(),
  month: monthStringSchema,
  generatedAt: z.string(),
  source: z.enum(['schedule', 'self_report', 'mixed']),
  totals: hoursTotalsSchema,
  breakdown: z.record(dateStringSchema, dayBreakdownSchema),
  status: z.enum(['draft', 'generated', 'exported']),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.number().positive().optional(),
})

// Authentication validation
export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirmPassword: z.string(),
  name: z.string().min(1, 'Name is required').max(100),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

// Utility validation functions
export function validateDateRange(from: string, to: string): boolean {
  return new Date(to) >= new Date(from)
}

export function validateMonthFormat(month: string): boolean {
  return /^\d{4}-\d{2}-01$/.test(month)
}

export function validateDateFormat(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date)
}

// Type guards
export function isValidAvailabilityStatus(status: string): status is AvailabilityStatus {
  return ['yes', 'prefer', 'no'].includes(status)
}

export function isValidSwapRequestStatus(status: string): status is SwapRequestStatus {
  return ['open', 'accepted', 'withdrawn', 'manager_review', 'rejected'].includes(status)
}

export function isValidSickReportStatus(status: string): status is SickReportStatus {
  return ['reported', 'approved', 'rejected'].includes(status)
}

export function isValidVacationRequestStatus(status: string): status is VacationRequestStatus {
  return ['pending', 'approved', 'rejected', 'cancelled'].includes(status)
}