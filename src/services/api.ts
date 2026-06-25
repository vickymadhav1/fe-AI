import axios from 'axios'
import { computed, ref } from 'vue'
import { appConfig } from '@/config/app.config'
import { mockChatHistory, mockCredits, mockInterviews, mockSuggestions } from '@/services/mock-data'
import type { AiProviderHealth, AiSuggestion, ChatMessage, CreateInterviewPayload, Interview, InterviewSession, InvisibleOrderResponse, InvisibleSubscription, ScreenContext, Suggestion, Transcript, User } from '@/types'

export const apiClient = axios.create({
  baseURL: appConfig.apiBaseUrl,
  timeout: 10_000,
})

const pendingApiRequests = ref(0)
const trackedRequests = new WeakSet<object>()
export const apiLoading = computed(() => pendingApiRequests.value > 0)

apiClient.interceptors.request.use(
  (config) => {
    const isBackgroundRequest = ['/screens/analyze', '/transcripts/transcribe'].some((path) =>
      config.url?.includes(path),
    )
    if (!isBackgroundRequest) {
      trackedRequests.add(config)
      pendingApiRequests.value += 1
    }
    const token = localStorage.getItem('interview-mate-token')

    if (token && !config.headers.Authorization) {
      config.headers.Authorization = `Bearer ${token}`
    }

    return config
  },
  (error) => Promise.reject(error),
)

apiClient.interceptors.response.use(
  (response) => {
    if (trackedRequests.has(response.config)) {
      trackedRequests.delete(response.config)
      pendingApiRequests.value = Math.max(0, pendingApiRequests.value - 1)
    }
    return response
  },
  (error) => {
    if (error.config && trackedRequests.has(error.config)) {
      trackedRequests.delete(error.config)
      pendingApiRequests.value = Math.max(0, pendingApiRequests.value - 1)
    }
    if (error.response?.status === 401) {
      localStorage.removeItem('interview-mate-user')
      localStorage.removeItem('interview-mate-token')

      if (window.location.pathname !== '/') {
        window.location.assign('/')
      }
    }

    return Promise.reject(error)
  },
)

const delay = <T>(payload: T, ms = 500) =>
  new Promise<T>((resolve) => {
    window.setTimeout(() => resolve(payload), ms)
  })

