# Supabase Setup Guide for Staff Portal

This guide will walk you through setting up Supabase for the Staff Portal from scratch. No prior Supabase experience required!

## 🎯 What You'll Set Up

- **Supabase Project**: Your backend database and authentication service
- **Database Schema**: Tables for staff, availability, schedules, approvals, etc.
- **Row Level Security (RLS)**: Fine-grained permissions for data access
- **Environment Variables**: Connection settings for your app

## 📋 Prerequisites

- A web browser
- Access to the Staff Portal codebase
- Email address for Supabase account

## 🚀 Step 1: Create Supabase Account and Project

### 1.1 Sign Up
1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project"
3. Sign up with your email or GitHub account
4. Verify your email if prompted

### 1.2 Create New Project
1. Click "New Project" on your dashboard
2. Choose your organization (or create one if first time)
3. Fill in project details:
   - **Name**: `sportfabrik-scheduler` (or your preferred name)
   - **Database Password**: Choose a strong password (save this!)
   - **Region**: Choose closest to your location (Europe/Frankfurt for Germany)
   - **Pricing Plan**: Start with "Free" tier
4. Click "Create new project"
5. Wait 2-3 minutes for project initialization

### 1.3 Save Your Project Details
After creation, save these details (you'll need them later):
- **Project URL**: Found in Settings > API (starts with https://...)
- **Anon Public Key**: Found in Settings > API (starts with eyJ...)
- **Database Password**: The password you chose above

## 🗄️ Step 2: Set Up Database Schema

### 2.1 Access SQL Editor
1. In your Supabase project dashboard, click "SQL Editor" in the sidebar
2. Click "New query" to create a new SQL script

### 2.2 Run Schema Creation Script
Copy and paste the entire contents of `/schema_v3.sql` from your project into the SQL editor, then click "Run".

This will create all necessary tables:
- `staff` - Employee records
- `availability` - Individual staff availability records  
- `schedule_days` - Published schedules
- `vacation_ledger` - Vacation tracking
- `absences` - Sick leave and vacation records
- `overtime_requests` - Overtime approval workflows
- `overtime_consents` - Weekend/overtime permissions

### 2.3 Add Staff Portal Tables
Copy and paste the entire contents of `/docs/STAFF_PORTAL_TABLES.sql` into the SQL editor and click "Run".

This adds the additional tables needed for the Staff Portal:
- `availability_submissions` - Monthly availability submissions
- `swap_requests` - Shift swap requests between staff
- `sick_reports` - Illness reporting with document uploads
- `vacation_requests` - Vacation request workflow
- `hours_statements` - Monthly hours summaries

### 2.4 Verify Schema Creation
In the "Table Editor" tab, you should see all the tables listed above. If any are missing, re-run the schema script.

## 🔒 Step 3: Configure Row Level Security (RLS)

RLS ensures users can only access their own data and managers can approve requests.

### 3.1 Enable RLS on All Tables
Run this SQL script in the SQL Editor:

\`\`\`sql
-- Enable RLS on all tables
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.availability_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.absences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.overtime_consents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.swap_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sick_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vacation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hours_statements ENABLE ROW LEVEL SECURITY;
\`\`\`

### 3.2 Create RLS Policies
Run this script to create access policies:

\`\`\`sql
-- Staff table policies
CREATE POLICY "Users can view all staff" ON public.staff FOR SELECT USING (true);
CREATE POLICY "Managers can manage staff" ON public.staff FOR ALL USING (
  auth.jwt() ->> 'role' = 'manager' OR 
  auth.jwt() ->> 'role' = 'admin'
);

-- Availability policies
CREATE POLICY "Users can view own availability" ON public.availability FOR SELECT USING (
  staff_id IN (
    SELECT id FROM public.staff WHERE auth.jwt() ->> 'email' = LOWER(name)
  )
);
CREATE POLICY "Users can manage own availability" ON public.availability FOR ALL USING (
  staff_id IN (
    SELECT id FROM public.staff WHERE auth.jwt() ->> 'email' = LOWER(name)
  )
);
CREATE POLICY "Managers can view all availability" ON public.availability FOR SELECT USING (
  auth.jwt() ->> 'role' = 'manager' OR 
  auth.jwt() ->> 'role' = 'admin'
);

-- Schedule policies
CREATE POLICY "Everyone can view schedules" ON public.schedule_days FOR SELECT USING (true);
CREATE POLICY "Managers can manage schedules" ON public.schedule_days FOR ALL USING (
  auth.jwt() ->> 'role' = 'manager' OR 
  auth.jwt() ->> 'role' = 'admin'
);

-- Vacation ledger policies
CREATE POLICY "Users can view own vacation" ON public.vacation_ledger FOR SELECT USING (
  staff_id IN (
    SELECT id FROM public.staff WHERE auth.jwt() ->> 'email' = LOWER(name)
  )
);
CREATE POLICY "Managers can view all vacation" ON public.vacation_ledger FOR SELECT USING (
  auth.jwt() ->> 'role' = 'manager' OR 
  auth.jwt() ->> 'role' = 'admin'
);

-- Absence policies  
CREATE POLICY "Users can manage own absences" ON public.absences FOR ALL USING (
  staff_id IN (
    SELECT id FROM public.staff WHERE auth.jwt() ->> 'email' = LOWER(name)
  )
);
CREATE POLICY "Managers can view all absences" ON public.absences FOR SELECT USING (
  auth.jwt() ->> 'role' = 'manager' OR 
  auth.jwt() ->> 'role' = 'admin'
);

-- Overtime request policies
CREATE POLICY "Users can manage own overtime requests" ON public.overtime_requests FOR ALL USING (
  staff_id IN (
    SELECT id FROM public.staff WHERE auth.jwt() ->> 'email' = LOWER(name)
  )
);
CREATE POLICY "Managers can manage all overtime requests" ON public.overtime_requests FOR ALL USING (
  auth.jwt() ->> 'role' = 'manager' OR 
  auth.jwt() ->> 'role' = 'admin'
);

-- Availability submissions policies (Staff Portal)
CREATE POLICY "Users can view own availability submissions" ON public.availability_submissions FOR SELECT USING (
  staff_id IN (
    SELECT id FROM public.staff WHERE auth.jwt() ->> 'email' = LOWER(name)
  )
);
CREATE POLICY "Users can manage own availability submissions" ON public.availability_submissions FOR ALL USING (
  staff_id IN (
    SELECT id FROM public.staff WHERE auth.jwt() ->> 'email' = LOWER(name)
  )
);
CREATE POLICY "Managers can view all availability submissions" ON public.availability_submissions FOR SELECT USING (
  auth.jwt() ->> 'role' = 'manager' OR 
  auth.jwt() ->> 'role' = 'admin'
);
CREATE POLICY "Managers can approve availability submissions" ON public.availability_submissions FOR UPDATE USING (
  auth.jwt() ->> 'role' = 'manager' OR 
  auth.jwt() ->> 'role' = 'admin'
);

-- Swap request policies
CREATE POLICY "Users can view relevant swap requests" ON public.swap_requests FOR SELECT USING (
  created_by IN (
    SELECT id FROM public.staff WHERE auth.jwt() ->> 'email' = LOWER(name)
  ) OR 
  target_staff_id IN (
    SELECT id FROM public.staff WHERE auth.jwt() ->> 'email' = LOWER(name)
  ) OR
  target_staff_id IS NULL OR
  auth.jwt() ->> 'role' IN ('manager', 'admin')
);
CREATE POLICY "Users can create swap requests" ON public.swap_requests FOR INSERT WITH CHECK (
  created_by IN (
    SELECT id FROM public.staff WHERE auth.jwt() ->> 'email' = LOWER(name)
  )
);
CREATE POLICY "Users can respond to swap requests" ON public.swap_requests FOR UPDATE USING (
  target_staff_id IN (
    SELECT id FROM public.staff WHERE auth.jwt() ->> 'email' = LOWER(name)
  ) OR
  auth.jwt() ->> 'role' IN ('manager', 'admin')
);

-- Sick report policies
CREATE POLICY "Users can manage own sick reports" ON public.sick_reports FOR ALL USING (
  staff_id IN (
    SELECT id FROM public.staff WHERE auth.jwt() ->> 'email' = LOWER(name)
  )
);
CREATE POLICY "Managers can view all sick reports" ON public.sick_reports FOR SELECT USING (
  auth.jwt() ->> 'role' = 'manager' OR 
  auth.jwt() ->> 'role' = 'admin'
);

-- Vacation request policies  
CREATE POLICY "Users can manage own vacation requests" ON public.vacation_requests FOR ALL USING (
  staff_id IN (
    SELECT id FROM public.staff WHERE auth.jwt() ->> 'email' = LOWER(name)
  )
);
CREATE POLICY "Managers can manage all vacation requests" ON public.vacation_requests FOR ALL USING (
  auth.jwt() ->> 'role' = 'manager' OR 
  auth.jwt() ->> 'role' = 'admin'
);

-- Hours statement policies
CREATE POLICY "Users can view own hours statements" ON public.hours_statements FOR SELECT USING (
  staff_id IN (
    SELECT id FROM public.staff WHERE auth.jwt() ->> 'email' = LOWER(name)
  )
);
CREATE POLICY "Managers can manage all hours statements" ON public.hours_statements FOR ALL USING (
  auth.jwt() ->> 'role' = 'manager' OR 
  auth.jwt() ->> 'role' = 'admin'
);

-- Overtime consent policies
CREATE POLICY "Users can view own consents" ON public.overtime_consents FOR SELECT USING (
  staff_id IN (
    SELECT id FROM public.staff WHERE auth.jwt() ->> 'email' = LOWER(name)
  )
);
CREATE POLICY "Managers can manage all consents" ON public.overtime_consents FOR ALL USING (
  auth.jwt() ->> 'role' = 'manager' OR 
  auth.jwt() ->> 'role' = 'admin'
);
\`\`\`

## 👥 Step 4: Set Up Authentication

### 4.1 Configure Email Authentication
1. Go to "Authentication" > "Settings" in your Supabase dashboard
2. Under "Auth Providers", ensure "Email" is enabled
3. Configure email templates (optional for now)

### 4.2 Create Test Users
1. Go to "Authentication" > "Users"
2. Click "Add user" > "Create new user"
3. Create at least two test users:
   - **Manager User**: 
     - Email: `manager@sportfabrik.test`
     - Password: Choose a secure password
     - User metadata: `{"role": "manager"}`
   - **Staff User**:
     - Email: `staff@sportfabrik.test` 
     - Password: Choose a secure password
     - User metadata: `{"role": "staff"}`

### 4.3 Create Corresponding Staff Records
Run this SQL to create staff records that match your test users:

\`\`\`sql
-- Insert test staff records
INSERT INTO public.staff (name, role, contract_hours, typical_workdays, weekend_preference) VALUES
('manager@sportfabrik.test', 'permanent', 40, 5, false),
('staff@sportfabrik.test', 'student', 20, 3, true);
\`\`\`

## ⚙️ Step 5: Configure Environment Variables

Create a `.env.local` file in your staff portal app directory (`apps/staff-portal/.env.local`):

\`\`\`env
VITE_SUPABASE_URL=your_project_url_here
VITE_SUPABASE_ANON_KEY=your_anon_key_here
\`\`\`

Replace the values with your actual:
- **Project URL**: From Supabase Settings > API
- **Anon Key**: From Supabase Settings > API

## 🧪 Step 6: Test Your Setup

### 6.1 Start the Staff Portal
\`\`\`bash
cd apps/staff-portal
npm run dev
\`\`\`

### 6.2 Test Authentication
1. Open the app in your browser (usually http://localhost:5173)
2. Try logging in with your test users:
   - `manager@sportfabrik.test`
   - `staff@sportfabrik.test`
3. Verify you can access the availability page

### 6.3 Verify Database Connection
1. Check browser console for any connection errors
2. Try submitting availability (should work without errors)
3. Check Supabase Table Editor to see if data appears

## 🎯 You're Ready!

Once you've completed these steps, tell me:
1. ✅ "Supabase project is created"
2. ✅ "Database schema is set up" 
3. ✅ "RLS policies are configured"
4. ✅ "Test users are created"
5. ✅ "Environment variables are set"
6. ✅ "App connects successfully"

I'll then help you:
- Replace mock data with real Supabase operations
- Implement the approval workflows  
- Add remaining features like shift swaps and sick leave

## 🆘 Troubleshooting

**Can't connect to Supabase?**
- Double-check your environment variables
- Ensure the project URL and anon key are correct
- Check browser console for specific error messages

**RLS blocking access?**
- Verify your user metadata includes the correct role
- Check the RLS policies are created correctly
- Temporarily disable RLS for testing (re-enable for production)

**Login not working?**
- Confirm email providers are enabled in Authentication settings
- Check that user exists in Authentication > Users
- Verify corresponding staff record exists in the staff table

Need help? Share any error messages you see, and I'll help troubleshoot!