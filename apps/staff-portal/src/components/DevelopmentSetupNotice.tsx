import React from 'react'

interface SetupNoticeProps {
  type: 'info' | 'warning' | 'success'
  title: string
  children: React.ReactNode
}

function SetupNotice({ type, title, children }: SetupNoticeProps) {
  const bgColor = {
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-yellow-50 border-yellow-200', 
    success: 'bg-green-50 border-green-200'
  }[type]

  const textColor = {
    info: 'text-blue-800',
    warning: 'text-yellow-800',
    success: 'text-green-800'
  }[type]

  const iconColor = {
    info: 'text-blue-400',
    warning: 'text-yellow-400',
    success: 'text-green-400'
  }[type]

  const Icon = {
    info: () => (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
      </svg>
    ),
    warning: () => (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
    ),
    success: () => (
      <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
      </svg>
    )
  }[type]

  return (
    <div className={`p-4 border rounded-md ${bgColor}`}>
      <div className="flex">
        <div className={`flex-shrink-0 ${iconColor}`}>
          <Icon />
        </div>
        <div className="ml-3">
          <h3 className={`text-sm font-medium ${textColor}`}>
            {title}
          </h3>
          <div className={`mt-2 text-sm ${textColor}`}>
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}

function DevelopmentSetupNotice() {
  // Check if Supabase is properly configured
  const hasSupabaseConfig = (import.meta as any).env.VITE_SUPABASE_URL && 
                            (import.meta as any).env.VITE_SUPABASE_ANON_KEY &&
                            !(import.meta as any).env.VITE_SUPABASE_URL.includes('development')

  if (hasSupabaseConfig) {
    return (
      <SetupNotice type="success" title="Supabase Configured">
        <p>
          Authentication is ready! You can now register and login with real accounts.
        </p>
      </SetupNotice>
    )
  }

  return (
    <SetupNotice type="warning" title="Development Mode">
      <div className="space-y-3">
        <p>
          <strong>Supabase is not yet configured.</strong> The authentication forms are fully functional, 
          but you'll need to add your Supabase credentials to test the complete flow.
        </p>
        <div className="text-xs">
          <p><strong>Quick Setup:</strong></p>
          <ol className="list-decimal list-inside space-y-1 mt-1">
            <li>Create a Supabase project at <a href="https://supabase.com" target="_blank" rel="noopener noreferrer" className="underline">supabase.com</a></li>
            <li>Copy <code className="bg-yellow-100 px-1 rounded">.env.example</code> to <code className="bg-yellow-100 px-1 rounded">.env.local</code></li>
            <li>Add your Supabase URL and anon key</li>
            <li>Apply database migrations from <code className="bg-yellow-100 px-1 rounded">migrations/</code> folder</li>
          </ol>
        </div>
        <p className="text-xs">
          <strong>Current Status:</strong> UI is fully testable, forms validate correctly, 
          and all translations work. Only the backend connection needs configuration.
        </p>
      </div>
    </SetupNotice>
  )
}

export default DevelopmentSetupNotice