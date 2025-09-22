import type { 
  AvailabilitySubmission, 
  SwapRequest, 
  SickReport, 
  VacationRequest, 
  HoursStatement,
  Staff,
  AvailabilityFormData,
  SwapRequestFormData,
  SickReportFormData,
  VacationRequestFormData,
} from './types'
import { getSupabaseClient } from './supabaseClient'

/**
 * Staff Portal API Contracts
 * These functions provide a consistent interface for both apps to interact with the database
 */

// Staff management
export async function fetchStaff(): Promise<Staff[]> {
  const supabase = getSupabaseClient()
  
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .order('name')

  if (error) {
    throw new Error(`Failed to fetch staff: ${error.message}`)
  }

  return data.map(mapStaffFromDB)
}

export async function fetchStaffById(id: number): Promise<Staff | null> {
  const supabase = getSupabaseClient()
  
  const { data, error } = await supabase
    .from('staff')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw new Error(`Failed to fetch staff: ${error.message}`)
  }

  return mapStaffFromDB(data)
}

// Availability submissions
export async function fetchAvailability(staffId: number, month: string): Promise<AvailabilitySubmission | null> {
  const supabase = getSupabaseClient()
  
  const { data, error } = await supabase
    .from('availability_submissions')
    .select('*')
    .eq('staff_id', staffId)
    .eq('month', month)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw new Error(`Failed to fetch availability: ${error.message}`)
  }

  return mapAvailabilitySubmissionFromDB(data)
}

export async function submitAvailability(
  staffId: number, 
  month: string, 
  entries: AvailabilityFormData['entries']
): Promise<AvailabilitySubmission> {
  const supabase = getSupabaseClient()
  
  const payload = {
    staff_id: staffId,
    month,
    entries,
    status: 'submitted',
    submitted_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('availability_submissions')
    .upsert(payload, { onConflict: 'staff_id,month' })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to submit availability: ${error.message}`)
  }

  return mapAvailabilitySubmissionFromDB(data)
}

export async function saveDraftAvailability(
  staffId: number, 
  month: string, 
  entries: AvailabilityFormData['entries']
): Promise<AvailabilitySubmission> {
  const supabase = getSupabaseClient()
  
  const payload = {
    staff_id: staffId,
    month,
    entries,
    status: 'draft',
  }

  const { data, error } = await supabase
    .from('availability_submissions')
    .upsert(payload, { onConflict: 'staff_id,month' })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to save draft availability: ${error.message}`)
  }

  return mapAvailabilitySubmissionFromDB(data)
}

// Swap requests
export async function fetchSwapRequests(staffId?: number): Promise<SwapRequest[]> {
  const supabase = getSupabaseClient()
  
  let query = supabase
    .from('swap_requests')
    .select('*')
    .order('created_at', { ascending: false })

  if (staffId) {
    query = query.or(`created_by.eq.${staffId},target_staff_id.eq.${staffId},target_staff_id.is.null`)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch swap requests: ${error.message}`)
  }

  return data.map(mapSwapRequestFromDB)
}

export async function createSwapRequest(
  staffId: number,
  requestData: SwapRequestFormData
): Promise<SwapRequest> {
  const supabase = getSupabaseClient()
  
  const month = requestData.date.substring(0, 7) // Extract YYYY-MM
  
  const payload = {
    created_by: staffId,
    month,
    date: requestData.date,
    shift_key: requestData.shiftKey,
    target_staff_id: requestData.targetStaffId || null,
    status: 'open',
    messages: requestData.message ? [{
      timestamp: new Date().toISOString(),
      from: staffId,
      message: requestData.message,
    }] : [],
  }

  const { data, error } = await supabase
    .from('swap_requests')
    .insert(payload)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create swap request: ${error.message}`)
  }

  return mapSwapRequestFromDB(data)
}

export async function acceptSwapRequest(requestId: string, staffId: number): Promise<SwapRequest> {
  const supabase = getSupabaseClient()
  
  const { data, error } = await supabase
    .from('swap_requests')
    .update({
      status: 'accepted',
      accepted_by: staffId,
    })
    .eq('id', requestId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to accept swap request: ${error.message}`)
  }

  return mapSwapRequestFromDB(data)
}

export async function withdrawSwapRequest(requestId: string): Promise<SwapRequest> {
  const supabase = getSupabaseClient()
  
  const { data, error } = await supabase
    .from('swap_requests')
    .update({
      status: 'withdrawn',
    })
    .eq('id', requestId)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to withdraw swap request: ${error.message}`)
  }

  return mapSwapRequestFromDB(data)
}

