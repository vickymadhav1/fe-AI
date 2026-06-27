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
  activeMeetingApp: string
  activeWindowTitle: string
  sourceId: string
  sourceName: string
  voiceSource: 'system' | 'microphone' | 'unknown'
  voiceStatus: 'idle' | 'connected' | 'speaking' | 'question' | 'streaming'
  liveQuestion: string
  liveAnswer: string
  liveQuestionType: string
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
    activeMeetingApp: '',
    activeWindowTitle: '',
    sourceId: '',
    sourceName: '',
    voiceSource: 'unknown',
    voiceStatus: 'idle',
    liveQuestion: '',
    liveAnswer: '',
    liveQuestionType: '',
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
    setInterviewSource(sourceId: string, sourceName: string) {
      this.sourceId = sourceId
      this.sourceName = sourceName
    },
    updateActiveMeeting(activeMeetingApp: string, activeWindowTitle: string) {
      this.activeMeetingApp = activeMeetingApp
      this.activeWindowTitle = activeWindowTitle
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
    updateVoicePartial(text: string, source: InterviewState['voiceSource']) {
      this.voiceSource = source
      this.voiceStatus = text.trim() ? 'speaking' : 'connected'
      this.liveQuestion = text
      this.currentQuestion = text
    },
    updateVoiceQuestion(question: string, type: string, source: InterviewState['voiceSource']) {
      this.voiceSource = source
      this.voiceStatus = 'question'
      this.liveQuestion = question
      this.liveQuestionType = type
      this.currentQuestion = question
    },
    updateVoiceAnswer(question: string, answer: string, confidence: number, provider = '') {
      this.voiceStatus = 'streaming'
      this.liveQuestion = question
      this.currentQuestion = question
      this.liveAnswer = answer
      this.answer = answer
      this.confidence = Number.isFinite(confidence)
        ? Math.max(answer.trim() ? 0.7 : 0, Math.min(1, confidence))
        : this.confidence
      this.provider = provider || this.provider
    },
    clearLiveVoice() {
      this.voiceStatus = this.isListening ? 'connected' : 'idle'
      this.liveQuestion = ''
      this.liveAnswer = ''
      this.liveQuestionType = ''
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
       this.screenshotPreviewUrl = result.screenshotPreviewUrl ?? this.screenshotPreviewUrl
    },
    stopInterview() {
      this.isRunning = false
      this.isListening = false
      this.isScreenSharing = false
    },
    clearCurrentOutput() {
      if (this.activeSession) {
        this.activeSession = {
          ...this.activeSession,
          transcripts: [],
          suggestions: [],
          screenContexts: [],
        }
        const sessionIndex = this.sessions.findIndex(
          (session) => session.id === this.activeSession?.id,
        )
        if (sessionIndex >= 0) {
          this.sessions[sessionIndex] = {
            ...this.sessions[sessionIndex]!,
            transcripts: [],
            suggestions: [],
            screenContexts: [],
            _count: { transcripts: 0, suggestions: 0 },
          }
        }
      }
      this.transcript = ''
      this.currentQuestion = ''
      this.answer = ''
      this.code = ''
      this.confidence = 0
      this.provider = ''
      this.lastCapture = ''
      this.ocrStatus = 'idle'
      this.codeDetectionStatus = 'No code detected'
      this.detectedLanguage = ''
      this.ocrCharacterCount = 0
      this.screenshotPreviewUrl = ''
      this.liveQuestion = ''
      this.liveAnswer = ''
      this.liveQuestionType = ''
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
      this.activeMeetingApp = ''
      this.activeWindowTitle = ''
      this.sourceId = ''
      this.sourceName = ''
      this.voiceSource = 'unknown'
      this.voiceStatus = 'idle'
      this.liveQuestion = ''
      this.liveAnswer = ''
      this.liveQuestionType = ''
    },
  },
})
