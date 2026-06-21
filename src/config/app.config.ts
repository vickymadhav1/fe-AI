export const appConfig = {
  appName: import.meta.env.VITE_APP_NAME ?? 'Interview Mate AI',
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000/api',
  socketUrl: import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:8000',
  googleClientId: import.meta.env.VITE_GOOGLE_CLIENT_ID ?? '',
  providers: {
    openai: import.meta.env.VITE_OPENAI_API_KEY ?? 'OPENAI_API_KEY',
    groq: import.meta.env.VITE_GROQ_API_KEY ?? 'GROQ_API_KEY',
    openrouter: import.meta.env.VITE_OPENROUTER_API_KEY ?? 'OPENROUTER_API_KEY',
  },
  electron: {
    enabled: false,
    preloadChannel: 'interview-mate-ai',
  },
} as const
