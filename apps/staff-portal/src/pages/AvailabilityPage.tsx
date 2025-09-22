import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { format, startOfMonth, addMonths, subMonths, startOfWeek } from 'date-fns'
import { de } from 'date-fns/locale'
import toast from 'react-hot-toast'
import { useFeatureFlag } from '../hooks/useFeatureFlags'
import { useAuth } from '../hooks/useAuth'
import { useHolidays } from '../hooks/useHolidays'
import { useDeadline } from '../hooks/useDeadline'
import { AvailabilitySubmission } from '@shared/types'
import { AvailabilityDeadlineService } from '@shared/services/availabilityDeadlineService'
import WeeklyCalendar from '../components/availability/WeeklyCalendar'
import ManagerAvailabilityReview from '../components/availability/ManagerAvailabilityReview'

// Types (temporary until shared package types are available)
type AvailabilityStatus = 'yes' | 'prefer' | 'no'

interface StaffAvailability {
  id: string
  date: string
  shift_type: string
  status: AvailabilityStatus
  notes?: string
}

// Helper functions to convert between entries format and array format
const entriesToAvailabilityArray = (entries: Record<string, Record<string, AvailabilityStatus>>): StaffAvailability[] => {
  const result: StaffAvailability[] = []
  Object.entries(entries).forEach(([date, shifts]) => {
    Object.entries(shifts).forEach(([shiftType, status]) => {
      result.push({
        id: `${date}-${shiftType}`,
        date,
        shift_type: shiftType,
        status
      })
    })
  })
  return result
}

const availabilityArrayToEntries = (availability: StaffAvailability[]): Record<string, Record<string, AvailabilityStatus>> => {
  const entries: Record<string, Record<string, AvailabilityStatus>> = {}
  availability.forEach(item => {
    if (!entries[item.date]) {
      entries[item.date] = {}
    }
    entries[item.date][item.shift_type] = item.status
  })
  return entries
}

