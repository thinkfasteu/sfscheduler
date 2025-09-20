# Staff Portal - Supabase Setup Guide

## 🎯 Status
✅ **Authentication UI**: Complete with login/register forms  
⚠️ **Database Connection**: Requires Supabase configuration  
🔄 **Next Step**: Configure Supabase credentials  

## 🛠️ Quick Setup

### 1. Create Supabase Project
1. Go to [supabase.com](https://supabase.com)
2. Create a new project
3. Note your project URL and anon key

### 2. Configure Environment
1. Copy `/apps/staff-portal/.env.example` to `.env.local`
2. Replace with your actual Supabase credentials:
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

### 3. Apply Database Migrations
```bash
# Navigate to project root
cd /home/brucestafford/dev/sfscheduler

# Apply migrations (use Supabase CLI or SQL editor)
# Files: migrations/009_add_staff_portal_tables.sql
#        migrations/010_add_staff_portal_rls.sql
```

### 4. Test Authentication
1. Start dev server: `npm run dev:staff`
2. Open http://localhost:3001
3. Try registering a new account
4. Verify login/logout flow

## 🔑 Current Auth Features

### ✅ Implemented
- Complete login/register forms with validation
- German translation support
- Form validation with proper error messages
- Password confirmation
- Responsive design
- Loading states and user feedback

### 🎨 UI Components
- **Login Page** (`/login`): Email/password with "forgot password" link
- **Register Page** (`/register`): Full registration with first/last name
- **Form Validation**: Client-side validation with i18n error messages
- **Development Notices**: Helper text for setup guidance

### 🔐 Security Features
- Email/password authentication via Supabase Auth
- Row Level Security (RLS) policies ready for deployment
- Session management with automatic refresh
- Protected routes with role-based access

## 🚀 Testing Without Supabase

The app currently runs in development mode with mock authentication. You'll see:
- All forms render correctly
- Validation works properly  
- Error message: "Supabase not configured"
- UI/UX is fully testable

## 📱 Mobile Support

The authentication forms are fully responsive and mobile-friendly:
- Touch-friendly form inputs
- Proper keyboard types (email, password)
- Optimized spacing for mobile devices
- Native form validation

## 🌍 Internationalization

All text supports German (primary) and English:
- Form labels and placeholders in German
- Comprehensive error messages
- Validation feedback
- Help text and instructions

## 🔧 Architecture Notes

### Authentication Flow
1. **AuthContext**: Central auth state management
2. **Supabase Integration**: Email/password with metadata
3. **Protected Routes**: Automatic redirects for unauthenticated users
4. **Staff Data Loading**: Automatic profile data fetch on login

### Database Schema
- **Migration 009**: Staff portal tables (availability_submissions, swap_requests, etc.)
- **Migration 010**: Row Level Security policies for staff/manager/admin roles
- **Existing Schema**: Integration with current staff table and scheduler

## 🎯 Next Development Phase

Once Supabase is configured, development can continue with:
1. **Availability Calendar**: Interactive calendar for availability submission
2. **Shift Swaps**: Request and manage shift exchanges
3. **Sick Leave**: Report and track sick days
4. **Vacation Requests**: Submit and approve vacation
5. **Monthly Hours**: Generate and export time reports

## 📚 Development Commands

```bash
# Start development server
npm run dev:staff

# Build for production
npm run build:staff

# Run linting
npm run lint

# Apply database migrations (when Supabase is configured)
supabase db push
```