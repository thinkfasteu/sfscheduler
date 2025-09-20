import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import toast from 'react-hot-toast'
import { useAuth } from '../../hooks/useAuth'

function RegisterPage() {
  const { t } = useTranslation()
  const { signUp } = useAuth()
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Basic validation
    if (!formData.email || !formData.password || !formData.confirmPassword || !formData.firstName || !formData.lastName) {
      toast.error(t('validation.required'))
      return
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error(t('validation.passwordsMatch'))
      return
    }

    if (formData.password.length < 6) {
      toast.error(t('validation.passwordMin'))
      return
    }

    setLoading(true)
    try {
      const fullName = `${formData.firstName} ${formData.lastName}`
      await signUp(formData.email, formData.password, fullName)
      toast.success(t('auth.messages.registerSuccess'))
    } catch (error) {
      console.error('Registration error:', error)
      toast.error(error instanceof Error ? error.message : t('auth.messages.registerError'))
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
          {t('auth.registerTitle')}
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          {t('auth.registerSubtitle')}
        </p>
      </div>

      <form className="space-y-6" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
              {t('common.firstName')}
            </label>
            <div className="mt-1">
              <input
                id="firstName"
                name="firstName"
                type="text"
                autoComplete="given-name"
                required
                value={formData.firstName}
                onChange={handleChange}
                className="input"
                placeholder="Max"
              />
            </div>
          </div>

          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
              {t('common.lastName')}
            </label>
            <div className="mt-1">
              <input
                id="lastName"
                name="lastName"
                type="text"
                autoComplete="family-name"
                required
                value={formData.lastName}
                onChange={handleChange}
                className="input"
                placeholder="Mustermann"
              />
            </div>
          </div>
        </div>

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
              placeholder="max.mustermann@example.com"
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
              autoComplete="new-password"
              required
              value={formData.password}
              onChange={handleChange}
              className="input"
              placeholder="••••••••"
            />
          </div>
          <p className="mt-1 text-sm text-gray-600">
            {t('validation.passwordRequirements')}
          </p>
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
            {t('auth.confirmPassword')}
          </label>
          <div className="mt-1">
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              value={formData.confirmPassword}
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
            {loading ? t('common.loading') : t('auth.signUp')}
          </button>
        </div>

        <div className="text-center">
          <p className="text-sm text-gray-600">
            {t('auth.hasAccount')}{' '}
            <Link
              to="/login"
              className="font-medium text-primary-600 hover:text-primary-500"
            >
              {t('auth.signIn')}
            </Link>
          </p>
        </div>

        {/* Development Notice */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex">
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">
                Registrierung für Mitarbeiter
              </h3>
              <div className="mt-2 text-sm text-blue-700">
                <p>
                  Nach der Registrierung wird Ihr Account von einem Administrator 
                  aktiviert und die entsprechenden Berechtigungen zugewiesen.
                </p>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  )
}

export default RegisterPage