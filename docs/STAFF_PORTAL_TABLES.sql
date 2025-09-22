-- Migration: Add Staff Portal tables
-- Run this in Supabase SQL Editor after the main schema

BEGIN;

-- Availability submissions table (monthly submissions with all availability data)
CREATE TABLE IF NOT EXISTS public.availability_submissions (
  id bigserial PRIMARY KEY,
  staff_id bigint NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  month text NOT NULL, -- format: "2025-01"
  entries jsonb NOT NULL DEFAULT '{}'::jsonb, -- availability data for the month
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'approved', 'rejected')),
  submitted_at timestamptz,
  reviewed_at timestamptz,
  reviewed_by uuid,
  feedback text,
  version bigint NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(staff_id, month)
);

-- Shift swap requests  
CREATE TABLE IF NOT EXISTS public.swap_requests (
  id bigserial PRIMARY KEY,
  created_by bigint NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  original_date date NOT NULL,
  original_shift text NOT NULL,
  target_date date,
  target_shift text,
  target_staff_id bigint REFERENCES public.staff(id) ON DELETE CASCADE,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  reviewed_at timestamptz,
  reviewed_by uuid,
  feedback text,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sick reports
CREATE TABLE IF NOT EXISTS public.sick_reports (
  id bigserial PRIMARY KEY,
  staff_id bigint NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date,
  reason text,
  doctor_note_url text,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'approved', 'rejected')),
  reviewed_at timestamptz,
  reviewed_by uuid,
  feedback text,
  version bigint NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Vacation requests (separate from absences for workflow)
CREATE TABLE IF NOT EXISTS public.vacation_requests (
  id bigserial PRIMARY KEY,
  staff_id bigint NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  days_requested int NOT NULL,
  reason text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  reviewed_at timestamptz,
  reviewed_by uuid,
  feedback text,
  version bigint NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Monthly hours statements 
CREATE TABLE IF NOT EXISTS public.hours_statements (
  id bigserial PRIMARY KEY,
  staff_id bigint NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  month text NOT NULL, -- format: "2025-01"
  scheduled_hours decimal(5,2) NOT NULL DEFAULT 0,
  worked_hours decimal(5,2) NOT NULL DEFAULT 0,
  overtime_hours decimal(5,2) NOT NULL DEFAULT 0,
  vacation_hours decimal(5,2) NOT NULL DEFAULT 0,
  sick_hours decimal(5,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'approved')),
  finalized_at timestamptz,
  finalized_by uuid,
  version bigint NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(staff_id, month)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS availability_submissions_staff_month_idx ON public.availability_submissions (staff_id, month);
CREATE INDEX IF NOT EXISTS swap_requests_staff_status_idx ON public.swap_requests (created_by, status);
CREATE INDEX IF NOT EXISTS swap_requests_target_staff_idx ON public.swap_requests (target_staff_id, status);
CREATE INDEX IF NOT EXISTS sick_reports_staff_date_idx ON public.sick_reports (staff_id, start_date);
CREATE INDEX IF NOT EXISTS vacation_requests_staff_date_idx ON public.vacation_requests (staff_id, start_date);
CREATE INDEX IF NOT EXISTS hours_statements_staff_month_idx ON public.hours_statements (staff_id, month);

COMMIT;