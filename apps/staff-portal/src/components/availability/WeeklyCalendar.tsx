import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { format, startOfWeek, addDays, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import { Staff } from '@shared/types'
import { useHolidays } from '../../hooks/useHolidays'

// Types aligned with existing scheduler
type AvailabilityStatus = 'yes' | 'prefer' | 'no'

interface StaffAvailability {
  id: string
  date: string
  shift_type: string
  status: AvailabilityStatus
  notes?: string
}

interface WeeklyCalendarProps {
  weekStart: Date
  availability: StaffAvailability[]
  staff: Staff // Add staff context for role-based logic
  onAvailabilityChange: (date: Date, shift: string, status: AvailabilityStatus | undefined) => void
  readOnly?: boolean
  showNotes?: boolean
  onNotesChange?: (date: Date, notes: string) => void
}

interface AvailabilityCell {
  date: Date
  shift: string
  status: AvailabilityStatus | undefined // undefined = default state
  notes?: string
  isVoluntary?: boolean // For evening/closing voluntary flag
  isHoliday?: boolean // Add holiday flag
  holidayName?: string // Holiday name for display
  dayType?: 'holiday' | 'weekend' | 'weekday' // Day type classification
}

const SHIFTS = ['morning', 'evening', 'night'] as const
const WEEKDAYS = 7

/**
 * WeeklyCalendar Component
 * 
 * Note: Despite the name "Weekly", this component displays a 7-day grid as part of 
 * monthly availability scheduling. The entire availability system operates on monthly
 * cycles, but the UI breaks down each month into weekly views for better usability.
 * 
 * This component shows one week (7 days) of availability slots for morning, evening, 
 * and night shifts, with holiday awareness and role-based availability defaults.
 */
function WeeklyCalendar({
  weekStart,
  availability,
  staff,
  onAvailabilityChange,
  readOnly = false,
  showNotes = false,
  onNotesChange
}: WeeklyCalendarProps) {
  const { t } = useTranslation()
  const [expandedNotes, setExpandedNotes] = useState<string | null>(null)
  const { isHoliday, getHolidayName, getDayType } = useHolidays()

  const isPermanent = staff.role === 'permanent'

  // Generate week dates
  const weekDates = Array.from({ length: WEEKDAYS }, (_, i) => 
    addDays(startOfWeek(weekStart, { weekStartsOn: 1 }), i)
  )

  // Get availability for a specific date and shift (role-aware)
  const getAvailability = useCallback((date: Date, shift: string): AvailabilityCell => {
    const dateStr = format(date, 'yyyy-MM-dd')
    const found = availability.find(a => 
      format(parseISO(a.date), 'yyyy-MM-dd') === dateStr && a.shift_type === shift
    )
    
    // Get holiday information
    const dayIsHoliday = isHoliday(dateStr)
    const holidayName = getHolidayName(dateStr)
    const dayType = getDayType(dateStr)
    
    // Handle role-based default states
    let status: AvailabilityStatus | undefined
    
    if (isPermanent) {
      // Permanent: available by default, can opt-out with 'no'
      status = found?.status || undefined // undefined = default available
    } else {
      // Non-permanent: not available by default, must opt-in with 'yes'/'prefer'
      status = found?.status === 'yes' || found?.status === 'prefer' ? found.status : undefined
    }
    
    return {
      date,
      shift,
      status,
      notes: found?.notes || '',
      isHoliday: dayIsHoliday,
      holidayName: holidayName || undefined,
      dayType
    }
  }, [availability, isPermanent, isHoliday, getHolidayName, getDayType])

  // Handle status change (role-aware)
  const handleStatusChange = useCallback((date: Date, shift: string, status: AvailabilityStatus | undefined) => {
    if (!readOnly) {
      onAvailabilityChange(date, shift, status)
    }
  }, [readOnly, onAvailabilityChange])

  // Toggle notes expansion
  const toggleNotes = useCallback((date: Date, shift: string) => {
    const key = `${format(date, 'yyyy-MM-dd')}-${shift}`
    setExpandedNotes(current => current === key ? null : key)
  }, [])

  // Status button styles
  const getStatusStyles = (status: AvailabilityStatus, current: AvailabilityStatus) => {
    const isSelected = status === current
    const baseClasses = 'px-2 py-1 text-xs font-medium rounded-full transition-colors'
    
    switch (status) {
      case 'yes':
        return `${baseClasses} ${isSelected 
          ? 'bg-green-100 text-green-800 border-2 border-green-300' 
          : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-green-50'
        }`
      case 'prefer':
        return `${baseClasses} ${isSelected 
          ? 'bg-blue-100 text-blue-800 border-2 border-blue-300' 
          : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-blue-50'
        }`
      case 'no':
        return `${baseClasses} ${isSelected 
          ? 'bg-red-100 text-red-800 border-2 border-red-300' 
          : 'bg-gray-100 text-gray-600 border border-gray-300 hover:bg-red-50'
        }`
      default:
        return baseClasses
    }
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border">
      {/* Header with dates */}
      <div className="grid grid-cols-8 gap-1 p-4 bg-gray-50 rounded-t-lg">
        <div className="text-xs font-medium text-gray-600 py-2">
          {t('availability.shifts.label')}
        </div>
        {weekDates.map(date => {
          const dateStr = format(date, 'yyyy-MM-dd')
          const dayIsHoliday = isHoliday(dateStr)
          const holidayName = getHolidayName(dateStr)
          const dayType = getDayType(dateStr)
          
          return (
            <div key={date.toISOString()} className="text-center">
              <div className={`text-xs font-medium ${
                dayIsHoliday ? 'text-orange-700' : 
                dayType === 'weekend' ? 'text-blue-700' : 
                'text-gray-900'
              }`}>
                {format(date, 'EEEEEE', { locale: de })}
              </div>
              <div className={`text-xs ${
                dayIsHoliday ? 'text-orange-600' : 
                dayType === 'weekend' ? 'text-blue-600' : 
                'text-gray-600'
              }`}>
                {format(date, 'dd.MM')}
              </div>
              {dayIsHoliday && holidayName && (
                <div className="text-xs text-orange-600 mt-1 leading-tight" title={holidayName}>
                  <span className="bg-orange-100 px-1 py-0.5 rounded text-orange-800">
                    {holidayName.length > 8 ? `${holidayName.substring(0, 8)}...` : holidayName}
                  </span>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Shifts grid */}
      <div className="divide-y divide-gray-100">
        {SHIFTS.map(shift => (
          <div key={shift} className="grid grid-cols-8 gap-1 p-4">
            {/* Shift label */}
            <div className="flex items-center text-sm font-medium text-gray-900 py-2">
              {t(`availability.shifts.${shift}`)}
            </div>

            {/* Daily availability cells */}
            {weekDates.map(date => {
              const cell = getAvailability(date, shift)
              const notesKey = `${format(date, 'yyyy-MM-dd')}-${shift}`
              const isNotesExpanded = expandedNotes === notesKey

              return (
                <div key={`${date.toISOString()}-${shift}`} className="space-y-2">
                  {/* Holiday indicator */}
                  {cell.isHoliday && (
                    <div className="text-xs text-orange-700 font-medium mb-1">
                      <span className="bg-orange-100 px-1 py-0.5 rounded border border-orange-200">
                        Feiertag
                      </span>
                    </div>
                  )}

                  {/* Status buttons */}
                  <div className="flex flex-col space-y-1">
                    {(['yes', 'prefer', 'no'] as const).map(status => (
                      <button
                        key={status}
                        type="button"
                        disabled={readOnly}
                        onClick={() => handleStatusChange(date, shift, status)}
                        className={`${getStatusStyles(status, cell.status || 'no')} ${
                          cell.isHoliday ? 'opacity-75' : ''
                        }`}
                        title={`${t(`availability.availabilityStatus.${status}`)}${
                          cell.isHoliday && cell.holidayName ? ` (${cell.holidayName})` : ''
                        }`}
                      >
                        {t(`availability.availabilityStatus.${status}`)}
                      </button>
                    ))}
                  </div>

                  {/* Notes toggle */}
                  {showNotes && (
                    <button
                      type="button"
                      onClick={() => toggleNotes(date, shift)}
                      className="text-xs text-gray-500 hover:text-gray-700 flex items-center"
                      disabled={readOnly}
                    >
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 0v12h8V4H6z" clipRule="evenodd" />
                      </svg>
                      {cell.notes ? t('common.hasNotes') : t('common.addNote')}
                    </button>
                  )}

                  {/* Notes input */}
                  {showNotes && isNotesExpanded && (
                    <div className="mt-2">
                      <textarea
                        value={cell.notes}
                        onChange={(e) => onNotesChange?.(date, e.target.value)}
                        placeholder={t('availability.notePlaceholder')}
                        className="w-full text-xs border border-gray-300 rounded px-2 py-1 resize-none"
                        rows={2}
                        disabled={readOnly}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>
    </div>
  )
}

export default WeeklyCalendar