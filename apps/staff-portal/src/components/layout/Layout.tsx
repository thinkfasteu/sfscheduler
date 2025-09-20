import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../hooks/useAuth'
import { useFeatureFlags } from '../../hooks/useFeatureFlags'
import {
  CalendarIcon,
  ArrowsRightLeftIcon,
  HeartIcon,
  SunIcon,
  DocumentTextIcon,
  Cog6ToothIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'

interface LayoutProps {
  children: React.ReactNode
}

const allNavigation = [
  { name: 'navigation.availability', href: '/availability', icon: CalendarIcon, feature: 'FEATURE_AVAILABILITY' },
  { name: 'navigation.swaps', href: '/swaps', icon: ArrowsRightLeftIcon, feature: 'FEATURE_SWAP' },
  { name: 'navigation.sick', href: '/sick', icon: HeartIcon, feature: 'FEATURE_SICK' },
  { name: 'navigation.vacation', href: '/vacation', icon: SunIcon, feature: 'FEATURE_VACATION' },
  { name: 'navigation.abrechnung', href: '/abrechnung', icon: DocumentTextIcon, feature: 'FEATURE_HOURS' },
  { name: 'navigation.settings', href: '/settings', icon: Cog6ToothIcon, feature: null }, // Always available
]

function Layout({ children }: LayoutProps) {
  const { t } = useTranslation()
  const { staff, signOut } = useAuth()
  const location = useLocation()
  const featureFlags = useFeatureFlags()

  // Filter navigation based on enabled features
  const navigation = allNavigation.filter(item => 
    !item.feature || featureFlags[item.feature as keyof typeof featureFlags]
  )

  const handleSignOut = async () => {
    try {
      await signOut()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-gray-900">
                FTG Sportfabrik
              </Link>
              <span className="ml-2 text-sm text-gray-500">Staff Portal</span>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-700">
                {staff?.name}
              </span>
              <button
                onClick={handleSignOut}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title={t('common.logout')}
              >
                <ArrowRightOnRectangleIcon className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8">
          {/* Sidebar */}
          <aside className="lg:col-span-3">
            <nav className="space-y-1">
              {navigation.map((item) => {
                const isActive = location.pathname === item.href
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    className={`${
                      isActive
                        ? 'bg-primary-100 text-primary-700 border-primary-500'
                        : 'text-gray-700 hover:bg-gray-50 border-transparent'
                    } group flex items-center px-3 py-2 text-sm font-medium border-l-4 transition-colors`}
                  >
                    <item.icon
                      className={`${
                        isActive ? 'text-primary-500' : 'text-gray-400 group-hover:text-gray-500'
                      } flex-shrink-0 -ml-1 mr-3 h-6 w-6 transition-colors`}
                    />
                    {t(item.name)}
                  </Link>
                )
              })}
            </nav>
          </aside>

          {/* Main content */}
          <main className="lg:col-span-9 mt-8 lg:mt-0">
            {children}
          </main>
        </div>
      </div>
    </div>
  )
}

export default Layout