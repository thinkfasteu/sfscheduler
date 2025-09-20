-- Migration 009: Staff Portal Tables
-- Date: 2025-09-20
-- Purpose: Add tables for staff portal functionality (availability submissions, swap requests, sick reports, vacation requests, hours statements)

BEGIN;

-- Add availability_submissions table for monthly availability data
CREATE TABLE IF NOT EXISTS public.availability_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id BIGINT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- First day of month (YYYY-MM-01)
  entries JSONB NOT NULL DEFAULT '{}'::jsonb, -- Per-day shift preferences: {"2025-09-01": {"morning": "yes", "evening": "prefer"}}
  submitted_at TIMESTAMPTZ NULL, -- NULL = draft, NOT NULL = submitted
  locked_at TIMESTAMPTZ NULL, -- When manager locked the submission
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'submitted', 'locked')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT REFERENCES public.staff(id),
  UNIQUE(staff_id, month)
);
CREATE INDEX idx_availability_submissions_month ON public.availability_submissions(month);
CREATE INDEX idx_availability_submissions_status ON public.availability_submissions(status);

-- Add swap_requests table for shift swapping
CREATE TABLE IF NOT EXISTS public.swap_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by BIGINT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  month TEXT NOT NULL, -- YYYY-MM format
  date DATE NOT NULL,
  shift_key TEXT NOT NULL, -- e.g., "morning", "evening"
  target_staff_id BIGINT NULL REFERENCES public.staff(id) ON DELETE SET NULL, -- NULL = open to anyone
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'withdrawn', 'manager_review', 'rejected')),
  accepted_by BIGINT NULL REFERENCES public.staff(id) ON DELETE SET NULL,
  messages JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of {timestamp, from, message}
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_meta BIGINT REFERENCES public.staff(id) DEFAULT NULL
);
CREATE INDEX idx_swap_requests_month_date ON public.swap_requests(month, date);
CREATE INDEX idx_swap_requests_status ON public.swap_requests(status);
CREATE INDEX idx_swap_requests_target ON public.swap_requests(target_staff_id);

-- Add sick_reports table for illness reporting
CREATE TABLE IF NOT EXISTS public.sick_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id BIGINT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  note TEXT,
  requires_certificate BOOLEAN NOT NULL DEFAULT FALSE,
  certificate_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  status TEXT NOT NULL DEFAULT 'reported' CHECK (status IN ('reported', 'approved', 'rejected')),
  approved_by BIGINT NULL REFERENCES public.staff(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT REFERENCES public.staff(id)
);
CREATE INDEX idx_sick_reports_staff ON public.sick_reports(staff_id);
CREATE INDEX idx_sick_reports_dates ON public.sick_reports(date_from, date_to);
CREATE INDEX idx_sick_reports_status ON public.sick_reports(status);

-- Add vacation_requests table for vacation planning
CREATE TABLE IF NOT EXISTS public.vacation_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id BIGINT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  date_from DATE NOT NULL,
  date_to DATE NOT NULL,
  reason TEXT,
  days_requested INTEGER NOT NULL, -- Calculated field for easy queries
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
  approved_by BIGINT NULL REFERENCES public.staff(id) ON DELETE SET NULL,
  approved_at TIMESTAMPTZ NULL,
  rejection_reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT REFERENCES public.staff(id)
);
CREATE INDEX idx_vacation_requests_staff ON public.vacation_requests(staff_id);
CREATE INDEX idx_vacation_requests_dates ON public.vacation_requests(date_from, date_to);
CREATE INDEX idx_vacation_requests_status ON public.vacation_requests(status);

-- Add hours_statements table for monthly hour summaries (Abrechnung)
CREATE TABLE IF NOT EXISTS public.hours_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id BIGINT NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  month DATE NOT NULL, -- First day of month (YYYY-MM-01)
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT NOT NULL DEFAULT 'schedule' CHECK (source IN ('schedule', 'self_report', 'mixed')),
  totals JSONB NOT NULL DEFAULT '{}'::jsonb, -- {"regular_hours": 40, "overtime_hours": 2, "sick_days": 1, "vacation_days": 0}
  breakdown JSONB NOT NULL DEFAULT '{}'::jsonb, -- Daily breakdown
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'generated', 'exported')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by BIGINT REFERENCES public.staff(id),
  UNIQUE(staff_id, month)
);
CREATE INDEX idx_hours_statements_month ON public.hours_statements(month);
CREATE INDEX idx_hours_statements_status ON public.hours_statements(status);

-- Add roles if they don't exist (for future RBAC)
DO $$
BEGIN
  -- Check if staff table has a role column and if not, we need to add role management
  -- For now, we'll use the existing role field on staff table
  -- In future, we might want a dedicated roles/permissions table
END $$;

-- Enable RLS on new tables
ALTER TABLE public.availability_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sick_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hours_statements ENABLE ROW LEVEL SECURITY;

-- Update schema version
UPDATE public.app_meta 
SET value = jsonb_set(value, '{v}', '8'::jsonb), updated_at = NOW()
WHERE key = 'schema_version';

COMMIT;