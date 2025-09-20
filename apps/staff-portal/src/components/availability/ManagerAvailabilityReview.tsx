import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { de } from 'date-fns/locale'
import toast from 'react-hot-toast'

// Types (temporary until shared package types are available)
type AvailabilityStatus = 'yes' | 'prefer' | 'no'
type SubmissionStatus = 'draft' | 'submitted' | 'locked'

interface StaffAvailability {
  id: string
  date: string
  shift_type: string
  status: AvailabilityStatus
  notes?: string
}

interface AvailabilitySubmission {
  id: string
  staff_id: string
  staff_name: string
  week_start: string
  status: SubmissionStatus
  submitted_at?: string
  locked_at?: string
  manager_notes?: string
  availability: StaffAvailability[]
  previous_availability?: StaffAvailability[] // For diff comparison
}

interface ManagerAvailabilityReviewProps {
  weekStart: Date
}

function ManagerAvailabilityReview({ weekStart }: ManagerAvailabilityReviewProps) {
  const { t } = useTranslation()
  const [submissions, setSubmissions] = useState<AvailabilitySubmission[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedSubmission, setSelectedSubmission] = useState<string | null>(null)
  const [managerNotes, setManagerNotes] = useState('')

  // Load submissions for the week
  const loadSubmissions = useCallback(async () => {
    setLoading(true)
    try {
      // TODO: Load from API when Supabase is configured
      // Mock data for development
      const mockSubmissions: AvailabilitySubmission[] = [
        {
          id: 'submission-1',
          staff_id: 'staff-1',
          staff_name: 'Max Mustermann',
          week_start: format(weekStart, 'yyyy-MM-dd'),
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          availability: [
            { id: '1', date: format(weekStart, 'yyyy-MM-dd'), shift_type: 'morning', status: 'yes' },
            { id: '2', date: format(weekStart, 'yyyy-MM-dd'), shift_type: 'evening', status: 'prefer' },
          ],
          previous_availability: [
            { id: '1p', date: format(weekStart, 'yyyy-MM-dd'), shift_type: 'morning', status: 'no' },
            { id: '2p', date: format(weekStart, 'yyyy-MM-dd'), shift_type: 'evening', status: 'yes' },
          ]
        },
        {
          id: 'submission-2',
          staff_id: 'staff-2',
          staff_name: 'Anna Schmidt',
          week_start: format(weekStart, 'yyyy-MM-dd'),
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          availability: [
            { id: '3', date: format(weekStart, 'yyyy-MM-dd'), shift_type: 'morning', status: 'prefer' },
            { id: '4', date: format(weekStart, 'yyyy-MM-dd'), shift_type: 'night', status: 'yes' },
          ]
        }
      ]
      setSubmissions(mockSubmissions)
    } catch (error) {
      console.error('Error loading submissions:', error)
      toast.error(t('availability.messages.loadError'))
    } finally {
      setLoading(false)
    }
  }, [weekStart, t])

  // Approve submission
  const approveSubmission = useCallback(async (submissionId: string) => {
    try {
      // TODO: API call when Supabase is configured
      const updatedSubmissions = submissions.map(sub =>
        sub.id === submissionId
          ? { ...sub, status: 'locked' as SubmissionStatus, locked_at: new Date().toISOString(), manager_notes: managerNotes }
          : sub
      )
      setSubmissions(updatedSubmissions)
      setSelectedSubmission(null)
      setManagerNotes('')
      toast.success(t('availability.messages.approved'))
    } catch (error) {
      console.error('Error approving submission:', error)
      toast.error(t('availability.messages.approveError'))
    }
  }, [submissions, managerNotes, t])

  // Deny submission (unlock for editing)
  const denySubmission = useCallback(async (submissionId: string) => {
    try {
      // TODO: API call when Supabase is configured
      const updatedSubmissions = submissions.map(sub =>
        sub.id === submissionId
          ? { ...sub, status: 'draft' as SubmissionStatus, manager_notes: managerNotes }
          : sub
      )
      setSubmissions(updatedSubmissions)
      setSelectedSubmission(null)
      setManagerNotes('')
      toast.success(t('availability.messages.denied'))
    } catch (error) {
      console.error('Error denying submission:', error)
      toast.error(t('availability.messages.denyError'))
    }
  }, [submissions, managerNotes, t])

  // Unlock submission (allow editing again)
  const unlockSubmission = useCallback(async (submissionId: string) => {
    try {
      // TODO: API call when Supabase is configured
      const updatedSubmissions = submissions.map(sub =>
        sub.id === submissionId
          ? { ...sub, status: 'draft' as SubmissionStatus, locked_at: undefined }
          : sub
      )
      setSubmissions(updatedSubmissions)
      toast.success(t('availability.messages.unlocked'))
    } catch (error) {
      console.error('Error unlocking submission:', error)
      toast.error(t('availability.messages.unlockError'))
    }
  }, [submissions, t])

  // Get diff between current and previous availability
  const getDiff = useCallback((submission: AvailabilitySubmission) => {
    if (!submission.previous_availability) return []

    const changes = []
    const currentMap = new Map(
      submission.availability.map(a => [`${a.date}-${a.shift_type}`, a])
    )
    const previousMap = new Map(
      submission.previous_availability.map(a => [`${a.date}-${a.shift_type}`, a])
    )

    // Check for changes
    for (const [key, current] of currentMap) {
      const previous = previousMap.get(key)
      if (!previous || previous.status !== current.status) {
        changes.push({
          date: current.date,
          shift: current.shift_type,
          from: previous?.status || 'no',
          to: current.status,
          type: previous ? 'changed' : 'added'
        })
      }
    }

    return changes
  }, [])

  // Status badge component
  const StatusBadge = ({ status }: { status: SubmissionStatus }) => {
    const styles = {
      draft: 'bg-yellow-100 text-yellow-800',
      submitted: 'bg-blue-100 text-blue-800',
      locked: 'bg-green-100 text-green-800'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${styles[status]}`}>
        {t(`availability.${status}`)}
      </span>
    )
  }

  // Change diff component  
  const ChangeDiff = ({ changes }: { changes: ReturnType<typeof getDiff> }) => {
    if (changes.length === 0) {
      return (
        <div className="text-sm text-gray-500 italic">
          {t('availability.noChanges')}
        </div>
      )
    }

    return (
      <div className="space-y-1">
        {changes.map((change, index) => (
          <div key={index} className="text-sm flex items-center space-x-2">
            <span className="font-medium">{format(parseISO(change.date), 'dd.MM', { locale: de })}</span>
            <span className="text-gray-500">{t(`availability.shifts.${change.shift}`)}</span>
            <span className="text-red-600">{t(`availability.availabilityStatus.${change.from}`)}</span>
            <span className="text-gray-400">→</span>
            <span className="text-green-600">{t(`availability.availabilityStatus.${change.to}`)}</span>
          </div>
        ))}
      </div>
    )
  }

  // Load data when week changes
  useEffect(() => {
    loadSubmissions()
  }, [loadSubmissions])

  const pendingSubmissions = submissions.filter(s => s.status === 'submitted')
  const lockedSubmissions = submissions.filter(s => s.status === 'locked')

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          {t('availability.managerReview.title')}
        </h2>
        <p className="text-gray-600">
          {t('availability.managerReview.subtitle')} {format(weekStart, 'dd.MM.yyyy', { locale: de })}
        </p>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
          <div className="text-gray-500">{t('common.loading')}</div>
        </div>
      ) : (
        <>
          {/* Pending submissions */}
          {pendingSubmissions.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  {t('availability.managerReview.pendingSubmissions')} ({pendingSubmissions.length})
                </h3>
              </div>
              <div className="divide-y divide-gray-200">
                {pendingSubmissions.map(submission => {
                  const changes = getDiff(submission)
                  const isExpanded = selectedSubmission === submission.id

                  return (
                    <div key={submission.id} className="p-6">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4">
                          <div>
                            <h4 className="text-base font-medium text-gray-900">
                              {submission.staff_name}
                            </h4>
                            <p className="text-sm text-gray-500">
                              {t('availability.submittedAt')}: {format(parseISO(submission.submitted_at!), 'dd.MM.yyyy HH:mm', { locale: de })}
                            </p>
                          </div>
                          <StatusBadge status={submission.status} />
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedSubmission(isExpanded ? null : submission.id)}
                          className="btn-secondary"
                        >
                          {isExpanded ? t('common.collapse') : t('common.review')}
                        </button>
                      </div>

                      {isExpanded && (
                        <div className="mt-6 space-y-4">
                          {/* Changes diff */}
                          <div>
                            <h5 className="text-sm font-medium text-gray-900 mb-2">
                              {t('availability.changesFromLastWeek')}
                            </h5>
                            <ChangeDiff changes={changes} />
                          </div>

                          {/* Manager notes */}
                          <div>
                            <label htmlFor="manager-notes" className="block text-sm font-medium text-gray-700 mb-1">
                              {t('availability.managerNotes')}
                            </label>
                            <textarea
                              id="manager-notes"
                              value={managerNotes}
                              onChange={(e) => setManagerNotes(e.target.value)}
                              placeholder={t('availability.managerNotesPlaceholder')}
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm resize-none"
                              rows={3}
                            />
                          </div>

                          {/* Action buttons */}
                          <div className="flex space-x-3">
                            <button
                              type="button"
                              onClick={() => approveSubmission(submission.id)}
                              className="btn-primary"
                            >
                              {t('availability.managerReview.approve')}
                            </button>
                            <button
                              type="button"
                              onClick={() => denySubmission(submission.id)}
                              className="btn-secondary"
                            >
                              {t('availability.managerReview.deny')}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Approved submissions */}
          {lockedSubmissions.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm border">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">
                  {t('availability.managerReview.approvedSubmissions')} ({lockedSubmissions.length})
                </h3>
              </div>
              <div className="divide-y divide-gray-200">
                {lockedSubmissions.map(submission => (
                  <div key={submission.id} className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div>
                          <h4 className="text-base font-medium text-gray-900">
                            {submission.staff_name}
                          </h4>
                          <p className="text-sm text-gray-500">
                            {t('availability.approvedAt')}: {format(parseISO(submission.locked_at!), 'dd.MM.yyyy HH:mm', { locale: de })}
                          </p>
                          {submission.manager_notes && (
                            <p className="text-sm text-gray-600 mt-1">
                              <strong>{t('availability.managerNotes')}:</strong> {submission.manager_notes}
                            </p>
                          )}
                        </div>
                        <StatusBadge status={submission.status} />
                      </div>
                      <button
                        type="button"
                        onClick={() => unlockSubmission(submission.id)}
                        className="btn-secondary text-sm"
                      >
                        {t('availability.managerReview.unlock')}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Empty state */}
          {submissions.length === 0 && (
            <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
              <div className="text-gray-500">
                {t('availability.managerReview.noSubmissions')}
              </div>
            </div>
          )}
        </>
      )}

      {/* Development notice */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex">
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-800">
              Manager Review - Development Mode
            </h3>
            <div className="mt-2 text-sm text-blue-700">
              <p>
                Manager interface is functional with mock data. Real submissions will appear when backend is connected.
                Approval/denial actions work locally and will sync to database when Supabase is configured.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default ManagerAvailabilityReview