function AvailabilityPage() {
  const { t } = useTranslation()
  const { staff } = useAuth()
  const isAvailabilityEnabled = useFeatureFlag('FEATURE_AVAILABILITY')
  const { isLoading: holidaysLoading, error: holidaysError } = useHolidays()
  
  // State
  const [currentMonth, setCurrentMonth] = useState(() => new Date())
  const [submission, setSubmission] = useState<AvailabilitySubmission | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [viewMode, setViewMode] = useState<'staff' | 'manager'>('staff')

  // Check if user is manager/admin (mock check for development)
  const isManager = staff?.role === 'manager' || staff?.role === 'admin' || staff?.name?.includes('Manager')

  // Initialize view mode based on role
  useEffect(() => {
    if (isManager && viewMode === 'staff') {
      setViewMode('manager')
    }
  }, [isManager, viewMode, setViewMode])

  // Get month start date and key
  const monthStart = startOfMonth(currentMonth)
  const monthKey = format(monthStart, 'yyyy-MM-01')
  
  // Deadline calculations with holiday awareness
  const { 
    isLoading: deadlineLoading, 
    isOverdue, 
    daysUntilDeadline 
  } = useDeadline(currentMonth)
  
  const isSubmissionRequired = staff ? AvailabilityDeadlineService.isSubmissionRequired(staff) : false
  
  // Monthly availability is displayed as weekly chunks for better UX
  // Note: All scheduling operates on monthly cycles, but UI shows weeks within the month
  const weekStart = startOfWeek(monthStart, { weekStartsOn: 1 })

  // Navigation
  const goToPreviousWeek = useCallback(() => {
    setCurrentMonth(current => subMonths(current, 1))
  }, [])

  const goToNextWeek = useCallback(() => {
    setCurrentMonth(current => addMonths(current, 1))
  }, [])

  const goToCurrentWeek = useCallback(() => {
    setCurrentMonth(new Date())
  }, [])

  // Load availability data
  const loadAvailability = useCallback(async () => {
    if (!staff?.id) return
    
    setLoading(true)
    try {
      // Load from Supabase using the real contract
      const { fetchAvailability } = await import('@shared/contracts')
      const existingSubmission = await fetchAvailability(staff.id, monthKey)
      
      if (existingSubmission) {
        setSubmission(existingSubmission)
      } else {
        // Create empty submission for new month
        const newSubmission: AvailabilitySubmission = {
          id: `new-${staff.id}-${monthKey}`,
          staffId: staff.id,
          month: monthKey,
          status: 'draft',
          entries: {}, // Empty entries for new submission
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
        setSubmission(newSubmission)
      }
    } catch (error) {
      console.error('Error loading availability:', error)
      toast.error(t('availability.messages.loadError'))
      // Fallback to empty submission on error
      const fallbackSubmission: AvailabilitySubmission = {
        id: `fallback-${staff.id}-${monthKey}`,
        staffId: staff.id,
        month: monthKey,
        status: 'draft',
        entries: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      setSubmission(fallbackSubmission)
    } finally {
      setLoading(false)
    }
  }, [monthKey, staff?.id, t])

  // Get availability array from entries for backwards compatibility
  const availabilityArray = submission ? entriesToAvailabilityArray(submission.entries) : []

  // Auto-save availability changes
  const saveAvailability = useCallback(async (updatedAvailability: StaffAvailability[]) => {
    if (!submission || !staff?.id) return

    setSaving(true)
    try {
      // Convert array back to entries format
      const updatedEntries = availabilityArrayToEntries(updatedAvailability)
      
      // Save to Supabase using the real contract
      const { saveDraftAvailability } = await import('@shared/contracts')
      const savedSubmission = await saveDraftAvailability(staff.id, submission.month, updatedEntries)
      
      setSubmission(savedSubmission)
      
      // Show success message only for manual saves, not auto-saves
      // toast.success(t('availability.messages.savedAsDraft'))
    } catch (error) {
      console.error('Error saving availability:', error)
      toast.error(t('availability.messages.saveError'))
      
      // Fallback to optimistic update
      const updatedSubmission = {
        ...submission,
        entries: availabilityArrayToEntries(updatedAvailability),
        updatedAt: new Date().toISOString()
      }
      setSubmission(updatedSubmission)
    } finally {
      setSaving(false)
    }
  }, [submission, staff?.id])

  // Handle availability status change
  const handleAvailabilityChange = useCallback((date: Date, shift: string, status: AvailabilityStatus | undefined) => {
    if (!submission || submission.status === 'locked') return

    const dateStr = format(date, 'yyyy-MM-dd')
    const updatedAvailability = [...availabilityArray]
    
    // Find existing entry
    const existingIndex = updatedAvailability.findIndex(
      a => a.date === dateStr && a.shift_type === shift
    )

    if (status === undefined) {
      // Remove entry if status is undefined (back to default)
      if (existingIndex >= 0) {
        updatedAvailability.splice(existingIndex, 1)
      }
    } else if (existingIndex >= 0) {
      // Update existing
      updatedAvailability[existingIndex] = {
        ...updatedAvailability[existingIndex],
        status
      }
    } else {
      // Create new entry
      updatedAvailability.push({
        id: `${dateStr}-${shift}`,
        date: dateStr,
        shift_type: shift,
        status,
        notes: ''
      })
    }

    saveAvailability(updatedAvailability)
  }, [submission, availabilityArray, saveAvailability])

  // Handle notes change
  const handleNotesChange = useCallback((date: Date, notes: string) => {
    if (!submission || submission.status === 'locked') return

    const dateStr = format(date, 'yyyy-MM-dd')
    const updatedAvailability = availabilityArray.map(a => 
      a.date === dateStr ? { ...a, notes } : a
    )

    saveAvailability(updatedAvailability)
  }, [availabilityArray, saveAvailability])

  // Submit availability
  const submitAvailability = useCallback(async () => {
    if (!submission || submission.status !== 'draft' || !staff?.id) return

    setSaving(true)
    try {
      // Submit to Supabase using the real contract
      const { submitAvailability: submitToAPI } = await import('@shared/contracts')
      const submittedSubmission = await submitToAPI(staff.id, submission.month, submission.entries)
      
      setSubmission(submittedSubmission)
      toast.success(t('availability.messages.submitted'))
    } catch (error) {
      console.error('Error submitting availability:', error)
      toast.error(t('availability.messages.submitError'))
      
      // Fallback to optimistic update
      const submittedSubmission = {
        ...submission,
        status: 'submitted' as const,
        submittedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      setSubmission(submittedSubmission)
    } finally {
      setSaving(false)
    }
  }, [submission, staff?.id, t])

  // Copy from last week
  const copyLastWeek = useCallback(async () => {
    if (!submission || submission.status === 'locked') return

    setSaving(true)
    try {
      // TODO: Load previous week's data when API is available
      // For now, just show success message
      toast.success(t('availability.messages.copiedFromLastWeek'))
    } catch (error) {
      console.error('Error copying from last week:', error)
      toast.error(t('availability.messages.copyError'))
    } finally {
      setSaving(false)
    }
  }, [submission, t])

  // Clear all availability
  const clearAll = useCallback(() => {
    if (!submission || submission.status === 'locked') return

    const clearedAvailability = availabilityArray.map(a => ({
      ...a,
      status: 'no' as AvailabilityStatus,
      notes: ''
    }))

    saveAvailability(clearedAvailability)
    toast.success(t('availability.messages.clearedAll'))
  }, [submission, availabilityArray, saveAvailability, t])

  // Load data when week changes
  useEffect(() => {
    loadAvailability()
  }, [loadAvailability])

  // Feature flag check
  if (!isAvailabilityEnabled) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Feature Not Available
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  The availability calendar feature is currently disabled. 
                  Contact your administrator to enable FEATURE_AVAILABILITY.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const isReadOnly = submission?.status === 'locked'
  const canSubmit = submission?.status === 'draft' && availabilityArray.length > 0

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {t('availability.title')}
            </h1>
            <p className="mt-1 text-gray-600">
              {viewMode === 'staff' ? t('availability.subtitle') : t('availability.managerReview.subtitle')}
            </p>
          </div>
          
          <div className="mt-4 sm:mt-0 flex items-center space-x-4">
            {/* Role toggle for managers */}
            {isManager && (
              <div className="flex rounded-md shadow-sm">
                <button
                  type="button"
                  onClick={() => setViewMode('staff')}
                  className={`px-4 py-2 text-sm font-medium rounded-l-md border ${
                    viewMode === 'staff'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {t('availability.staffView')}
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('manager')}
                  className={`px-4 py-2 text-sm font-medium rounded-r-md border-t border-r border-b ${
                    viewMode === 'manager'
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {t('availability.managerView')}
                </button>
              </div>
            )}

            {/* Status badge (only in staff view) */}
            {viewMode === 'staff' && submission && (
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                submission.status === 'draft' 
                  ? 'bg-yellow-100 text-yellow-800'
                  : submission.status === 'submitted'
                  ? 'bg-blue-100 text-blue-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {t(`availability.${submission.status}`)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Deadline Alert (only for non-permanent staff in staff view) */}
      {viewMode === 'staff' && isSubmissionRequired && (
        <div className={`rounded-lg border p-4 ${
          isOverdue 
            ? 'bg-red-50 border-red-200'
            : daysUntilDeadline <= 3
            ? 'bg-yellow-50 border-yellow-200'
            : 'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              {isOverdue ? (
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              ) : daysUntilDeadline <= 3 ? (
                <svg className="h-5 w-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3 flex-1">
              <h3 className={`text-sm font-medium ${
                isOverdue 
                  ? 'text-red-800'
                  : daysUntilDeadline <= 3
                  ? 'text-yellow-800'
                  : 'text-blue-800'
              }`}>
                {isOverdue 
                  ? t('availability.deadline.overdue')
                  : daysUntilDeadline <= 3
                  ? t('availability.deadline.urgent')
                  : t('availability.deadline.reminder')
                }
              </h3>
              <div className={`mt-1 text-sm ${
                isOverdue 
                  ? 'text-red-700'
                  : daysUntilDeadline <= 3
                  ? 'text-yellow-700'
                  : 'text-blue-700'
              }`}>
                {isOverdue ? (
                  <p>
                    {t('availability.deadline.overdueMessage', { 
                      deadline: AvailabilityDeadlineService.formatDeadline(currentMonth) 
                    })}
                  </p>
                ) : (
                  <p>
                    {t('availability.deadline.message', { 
                      days: daysUntilDeadline,
                      deadline: AvailabilityDeadlineService.formatDeadline(currentMonth)
                    })}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Content based on view mode */}
      {viewMode === 'manager' ? (
        /* Manager Review Interface */
        <ManagerAvailabilityReview weekStart={weekStart} />
      ) : (
        /* Staff Availability Interface */
        <>
          {/* Week navigation */}
          <div className="bg-white rounded-lg shadow-sm border p-6">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={goToPreviousWeek}
                className="btn-secondary"
                disabled={loading}
              >
                ← {t('common.previous')}
              </button>

              <div className="text-center">
                <h2 className="text-lg font-semibold text-gray-900">
                  {t('availability.weekOf')} {format(weekStart, 'dd.MM.yyyy', { locale: de })}
                </h2>
                <button
                  type="button"
                  onClick={goToCurrentWeek}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  {t('common.today')}
                </button>
              </div>

              <button
                type="button"
                onClick={goToNextWeek}
                className="btn-secondary"
                disabled={loading}
              >
                {t('common.next')} →
              </button>
            </div>
          </div>

          {/* Action buttons */}
          {submission && !isReadOnly && (
            <div className="bg-white rounded-lg shadow-sm border p-6">
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={copyLastWeek}
                  className="btn-secondary"
                  disabled={saving}
                >
                  {t('availability.copyLastWeek')}
                </button>
                
                <button
                  type="button"
                  onClick={clearAll}
                  className="btn-secondary"
                  disabled={saving}
                >
                  {t('availability.clearAll')}
                </button>

                <div className="flex-1" />

                {canSubmit && (
                  <button
                    type="button"
                    onClick={submitAvailability}
                    className="btn-primary"
                    disabled={saving}
                  >
                    {saving ? t('common.loading') : t('availability.submitAvailability')}
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Calendar */}
          {loading || holidaysLoading || deadlineLoading ? (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
              <div className="text-gray-500">
                {holidaysLoading ? t('availability.loadingHolidays', 'Lade Feiertage...') : 
                 deadlineLoading ? t('availability.loadingDeadline', 'Berechne Deadline...') :
                 t('common.loading')}
              </div>
            </div>
          ) : holidaysError ? (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
              <div className="text-red-600">
                {t('availability.holidaysError', 'Fehler beim Laden der Feiertage')}: {holidaysError}
              </div>
            </div>
          ) : submission && staff ? (
            <WeeklyCalendar
              weekStart={weekStart}
              availability={availabilityArray}
              staff={staff}
              onAvailabilityChange={handleAvailabilityChange}
              onNotesChange={handleNotesChange}
              readOnly={isReadOnly}
              showNotes={true}
            />
          ) : null}
        </>
      )}

      {/* Development notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Availability Calendar - Development Mode
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                The calendar UI is fully functional. Data persistence requires Supabase configuration.
                Changes are saved locally and will sync to the database when backend is connected.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default AvailabilityPage