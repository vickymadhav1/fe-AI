const requireConfigValue = (key: keyof ImportMetaEnv): string => {
  const value = import.meta.env[key]?.trim()
  if (!value) {
    throw new Error(`Missing frontend environment variable: ${key}`)
  }
  return value
}

export const appConfig = {
  appName: import.meta.env.VITE_APP_NAME ?? 'Interview Mate AI',
  apiBaseUrl: requireConfigValue('VITE_API_BASE_URL'),
  socketUrl: requireConfigValue('VITE_SOCKET_URL'),
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  electron: {
    enabled: false,
    preloadChannel: 'interview-mate-ai',
  },
} as const
