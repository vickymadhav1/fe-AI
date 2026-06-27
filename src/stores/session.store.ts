import { defineStore } from 'pinia'
import { api } from '@/services/api'
import type { InterviewSession, ScreenContext, Suggestion, Transcript } from '@/types'

let durationInterval = 0

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
  interviewStartTime: string
  elapsedSeconds: number
  purchasedMinutes: number
  purchasedCredits: number
  baseCreditsUsed: number
  creditsPerMinute: number
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
    interviewStartTime: '',
    elapsedSeconds: 0,
    purchasedMinutes: 0,
    purchasedCredits: 0,
    baseCreditsUsed: 0,
    creditsPerMinute: 0,
  }),
  getters: {
    formattedDuration: (state) => {
      const hours = Math.floor(state.elapsedSeconds / 3600)
      const minutes = Math.floor((state.elapsedSeconds % 3600) / 60)
      const seconds = state.elapsedSeconds % 60
      return [hours, minutes, seconds]
        .map((value) => String(value).padStart(2, '0'))
        .join(':')
    },
    durationString(): string {
      return this.formattedDuration
    },
    elapsedMinutes: (state) => Math.floor(state.elapsedSeconds / 60),
    remainingSeconds: (state) =>
      Math.max(0, Math.floor(state.purchasedMinutes * 60) - state.elapsedSeconds),
    remainingMinutes(): number {
      return this.remainingSeconds > 0 ? Math.ceil(this.remainingSeconds / 60) : 0
    },
    formattedRemainingTime(): string {
      const minutes = Math.floor(this.remainingSeconds / 60)
      const seconds = this.remainingSeconds % 60
      return `${minutes}m ${String(seconds).padStart(2, '0')}s`
    },
    consumedCredits: (state) => (state.elapsedSeconds / 60) * state.creditsPerMinute,
    creditsUsed(): number {
      return this.baseCreditsUsed + this.consumedCredits
    },
    remainingCredits(): number {
      return Math.max(0, this.purchasedCredits - this.consumedCredits)
    },
  },
  actions: {
    setPurchasedMinutes(minutes: number) {
      this.purchasedMinutes = Math.max(0, Number.isFinite(minutes) ? minutes : 0)
    },
    setUsageBaseline(input: {
      remainingMinutes: number
      remainingCredits: number
      creditsUsed: number
      creditsPerMinute: number
    }) {
      this.purchasedMinutes = Math.max(0, Number.isFinite(input.remainingMinutes) ? input.remainingMinutes : 0)
      this.purchasedCredits = Math.max(0, Number.isFinite(input.remainingCredits) ? input.remainingCredits : 0)
      this.baseCreditsUsed = Math.max(0, Number.isFinite(input.creditsUsed) ? input.creditsUsed : 0)
      this.creditsPerMinute = Math.max(0, Number.isFinite(input.creditsPerMinute) ? input.creditsPerMinute : 0)
    },
    durationStorageKey(sessionId?: string) {
      const id = sessionId ?? this.sessionId
      return id ? `interview-mate-duration-start:${id}` : ''
    },
    updateElapsedSeconds() {
      if (!this.interviewStartTime) {
        this.elapsedSeconds = 0
        return
      }
      const startedAt = new Date(this.interviewStartTime).getTime()
      this.elapsedSeconds = Number.isFinite(startedAt)
        ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
        : 0
    },
    startDurationTimer(startTime = new Date().toISOString()) {
      if (!this.sessionId) return
      this.interviewStartTime = startTime
      window.localStorage.setItem(this.durationStorageKey(), startTime)
      this.updateElapsedSeconds()
      this.ensureDurationInterval()
    },
    resumeDurationTimer(sessionId?: string) {
      const id = sessionId ?? this.sessionId
      if (!id) return
      const startTime = window.localStorage.getItem(this.durationStorageKey(id))
      if (!startTime) return
      this.interviewStartTime = startTime
      this.updateElapsedSeconds()
      this.ensureDurationInterval()
    },
    ensureDurationInterval() {
      if (durationInterval) return
      durationInterval = window.setInterval(() => {
        this.updateElapsedSeconds()
      }, 1_000)
    },
    stopDurationTimer(options: { clearPersisted?: boolean } = {}) {
      if (durationInterval) {
        window.clearInterval(durationInterval)
        durationInterval = 0
      }
      this.updateElapsedSeconds()
      if (options.clearPersisted) {
        const key = this.durationStorageKey()
        if (key) window.localStorage.removeItem(key)
        this.interviewStartTime = ''
        this.elapsedSeconds = 0
      }
    },
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
        this.resumeDurationTimer(this.activeSession.id)
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
      if (result.interviewStartTime) {
        this.interviewStartTime = result.interviewStartTime
        if (Number.isFinite(result.elapsedSeconds)) {
          this.elapsedSeconds = Math.max(0, Math.floor(Number(result.elapsedSeconds)))
        } else {
          this.updateElapsedSeconds()
        }
        this.ensureDurationInterval()
      }
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
    clearInterviewState(options: { clearTimer?: boolean } = {}) {
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
      if (options.clearTimer) this.stopDurationTimer({ clearPersisted: true })
    },
  },
})
