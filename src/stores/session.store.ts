import { defineStore } from 'pinia'
import { api } from '@/services/api'
import type { InterviewSession, ScreenContext, Suggestion, Transcript } from '@/types'

export interface InterviewState {
  sessions: InterviewSession[]
  activeSession: InterviewSession | null
  loading: boolean
  error: string
  sessionId: string
  isRunning: boolean
  isListening: boolean
  isScreenSharing: boolean
  transcript: string
  currentQuestion: string
  answer: string
  code: string
  confidence: number
  provider: string
  screenStatus: string
  lastCapture: string
  ocrStatus: string
  codeDetectionStatus: string
  detectedLanguage: string
  ocrCharacterCount: number
  screenshotPreviewUrl: string
}

export const useSessionStore = defineStore('sessions', {
  state: (): InterviewState => ({
    sessions: [] as InterviewSession[],
    activeSession: null as InterviewSession | null,
    loading: false,
    error: '',
    sessionId: '',
    isRunning: false,
    isListening: false,
    isScreenSharing: false,
    transcript: '',
    currentQuestion: '',
    answer: '',
    code: '',
    confidence: 0.8,
    provider: '',
    screenStatus: 'No Screen Data',
    lastCapture: '',
    ocrStatus: 'idle',
    codeDetectionStatus: 'No code detected',
    detectedLanguage: '',
    ocrCharacterCount: 0,
    screenshotPreviewUrl: '',
  }),
  actions: {
    async fetchSessions() {
      this.loading = true
      try {
        this.sessions = await api.getSessions()
      } finally {
        this.loading = false
      }
    },
    async createSession(payload: { title?: string; company?: string; role?: string }) {
      this.loading = true
      try {
        const session = await api.createSession(payload)
        this.activeSession = session
        this.sessionId = session.id
        this.sessions.unshift(session)
        return session
      } finally {
        this.loading = false
      }
    },
    async loadSession(id: string) {
      this.loading = true
      try {
        this.activeSession = await api.getSession(id)
        this.sessionId = this.activeSession.id
        return this.activeSession
      } finally {
        this.loading = false
      }
    },
    async endSession(id: string) {
      this.loading = true
      try {
        const session = await api.endSession(id)
        this.activeSession = session
        const index = this.sessions.findIndex((item) => item.id === id)
        if (index >= 0) this.sessions[index] = session
        return session
      } finally {
        this.loading = false
      }
    },
    async deleteSession(id: string) {
      this.loading = true
      try {
        await api.deleteSession(id)
        this.sessions = this.sessions.filter((item) => item.id !== id)
      } finally {
        this.loading = false
      }
    },
    startInterview() {
      this.isRunning = true
    },
    setListening(active: boolean) {
      this.isListening = active
    },
    setScreenSharing(active: boolean) {
      this.isScreenSharing = active
    },
    updateTranscript(item: Transcript) {
      this.transcript = item.text
    },
    updateSuggestion(suggestion: Suggestion) {
      const parsedConfidence = Number(suggestion.confidence)
      this.currentQuestion = suggestion.question
      this.answer = suggestion.answer
      this.code = suggestion.code ?? suggestion.fix ?? ''
      this.confidence = Number.isFinite(parsedConfidence)
        ? Math.max(suggestion.answer.trim() ? 0.7 : 0, Math.min(1, parsedConfidence))
        : 0.8
      this.provider = suggestion.provider ?? ''
    },
    updateScreenContext(context: ScreenContext) {
      this.screenStatus = context.captureStatus === 'working' ? 'Active' : 'No Screen Data'
      this.lastCapture = context.createdAt
      this.ocrStatus = context.ocrStatus
      this.codeDetectionStatus = context.codeDetected
        ? `Code detected${context.language ? `: ${context.language}` : ''}`
        : 'No code detected'
      this.detectedLanguage = context.language
      this.ocrCharacterCount = context.ocrCharacterCount ?? context.rawOcrText.length
    },
    updateScreenshotPreview(url: string, capturedAt: string) {
      this.screenshotPreviewUrl = url
      this.lastCapture = capturedAt
      this.screenStatus = 'Active'
    },
    updateFloatingResult(result: FloatingResult) {
      const parsedConfidence = Number(result.confidence)
      this.currentQuestion = result.question
      this.answer = result.answer
      this.code = result.code
      this.confidence = Number.isFinite(parsedConfidence)
        ? Math.max(result.answer.trim() ? 0.7 : 0, Math.min(1, parsedConfidence))
        : 0.8
      this.provider = result.provider ?? ''
      this.screenStatus = result.screenStatus ?? this.screenStatus
      this.lastCapture = result.lastCapture ?? this.lastCapture
    },
    stopInterview() {
      this.isRunning = false
      this.isListening = false
      this.isScreenSharing = false
    },
    clearInterviewState() {
      this.stopInterview()
      this.transcript = ''
      this.currentQuestion = ''
      this.answer = ''
      this.code = ''
      this.confidence = 0.8
      this.provider = ''
      this.screenStatus = 'No Screen Data'
      this.lastCapture = ''
      this.ocrStatus = 'idle'
      this.codeDetectionStatus = 'No code detected'
      this.detectedLanguage = ''
      this.ocrCharacterCount = 0
      this.screenshotPreviewUrl = ''
    },
  },
})
