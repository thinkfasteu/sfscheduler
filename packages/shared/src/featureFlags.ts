/**
 * Feature Flag System for Staff Portal
 * Environment-driven feature toggles for safe deployment
 */

export interface FeatureFlags {
  FEATURE_AVAILABILITY: boolean
  FEATURE_VACATION: boolean
  FEATURE_SWAP: boolean
  FEATURE_SICK: boolean
  FEATURE_HOURS: boolean
  FEATURE_REPORTS: boolean
  FEATURE_METRICS: boolean
}

/**
 * Parse feature flags from environment variable
 * Format: "FEATURE_AVAILABILITY,FEATURE_VACATION,FEATURE_SWAP"
 */
function parseFeatureFlags(flagString?: string): FeatureFlags {
  const enabledFlags = new Set(
    flagString?.split(',').map(flag => flag.trim()) || []
  )

  return {
    FEATURE_AVAILABILITY: enabledFlags.has('FEATURE_AVAILABILITY'),
    FEATURE_VACATION: enabledFlags.has('FEATURE_VACATION'),
    FEATURE_SWAP: enabledFlags.has('FEATURE_SWAP'),
    FEATURE_SICK: enabledFlags.has('FEATURE_SICK'),
    FEATURE_HOURS: enabledFlags.has('FEATURE_HOURS'),
    FEATURE_REPORTS: enabledFlags.has('FEATURE_REPORTS'),
    FEATURE_METRICS: enabledFlags.has('FEATURE_METRICS'),
  }
}

/**
 * Get feature flags from environment
 */
export function getFeatureFlags(): FeatureFlags {
  // Try different environment variable sources
  const flagString = 
    (typeof window !== 'undefined' && (window as any).__CONFIG__?.FEATURE_FLAGS) ||
    (import.meta as any).env?.VITE_APP_FEATURE_FLAGS ||
    process.env?.VITE_APP_FEATURE_FLAGS ||
    process.env?.FEATURE_FLAGS

  return parseFeatureFlags(flagString)
}

/**
 * Check if a specific feature is enabled
 */
export function isFeatureEnabled(feature: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags()
  return flags[feature]
}

/**
 * Hook for using feature flags in components
 */
export function useFeatureFlags(): FeatureFlags {
  return getFeatureFlags()
}

/**
 * Hook for checking a specific feature
 */
export function useFeatureFlag(feature: keyof FeatureFlags): boolean {
  return isFeatureEnabled(feature)
}

// Development helper
export function getEnabledFeatures(): string[] {
  const flags = getFeatureFlags()
  return Object.entries(flags)
    .filter(([_, enabled]) => enabled)
    .map(([feature, _]) => feature)
}