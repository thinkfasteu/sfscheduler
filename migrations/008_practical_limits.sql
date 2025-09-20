-- Migration: Add practical weekly/hour limits to contracts
-- Date: 2025-09-20
-- Purpose: Track real-world caps for Minijob and Werkstudent roles

-- Add new fields to staff table for practical limits
ALTER TABLE staff 
ADD COLUMN weekly_hours_min_practical DECIMAL(5,2) NULL COMMENT 'Practical minimum weekly hours for scheduling',
ADD COLUMN weekly_hours_max_practical DECIMAL(5,2) NULL COMMENT 'Practical maximum weekly hours for scheduling',
ADD COLUMN notes_practical_caps TEXT NULL COMMENT 'Notes about practical scheduling limitations';

-- Update schema version (if using schema versioning)
UPDATE app_meta 
SET value = JSON_SET(value, '$.v', 7)
WHERE key = 'schema_version';

-- Add indexes for performance
CREATE INDEX idx_staff_practical_hours ON staff(weekly_hours_min_practical, weekly_hours_max_practical);

-- Comments for future reference
-- TODO: Add per-person wage field once approved by management
-- Future field: hourly_wage_override DECIMAL(6,2) NULL for individual wage tracking