// Sick reports
export async function fetchSickReports(staffId: number): Promise<SickReport[]> {
  const supabase = getSupabaseClient()
  
  const { data, error } = await supabase
    .from('sick_reports')
    .select('*')
    .eq('staff_id', staffId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch sick reports: ${error.message}`)
  }

  return data.map(mapSickReportFromDB)
}

export async function reportSick(
  staffId: number,
  reportData: SickReportFormData
): Promise<SickReport> {
  const supabase = getSupabaseClient()
  
  const payload = {
    staff_id: staffId,
    date_from: reportData.dateFrom,
    date_to: reportData.dateTo,
    note: reportData.note || null,
    requires_certificate: reportData.requiresCertificate,
    certificate_submitted: false,
    status: 'reported',
    created_by: staffId,
  }

  const { data, error } = await supabase
    .from('sick_reports')
    .insert(payload)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to report sick: ${error.message}`)
  }

  return mapSickReportFromDB(data)
}

// Vacation requests
export async function fetchVacationRequests(staffId: number): Promise<VacationRequest[]> {
  const supabase = getSupabaseClient()
  
  const { data, error } = await supabase
    .from('vacation_requests')
    .select('*')
    .eq('staff_id', staffId)
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch vacation requests: ${error.message}`)
  }

  return data.map(mapVacationRequestFromDB)
}

export async function requestVacation(
  staffId: number,
  requestData: VacationRequestFormData
): Promise<VacationRequest> {
  const supabase = getSupabaseClient()
  
  // Calculate days requested
  const fromDate = new Date(requestData.dateFrom)
  const toDate = new Date(requestData.dateTo)
  const daysRequested = Math.ceil((toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24)) + 1

  const payload = {
    staff_id: staffId,
    date_from: requestData.dateFrom,
    date_to: requestData.dateTo,
    reason: requestData.reason || null,
    days_requested: daysRequested,
    status: 'pending',
    created_by: staffId,
  }

  const { data, error } = await supabase
    .from('vacation_requests')
    .insert(payload)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to request vacation: ${error.message}`)
  }

  return mapVacationRequestFromDB(data)
}

// Hours statements
export async function generateHoursStatement(staffId: number, month: string): Promise<HoursStatement> {
  // This is a stub implementation - in a real app, this would aggregate from schedule data
  const supabase = getSupabaseClient()
  
  // Generate placeholder data
  const totals = {
    regularHours: 160,
    overtimeHours: 8,
    sickDays: 0,
    vacationDays: 2,
    totalWorkingDays: 22,
  }

  const breakdown: Record<string, any> = {}
  // Generate daily breakdown for the month...
  // This is simplified for the demo

  const payload = {
    staff_id: staffId,
    month,
    source: 'schedule' as const,
    totals,
    breakdown,
    status: 'generated' as const,
    created_by: staffId,
  }

  const { data, error } = await supabase
    .from('hours_statements')
    .upsert(payload, { onConflict: 'staff_id,month' })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to generate hours statement: ${error.message}`)
  }

  return mapHoursStatementFromDB(data)
}

export async function fetchHoursStatement(staffId: number, month: string): Promise<HoursStatement | null> {
  const supabase = getSupabaseClient()
  
  const { data, error } = await supabase
    .from('hours_statements')
    .select('*')
    .eq('staff_id', staffId)
    .eq('month', month)
    .single()

  if (error) {
    if (error.code === 'PGRST116') return null // Not found
    throw new Error(`Failed to fetch hours statement: ${error.message}`)
  }

  return mapHoursStatementFromDB(data)
}

// Helper functions to map database rows to our types
function mapStaffFromDB(row: any): Staff {
  return {
    id: row.id,
    name: row.name,
    role: row.role,
    contractHours: row.contract_hours,
    typicalWorkdays: row.typical_workdays,
    weekendPreference: row.weekend_preference,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapAvailabilitySubmissionFromDB(row: any): AvailabilitySubmission {
  return {
    id: row.id,
    staffId: row.staff_id,
    month: row.month,
    entries: row.entries,
    submittedAt: row.submitted_at,
    lockedAt: row.locked_at,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  }
}

function mapSwapRequestFromDB(row: any): SwapRequest {
  return {
    id: row.id,
    createdBy: row.created_by,
    month: row.month,
    date: row.date,
    shiftKey: row.shift_key,
    targetStaffId: row.target_staff_id,
    status: row.status,
    acceptedBy: row.accepted_by,
    messages: row.messages || [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapSickReportFromDB(row: any): SickReport {
  return {
    id: row.id,
    staffId: row.staff_id,
    dateFrom: row.date_from,
    dateTo: row.date_to,
    note: row.note,
    requiresCertificate: row.requires_certificate,
    certificateSubmitted: row.certificate_submitted,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  }
}

function mapVacationRequestFromDB(row: any): VacationRequest {
  return {
    id: row.id,
    staffId: row.staff_id,
    dateFrom: row.date_from,
    dateTo: row.date_to,
    reason: row.reason,
    daysRequested: row.days_requested,
    status: row.status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  }
}

function mapHoursStatementFromDB(row: any): HoursStatement {
  return {
    id: row.id,
    staffId: row.staff_id,
    month: row.month,
    generatedAt: row.generated_at,
    source: row.source,
    totals: row.totals,
    breakdown: row.breakdown,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    createdBy: row.created_by,
  }
}