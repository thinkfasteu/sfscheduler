import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { useAuth } from './hooks/useAuth'
import Layout from './components/layout/Layout'
import AuthLayout from './components/layout/AuthLayout'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import AvailabilityPage from './pages/AvailabilityPage'
import SwapsPage from './pages/SwapsPage'
import SickPage from './pages/SickPage'
import VacationPage from './pages/VacationPage'
import AbrechnungPage from './pages/AbrechnungPage'
import SettingsPage from './pages/SettingsPage'
import { createSupabaseClient } from '@shared/supabaseClient'

function AppRoutes() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-500"></div>
      </div>
    )
  }

  if (!user) {
    return (
      <AuthLayout>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthLayout>
    )
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/availability" element={<AvailabilityPage />} />
        <Route path="/swaps" element={<SwapsPage />} />
        <Route path="/sick" element={<SickPage />} />
        <Route path="/vacation" element={<VacationPage />} />
        <Route path="/abrechnung" element={<AbrechnungPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="/register" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}

function App() {
  useEffect(() => {
    // Initialize Supabase client
    try {
      createSupabaseClient()
    } catch (error) {
      console.warn('Failed to initialize Supabase client:', error)
    }
  }, [])

  return (
    <AuthProvider>
      <AppRoutes />
    </AuthProvider>
  )
}

export default App