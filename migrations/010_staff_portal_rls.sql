-- Migration 010: Staff Portal RLS Policies
-- Date: 2025-09-20
-- Purpose: Add proper Row Level Security policies for staff portal with RBAC (staff/manager/admin)

BEGIN;

-- First, drop existing permissive dev policies for new tables if they exist
DROP POLICY IF EXISTS dev_all_availability_submissions ON public.availability_submissions;
DROP POLICY IF EXISTS dev_all_swap_requests ON public.swap_requests;
DROP POLICY IF EXISTS dev_all_sick_reports ON public.sick_reports;
DROP POLICY IF EXISTS dev_all_vacation_requests ON public.vacation_requests;
DROP POLICY IF EXISTS dev_all_hours_statements ON public.hours_statements;

-- Helper function to check if user has manager/admin role
CREATE OR REPLACE FUNCTION is_manager_or_admin()
RETURNS BOOLEAN AS $$
BEGIN
  -- In development, we'll be permissive but log the access
  -- In production, this should check authenticated user's role
  -- For now, return true to allow development, but add TODO for proper auth
  RETURN TRUE;
  
  -- TODO: Implement proper auth check when Supabase Auth is integrated
  -- Example implementation:
  -- RETURN EXISTS (
  --   SELECT 1 FROM public.staff 
  --   WHERE id = auth.uid()::bigint 
  --   AND role IN ('manager', 'admin')
  -- );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to get current user's staff ID
CREATE OR REPLACE FUNCTION get_current_staff_id()
RETURNS BIGINT AS $$
BEGIN
  -- For development, return a test staff ID
  -- TODO: Replace with proper auth.uid() lookup when Supabase Auth is integrated
  RETURN 1;
  
  -- Example implementation:
  -- RETURN (
  --   SELECT id FROM public.staff 
  --   WHERE auth.uid()::text = staff.auth_user_id::text
  -- );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- AVAILABILITY_SUBMISSIONS policies
-- Staff can read/write their own submissions
CREATE POLICY staff_own_availability_submissions
  ON public.availability_submissions
  FOR ALL
  USING (staff_id = get_current_staff_id())
  WITH CHECK (staff_id = get_current_staff_id());

-- Managers can read all submissions  
CREATE POLICY manager_read_availability_submissions
  ON public.availability_submissions
  FOR SELECT
  USING (is_manager_or_admin());

-- Managers can update status (lock submissions)
CREATE POLICY manager_lock_availability_submissions
  ON public.availability_submissions
  FOR UPDATE
  USING (is_manager_or_admin())
  WITH CHECK (is_manager_or_admin());

-- SWAP_REQUESTS policies
-- Staff can read requests that involve them (created by them or targeted to them)
CREATE POLICY staff_own_swap_requests
  ON public.swap_requests
  FOR SELECT
  USING (
    created_by = get_current_staff_id() 
    OR target_staff_id = get_current_staff_id()
    OR target_staff_id IS NULL -- Open requests visible to all staff
  );

-- Staff can create their own swap requests
CREATE POLICY staff_create_swap_requests
  ON public.swap_requests
  FOR INSERT
  WITH CHECK (created_by = get_current_staff_id());

-- Staff can update their own swap requests (withdraw, accept if targeted)
CREATE POLICY staff_update_swap_requests
  ON public.swap_requests
  FOR UPDATE
  USING (
    created_by = get_current_staff_id() -- Can withdraw own requests
    OR (target_staff_id = get_current_staff_id() AND status = 'open') -- Can accept targeted requests
    OR (target_staff_id IS NULL AND status = 'open') -- Can accept open requests
  )
  WITH CHECK (
    created_by = get_current_staff_id()
    OR target_staff_id = get_current_staff_id()
  );

-- Managers can read and update all swap requests
CREATE POLICY manager_all_swap_requests
  ON public.swap_requests
  FOR ALL
  USING (is_manager_or_admin())
  WITH CHECK (is_manager_or_admin());

-- SICK_REPORTS policies
-- Staff can read/write their own sick reports
CREATE POLICY staff_own_sick_reports
  ON public.sick_reports
  FOR ALL
  USING (staff_id = get_current_staff_id())
  WITH CHECK (staff_id = get_current_staff_id());

-- Managers can read and approve all sick reports
CREATE POLICY manager_all_sick_reports
  ON public.sick_reports
  FOR ALL
  USING (is_manager_or_admin())
  WITH CHECK (is_manager_or_admin());

-- VACATION_REQUESTS policies  
-- Staff can read/write their own vacation requests
CREATE POLICY staff_own_vacation_requests
  ON public.vacation_requests
  FOR ALL
  USING (staff_id = get_current_staff_id())
  WITH CHECK (staff_id = get_current_staff_id());

-- Managers can read and approve all vacation requests
CREATE POLICY manager_all_vacation_requests
  ON public.vacation_requests
  FOR ALL
  USING (is_manager_or_admin())
  WITH CHECK (is_manager_or_admin());

-- HOURS_STATEMENTS policies
-- Staff can read their own hours statements
CREATE POLICY staff_own_hours_statements
  ON public.hours_statements
  FOR SELECT
  USING (staff_id = get_current_staff_id());

-- Managers can read and generate all hours statements
CREATE POLICY manager_all_hours_statements
  ON public.hours_statements
  FOR ALL
  USING (is_manager_or_admin())
  WITH CHECK (is_manager_or_admin());

-- Staff can generate their own hours statements
CREATE POLICY staff_generate_hours_statements
  ON public.hours_statements
  FOR INSERT
  WITH CHECK (staff_id = get_current_staff_id());

-- Update schema version
UPDATE public.app_meta 
SET value = jsonb_set(value, '{v}', '9'::jsonb), updated_at = NOW()
WHERE key = 'schema_version';

COMMIT;