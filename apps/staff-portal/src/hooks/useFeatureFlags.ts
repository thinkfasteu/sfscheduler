// Local feature flags implementation for development
// This will be replaced with the shared package once builds are working

interface FeatureFlags {
  FEATURE_AVAILABILITY: boolean
  FEATURE_VACATION: boolean
  FEATURE_SWAP: boolean
  FEATURE_SICK: boolean
  FEATURE_HOURS: boolean
}

function getFeatureFlags(): FeatureFlags {
  const flagString = (import.meta as any).env?.VITE_APP_FEATURE_FLAGS || ''
  const enabledFlags = new Set(flagString.split(',').map((flag: string) => flag.trim()))

  return {
    FEATURE_AVAILABILITY: enabledFlags.has('FEATURE_AVAILABILITY'),
    FEATURE_VACATION: enabledFlags.has('FEATURE_VACATION'),
    FEATURE_SWAP: enabledFlags.has('FEATURE_SWAP'),
    FEATURE_SICK: enabledFlags.has('FEATURE_SICK'),
    FEATURE_HOURS: enabledFlags.has('FEATURE_HOURS'),
  }
}

export function useFeatureFlag(feature: keyof FeatureFlags): boolean {
  const flags = getFeatureFlags()
  return flags[feature]
}

export function useFeatureFlags(): FeatureFlags {
  return getFeatureFlags()
}