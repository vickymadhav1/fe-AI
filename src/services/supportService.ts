import { apiClient } from './api'
import { appConfig } from '@/config/app.config'
import type { InvisibleSubscription, User } from '@/types'

export type SupportRequestType = 'support' | 'bug' | 'feature'

export interface SupportRequest {
  type: SupportRequestType
  email: string
  message: string
}

export type SupportDiagnostics = Record<string, string | number>

export interface SupportDiagnosticsContext {
  user?: User | null
  subscription?: InvisibleSubscription | null
}

const readStoredUser = (): User | null => {
  try {
    const value = window.localStorage.getItem('interview-mate-user')
    return value ? JSON.parse(value) as User : null
  } catch {
    return null
  }
}

const formatValue = (value: unknown, fallback = 'Not available') => {
  if (value === undefined || value === null || value === '') return fallback
  return String(value)
}

export const collectSupportDiagnostics = (
  context: SupportDiagnosticsContext = {},
): SupportDiagnostics => {
  const user = context.user ?? readStoredUser()
  const subscription = context.subscription ?? null
  const desktop = window.interviewMateDesktop

  return {
    'Application Version': import.meta.env.VITE_APP_VERSION ?? '0.0.0',
    Platform: desktop?.platform ?? navigator.platform,
    Runtime: desktop?.isElectron ? 'Desktop' : 'Web',
    'Current Route': window.location.pathname,
    'User ID': formatValue(user?.id),
    Subscription: formatValue(subscription?.plan?.name, 'No active plan'),
    'Credits Remaining': subscription?.remainingCredits ?? 0,
    'Minutes Remaining': Math.floor(subscription?.remainingMinutes ?? 0),
    Timestamp: new Date().toISOString(),
  }
}

export const submitSupportRequest = async (
  request: SupportRequest,
  context: SupportDiagnosticsContext = {},
) => {
  const diagnostics = collectSupportDiagnostics(context)
  const response = await apiClient.post<{
    data: { ticketId: string; submittedAt: string }
  }>('/support', {
    ...request,
    diagnostics,
  })

  return response.data.data
}

export const getSupportVersionInfo = (): SupportDiagnostics => {
  const desktop = window.interviewMateDesktop

  return {
    'Application Name': appConfig.appName,
    'Application Version': import.meta.env.VITE_APP_VERSION ?? '0.0.0',
    Runtime: desktop?.isElectron ? 'Desktop' : 'Web',
    Platform: desktop?.platform ?? navigator.platform,
  }
}
