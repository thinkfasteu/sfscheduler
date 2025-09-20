// Utility functions shared between apps

import { format, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend } from 'date-fns'
import { de } from 'date-fns/locale'

// Date utilities
export function formatDate(date: Date | string, formatString: string = 'yyyy-MM-dd'): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, formatString, { locale: de })
}

export function formatDisplayDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, 'dd.MM.yyyy', { locale: de })
}

export function formatMonthYear(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  return format(dateObj, 'MMMM yyyy', { locale: de })
}

export function getMonthDays(monthString: string): Date[] {
  // monthString is in format YYYY-MM-01
  const startDate = startOfMonth(new Date(monthString))
  const endDate = endOfMonth(new Date(monthString))
  return eachDayOfInterval({ start: startDate, end: endDate })
}

export function getWorkingDays(monthString: string): Date[] {
  return getMonthDays(monthString).filter(date => !isWeekend(date))
}

export function calculateWorkingDays(fromDate: string, toDate: string): number {
  const start = new Date(fromDate)
  const end = new Date(toDate)
  const days = eachDayOfInterval({ start, end })
  return days.filter(date => !isWeekend(date)).length
}

// String utilities
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str
  return str.slice(0, maxLength - 3) + '...'
}

// Validation utilities
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export function isValidDate(dateString: string): boolean {
  const date = new Date(dateString)
  return !isNaN(date.getTime()) && dateString.match(/^\d{4}-\d{2}-\d{2}$/)
}

// Array utilities
export function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((groups, item) => {
    const key = keyFn(item)
    if (!groups[key]) {
      groups[key] = []
    }
    groups[key].push(item)
    return groups
  }, {} as Record<string, T[]>)
}

export function sortBy<T>(array: T[], keyFn: (item: T) => any): T[] {
  return [...array].sort((a, b) => {
    const aVal = keyFn(a)
    const bVal = keyFn(b)
    if (aVal < bVal) return -1
    if (aVal > bVal) return 1
    return 0
  })
}

// Time utilities
export function timeToMinutes(timeString: string): number {
  const [hours, minutes] = timeString.split(':').map(Number)
  return hours * 60 + minutes
}

export function minutesToTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const mins = minutes % 60
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
}

export function calculateShiftDuration(startTime: string, endTime: string): number {
  const startMinutes = timeToMinutes(startTime)
  const endMinutes = timeToMinutes(endTime)
  
  // Handle overnight shifts
  if (endMinutes < startMinutes) {
    return (24 * 60) - startMinutes + endMinutes
  }
  
  return endMinutes - startMinutes
}

// Error handling utilities
export class AppError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export function handleApiError(error: any): AppError {
  if (error instanceof AppError) {
    return error
  }
  
  if (error?.message) {
    return new AppError(error.message, error.code, error.statusCode)
  }
  
  return new AppError('An unexpected error occurred', 'UNKNOWN_ERROR')
}

// Storage utilities
export function getStorageItem(key: string): string | null {
  if (typeof window === 'undefined') return null
  
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

export function setStorageItem(key: string, value: string): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.setItem(key, value)
  } catch {
    // Ignore storage errors
  }
}

export function removeStorageItem(key: string): void {
  if (typeof window === 'undefined') return
  
  try {
    localStorage.removeItem(key)
  } catch {
    // Ignore storage errors
  }
}

// Form utilities
export function serializeFormData(formData: FormData): Record<string, any> {
  const data: Record<string, any> = {}
  
  for (const [key, value] of formData.entries()) {
    if (data[key]) {
      // Convert to array if multiple values
      if (Array.isArray(data[key])) {
        data[key].push(value)
      } else {
        data[key] = [data[key], value]
      }
    } else {
      data[key] = value
    }
  }
  
  return data
}

// Shift utilities (specific to scheduler domain)
export const DEFAULT_SHIFTS = {
  morning: { 
    key: 'morning', 
    name: 'Früh', 
    startTime: '06:00', 
    endTime: '14:00', 
    duration: 8 
  },
  evening: { 
    key: 'evening', 
    name: 'Spät', 
    startTime: '14:00', 
    endTime: '22:00', 
    duration: 8 
  },
  night: { 
    key: 'night', 
    name: 'Nacht', 
    startTime: '22:00', 
    endTime: '06:00', 
    duration: 8 
  },
}

export function getShiftInfo(shiftKey: string) {
  return DEFAULT_SHIFTS[shiftKey as keyof typeof DEFAULT_SHIFTS] || null
}

export function getAllShifts() {
  return Object.values(DEFAULT_SHIFTS)
}

// Color utilities
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    // Common statuses
    draft: 'text-gray-600 bg-gray-100',
    pending: 'text-yellow-600 bg-yellow-100',
    submitted: 'text-blue-600 bg-blue-100',
    approved: 'text-green-600 bg-green-100',
    rejected: 'text-red-600 bg-red-100',
    cancelled: 'text-gray-600 bg-gray-100',
    locked: 'text-purple-600 bg-purple-100',
    
    // Swap request statuses
    open: 'text-blue-600 bg-blue-100',
    accepted: 'text-green-600 bg-green-100',
    withdrawn: 'text-gray-600 bg-gray-100',
    manager_review: 'text-yellow-600 bg-yellow-100',
    
    // Availability statuses
    yes: 'text-green-600 bg-green-100',
    prefer: 'text-yellow-600 bg-yellow-100',
    no: 'text-red-600 bg-red-100',
  }
  
  return colors[status] || 'text-gray-600 bg-gray-100'
}

// Constants
export const ROLES = {
  MINIJOB: 'minijob',
  WERKSTUDENT: 'werkstudent', 
  MANAGER: 'manager',
  ADMIN: 'admin',
} as const

export const AVAILABILITY_STATUSES = {
  YES: 'yes',
  PREFER: 'prefer', 
  NO: 'no',
} as const

export const SWAP_REQUEST_STATUSES = {
  OPEN: 'open',
  ACCEPTED: 'accepted',
  WITHDRAWN: 'withdrawn',
  MANAGER_REVIEW: 'manager_review',
  REJECTED: 'rejected',
} as const