export const api = {
  getAiProviderHealth: async (refresh = false): Promise<AiProviderHealth[]> => {
    const path = refresh ? '/health/ai' : '/health'
    return (
      await apiClient.get<{ aiProviders: AiProviderHealth[] }>(path, { timeout: 30_000 })
    ).data.aiProviders
  },
  loginWithGoogle: async (idToken: string): Promise<{ user: User; token: string }> => {
    const response = await apiClient.post<{ success: true; user: User; token: string }>(
      '/auth/firebase',
      { idToken },
    )

    return {
      user: response.data.user,
      token: response.data.token,
    }
  },

  getInterviews: async (): Promise<Interview[]> => {
    return delay([...mockInterviews], 400)
  },

  getCredits: async () => {
    return delay({ ...mockCredits }, 250)
  },

  createInterview: async (payload: CreateInterviewPayload): Promise<Interview> => {
    return delay(
      {
        id: `int_${Date.now()}`,
        ...payload,
        status: 'scheduled',
      },
      800,
    )
  },

  startInterview: async (id: string): Promise<{ sessionId: string; interviewId: string }> => {
    return delay({ sessionId: `session_${Date.now()}`, interviewId: id }, 500)
  },

  getSuggestions: async (interviewId: string): Promise<AiSuggestion[]> => {
    return delay(mockSuggestions.map((item) => ({ ...item, interviewId })), 600)
  },

  getChatHistory: async (interviewId: string): Promise<ChatMessage[]> => {
    return delay(mockChatHistory.map((item) => ({ ...item, interviewId })), 350)
  },

  createSession: async (payload: { title?: string; company?: string; role?: string }) =>
    (await apiClient.post<{ data: InterviewSession }>('/sessions', payload)).data.data,
  getSessions: async () =>
    (await apiClient.get<{ data: InterviewSession[] }>('/sessions')).data.data,
  getSession: async (id: string) =>
    (await apiClient.get<{ data: InterviewSession }>(`/sessions/${id}`)).data.data,
  endSession: async (id: string) =>
    (await apiClient.patch<{ data: InterviewSession }>(`/sessions/${id}/end`)).data.data,
  deleteSession: async (id: string) => apiClient.delete(`/sessions/${id}`),
  getTranscripts: async (id: string) =>
    (await apiClient.get<{ data: Transcript[] }>(`/sessions/${id}/transcripts`)).data.data,
  getSessionSuggestions: async (id: string) =>
    (await apiClient.get<{ data: Suggestion[] }>(`/sessions/${id}/suggestions`)).data.data,
  transcribeAudio: async (
    sessionId: string,
    speaker: 'interviewer' | 'candidate',
    audio: Blob,
    signal?: AbortSignal,
  ) => {
    const form = new FormData()
    form.append('sessionId', sessionId)
    form.append('speaker', speaker)
    form.append('audio', audio, `segment-${Date.now()}.webm`)

    return (
      await apiClient.post<{
        data: {
          transcript: Transcript
          suggestion: Suggestion | null
          suggestionError: string | null
        }
      }>('/transcripts/transcribe', form, {
        timeout: 30_000,
        signal,
      })
    ).data.data
  },
  analyzeScreen: async (
  sessionId: string,
  image: Blob,
  sourceId: string,
  sourceName: string,
  activeMeetingApp: string,
  activeWindowTitle: string,
  signal?: AbortSignal,
) => {
  const form = new FormData()

  form.append('sessionId', sessionId)
  form.append('sourceId', sourceId)
  form.append('sourceName', sourceName)
  form.append('activeMeetingApp', activeMeetingApp)
  form.append('activeWindowTitle', activeWindowTitle)
  form.append('image', image, `screen-${Date.now()}.png`)

  return (
    await apiClient.post<{
      data: {
        context: ScreenContext
        detectedQuestion: string
        suggestion: Suggestion | null
      }
    }>('/screens/analyze', form, {
      timeout: 45_000,
      signal,
    })
  ).data.data
},
  storeTextContext: async (
    sessionId: string,
    source: 'editor' | 'clipboard',
    content: string,
  ) =>
    (
      await apiClient.post<{
        data: { context: ScreenContext; suggestion: Suggestion | null }
      }>('/screens/context', {
        sessionId,
        source,
        content,
      })
    ).data.data,
  getInvisibleSubscription: async () =>
    (await apiClient.get<{ data: InvisibleSubscription }>('/invisible/subscription')).data.data,
  createInvisibleOrder: async (planId = 'invisible_starter') =>
    (
      await apiClient.post<{ data: InvisibleOrderResponse }>('/invisible/orders', {
        planId,
      })
    ).data.data,
  verifyInvisiblePayment: async (payload: {
    razorpayOrderId: string
    razorpayPaymentId: string
    razorpaySignature: string
  }) =>
    (
      await apiClient.post<{ data: InvisibleSubscription }>(
        '/invisible/payments/verify',
        payload,
      )
    ).data.data,
  failInvisiblePayment: async (payload: { razorpayOrderId: string; reason: string }) =>
    (
      await apiClient.post<{ data: InvisibleSubscription }>(
        '/invisible/payments/fail',
        payload,
      )
    ).data.data,
  deductInvisibleCredits: async (minutes = 1) =>
    (
      await apiClient.post<{ data: InvisibleSubscription }>(
        '/invisible/credits/deduct',
        { minutes },
      )
    ).data.data,
  setInvisibleProtection: async (enabled: boolean) =>
    (
      await apiClient.post<{ data: InvisibleSubscription }>(
        '/invisible/protection',
        { enabled },
      )
    ).data.data,
}
