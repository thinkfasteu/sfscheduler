import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'
import DevelopmentSetupNotice from '../../components/DevelopmentSetupNotice'

function LoginPage() {
  const { t } = useTranslation()
  const { signIn } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!formData.email || !formData.password) {
      toast.error(t('validation.required'))
      return
    }

    setLoading(true)
    try {
      await signIn(formData.email, formData.password)
      toast.success(t('auth.messages.loginSuccess'))
    } catch (error) {
      console.error('Login error:', error)
      toast.error(error instanceof Error ? error.message : t('auth.messages.loginError'))
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-center text-3xl font-extrabold text-gray-900">
          {t('auth.loginTitle')}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {t('auth.loginSubtitle')}
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            {t('common.email')}
          </label>
          <div className="mt-1">
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="input"
              placeholder="ihre.email@example.com"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            {t('common.password')}
          </label>
          <div className="mt-1">
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={formData.password}
              onChange={handleChange}
              className="input"
              placeholder="••••••••"
            />
          </div>
        </div>

        <div>
          <button
            type="submit"
            disabled={loading}
            className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 ${
              loading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {loading ? t('common.loading') : t('auth.signIn')}
          </button>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            {t('auth.noAccount')}{' '}
            <Link
              to="/register"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              {t('auth.signUp')}
            </Link>
          </p>
        </div>

        {/* Development Setup Notice */}
        <DevelopmentSetupNotice />

        {/* Development Notice */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Entwicklungsumgebung
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  Für Tests können Sie sich mit jeder E-Mail-Adresse registrieren. 
                  Supabase-Konfiguration ist erforderlich für die Produktion.
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default LoginPage