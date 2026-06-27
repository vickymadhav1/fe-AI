<script setup lang="ts">
import {
  ArrowPathIcon,
  BanknotesIcon,
  ClockIcon,
  MicrophoneIcon,
  RocketLaunchIcon,
  ShieldCheckIcon,
  StopCircleIcon,
} from '@heroicons/vue/24/outline'
import { storeToRefs } from 'pinia'
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { audioCaptureService } from '@/services/audio.service'
import { api } from '@/services/api'
import { screenAnalyzerService, type CaptureFrame, type CaptureSource } from '@/services/screen-analyzer.service'
import { getSocket } from '@/services/socket'
import { speechService } from '@/services/speech/speech.service'
import { isElectronRuntime } from '@/services/runtime'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import StealthScreenSharingDialog from '@/components/StealthScreenSharingDialog.vue'
import InterviewHistorySummary from '@/components/interview/InterviewHistorySummary.vue'
import { useAssistantStore } from '@/stores/assistant.store'
import { useSessionStore } from '@/stores/session.store'
import { useSubscriptionStore } from '@/stores/subscription.store'
import { useTranscriptStore } from '@/stores/transcript.store'
import { useUiStore } from '@/stores/ui.store'
import type {
  ScreenContext,
  Suggestion,
  Transcript,
  VoiceAnswerChunk,
  VoicePartial,
  VoiceQuestionDraft,
} from '@/types'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const transcriptStore = useTranscriptStore()
const assistantStore = useAssistantStore()
const subscriptionStore = useSubscriptionStore()
const uiStore = useUiStore()
const socket = getSocket()
const { isRunning, isListening, isScreenSharing } = storeToRefs(sessionStore)

const form = ref({ title: '', company: '', role: '' })
const creating = ref(false)
const transcribing = ref(false)
const analyzingScreen = ref(false)
const startingInterview = ref(false)
const endingSession = ref(false)
const clearingCurrentInterview = ref(false)
const activeTab = ref<'answer' | 'code' | 'screenshot'>('answer')
const transcriptPanel = ref<HTMLElement | null>(null)
const isNew = computed(() => route.params.id === 'new')
const totalHistoryCount = computed(() => sessionStore.sessions.length)
const historySummaryLoading = computed(() => sessionStore.loading && !sessionStore.sessions.length)
const creditsRemaining = computed(() => subscriptionStore.subscription?.remainingCredits ?? 0)
const minutesRemaining = computed(() =>
  Math.floor(subscriptionStore.subscription?.remainingMinutes ?? 0),
)
const latestSuggestion = computed(() => assistantStore.liveSuggestion ?? assistantStore.suggestions.at(-1) ?? null)
const activeRequests = new Set<AbortController>()
const hasCurrentOutput = computed(
  () =>
    transcriptStore.items.length > 0 ||
    Boolean(transcriptStore.interimText) ||
    Boolean(latestSuggestion.value) ||
    Boolean(sessionStore.currentQuestion) ||
    Boolean(sessionStore.answer) ||
    Boolean(sessionStore.code) ||
    Boolean(sessionStore.lastCapture) ||
    Boolean(sessionStore.screenshotPreviewUrl),
)

// Source picker state
const showSourcePicker = ref(false)
const availableSources = ref<CaptureSource[]>([])
const showStealthDialog = ref(false)
const showClearConfirmation = ref(false)
const rememberStealthChoice = ref(true)

let lifecycleId = 0
let screenAnalysisQueue = Promise.resolve()
let audioUploadQueue = Promise.resolve()
let screenshotPreviewUrl = ''
let activeMeetingPollTimer = 0
let capturePausedForUnsupportedWindow = false
let stealthModeActive = false
let pendingStealthMode = false
let previousInvisibleState = false
let resolveStealthDialog: ((enabled: boolean) => void) | null = null
let liveVoiceSequence = 0
let speechFinalTimer = 0

const safeConfidence = (value: unknown) => {
  const confidence = Number(value)
  return Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.8
}

const clearAnswerForQuestion = (question: string) => {
  sessionStore.currentQuestion = question
  sessionStore.liveQuestion = question
  sessionStore.answer = ''
  sessionStore.liveAnswer = ''
  sessionStore.code = ''
  sessionStore.provider = ''
  sessionStore.confidence = 0
}

const createLiveSuggestion = (payload: {
  id?: string
  sessionId: string
  sequence?: number
  question: string
  answer: string
  provider?: string
  confidence?: number
  type?: Suggestion['type']
  code?: string | null
  output?: string | null
  language?: string | null
  complexity?: string | null
  rootCause?: string | null
  fix?: string | null
  keyPoints?: string[]
  analysisMode?: Suggestion['analysisMode']
  promptDebug?: string
  createdAt?: string
}): Suggestion => ({
  id: payload.id ?? `voice-live-${payload.sequence ?? Date.now()}`,
  sessionId: payload.sessionId,
  question: payload.question,
  answer: payload.answer,
  provider: payload.provider,
  type: payload.type ?? 'THEORY',
  code: payload.code ?? null,
  output: payload.output ?? null,
  language: payload.language ?? null,
  complexity: payload.complexity ?? null,
  rootCause: payload.rootCause ?? null,
  fix: payload.fix ?? null,
  analysisMode: payload.analysisMode ?? 'GENERAL',
  promptDebug: payload.promptDebug ?? 'Live voice draft',
  keyPoints: payload.keyPoints ?? [],
  confidence: safeConfidence(payload.confidence ?? 0.72),
  createdAt: payload.createdAt ?? new Date().toISOString(),
  live: true,
  sequence: payload.sequence,
})

const publishCompanionState = (payload: {
  question: string
  answer?: string
  code?: string | null
  output?: string | null
  language?: string | null
  complexity?: string | null
  confidence?: number
  provider?: string | null
  reason: string
}) => {
  const result = {
    question: payload.question,
    answer: payload.answer ?? '',
    code: payload.code ?? '',
    output: payload.output ?? '',
    language: payload.language ?? '',
    complexity: payload.complexity ?? '',
    confidence: safeConfidence(payload.confidence ?? 0),
    provider: payload.provider ?? '',
    screenStatus: sessionStore.screenStatus,
    lastCapture: sessionStore.lastCapture,
    screenshotPreviewUrl: sessionStore.screenshotPreviewUrl ?? '',
    timestamp: new Date().toISOString(),
  }
  console.info('[CompanionSync] update sent', {
    reason: payload.reason,
    question: result.question,
    answerLength: result.answer.length,
    provider: result.provider || 'pending',
  })
  window.interviewMateDesktop?.floating.publish(result)
}

const publishCompanionQuestion = (question: string, reason: string) => {
  publishCompanionState({
    question,
    answer: '',
    confidence: 0,
    provider: '',
    reason,
  })
}

const publishCompanionResult = (suggestion: Suggestion, reason = 'ai-response') => {
  console.info('[CompanionSync] AI response received', {
    reason,
    question: suggestion.question,
    answerLength: suggestion.answer.length,
  })
  publishCompanionState({
    question: suggestion.question,
    answer: suggestion.answer,
    code: suggestion.code ?? suggestion.fix ?? '',
    output: suggestion.output ?? '',
    language: suggestion.language ?? '',
    complexity: suggestion.complexity ?? '',
    confidence: suggestion.confidence,
    provider: suggestion.provider ?? '',
    reason,
  })
}

const removeSocketListeners = () => {
  socket.off('transcript:update')
  socket.off('question:detected')
  socket.off('answer:generated')
  socket.off('voice:partial')
  socket.off('voice:question')
  socket.off('voice:answer:chunk')
  socket.off('voice:answer:complete')
  socket.off('screen:updated')
  socket.off('interview:started')
  socket.off('interview:stopped')
  socket.off('server:error')
}

const connectSocket = () => {
  removeSocketListeners()
  if (!socket.connected) socket.connect()
  socket.emit('session:join', { sessionId: String(route.params.id) })

  socket.on('transcript:update', (payload) => {
    const transcript = payload as Transcript
    console.info('[CompanionSync] transcript updated', {
      sessionId: transcript.sessionId,
      speaker: transcript.speaker,
      length: transcript.text.length,
    })
    transcriptStore.add(transcript)
    transcriptStore.interimText = ''
    sessionStore.updateTranscript(transcript)
  })
  socket.on('question:detected', (payload) => {
    const question = String((payload as { question?: string }).question ?? '')
    if (question) {
      console.info('[CompanionSync] question detected', { question })
      assistantStore.detectQuestion(question)
      clearAnswerForQuestion(question)
      publishCompanionQuestion(question, 'question-detected')
    }
  })
  socket.on('answer:generated', (payload) => {
    const suggestion = payload as Suggestion
    assistantStore.add(suggestion)
    sessionStore.updateSuggestion(suggestion)
    publishCompanionResult(suggestion, 'answer-generated')
  })
  socket.on('voice:partial', (payload) => {
    const partial = payload as VoicePartial
    if (partial.text) {
      console.info('[Voice] Partial Transcript Updated')
      sessionStore.updateVoicePartial(partial.text, partial.source)
      transcriptStore.interimText = partial.text
    }
  })
  socket.on('voice:question', (payload) => {
    const draft = payload as VoiceQuestionDraft
    console.info('[CompanionSync] question detected', {
      source: 'voice',
      question: draft.question,
      sequence: draft.sequence,
    })
    assistantStore.detectQuestion(draft.question)
    sessionStore.updateVoiceQuestion(
      draft.question,
      draft.classification.type,
      draft.audioSource,
    )
    clearAnswerForQuestion(draft.question)
    const liveSuggestion = createLiveSuggestion({
      sessionId: draft.sessionId,
      sequence: draft.sequence,
      question: draft.question,
      answer: '',
      confidence: draft.confidence,
      type: draft.classification.type,
    })
    assistantStore.updateLiveSuggestion(liveSuggestion)
    publishCompanionQuestion(draft.question, 'voice-question')
  })
  socket.on('voice:answer:chunk', (payload) => {
    const chunk = payload as VoiceAnswerChunk
    console.info('[CompanionSync] AI request/stream update received', {
      question: chunk.question,
      sequence: chunk.sequence,
      answerLength: chunk.answer.length,
      done: chunk.done,
    })
    const liveSuggestion = createLiveSuggestion({
      sessionId: chunk.sessionId,
      sequence: chunk.sequence,
      question: chunk.question,
      answer: chunk.answer,
      provider: chunk.provider,
      confidence: chunk.confidence,
    })
    assistantStore.updateLiveSuggestion(liveSuggestion)
    sessionStore.updateVoiceAnswer(
      chunk.question,
      chunk.answer,
      chunk.confidence,
      chunk.provider,
    )
    publishCompanionResult(liveSuggestion, 'voice-answer-chunk')
  })
  socket.on('voice:answer:complete', (payload) => {
    const suggestion = payload as Suggestion
    console.info('[CompanionSync] AI response complete', {
      question: suggestion.question,
      answerLength: suggestion.answer.length,
    })
    const liveSuggestion = createLiveSuggestion({
      ...suggestion,
      answer: suggestion.answer,
      confidence: suggestion.confidence,
    })
    assistantStore.updateLiveSuggestion(liveSuggestion)
    sessionStore.updateVoiceAnswer(
      liveSuggestion.question,
      liveSuggestion.answer,
      liveSuggestion.confidence,
      liveSuggestion.provider,
    )
    publishCompanionResult(liveSuggestion, 'voice-answer-complete')
  })
  socket.on('screen:updated', (payload) => {
    const context = payload as ScreenContext
    assistantStore.updateScreenContext(context)
    sessionStore.updateScreenContext(context)
    console.info('[CompanionSync] screen context updated', {
      sessionId: context.sessionId,
      detectedQuestion: context.detectedQuestion,
      codeDetected: context.codeDetected,
    })
    const latest = assistantStore.liveSuggestion ?? assistantStore.suggestions.at(-1)
    if (latest) publishCompanionResult(latest, 'screen-updated')
    else if (sessionStore.currentQuestion) {
      publishCompanionQuestion(sessionStore.currentQuestion, 'screen-updated')
    }
  })
  socket.on('interview:started', (payload) => {
    const result = payload as {
      activeMeetingApp?: string
      activeWindowTitle?: string
    }
    sessionStore.updateActiveMeeting(
      result.activeMeetingApp ?? sessionStore.activeMeetingApp,
      result.activeWindowTitle ?? sessionStore.activeWindowTitle,
    )
  })
  socket.on('interview:stopped', () => {
    console.info('[Interview] Analysis pipeline stopped')
  })
  socket.on('server:error', ({ message }) => {
    assistantStore.generating = false
    console.warn('[Realtime] server error', message)
  })
}

const detectActiveMeeting = async () => {
  const activeWindow = await window.interviewMateDesktop?.meeting.getActiveWindow()
  if (!activeWindow) return

  const previousMeetingApp = sessionStore.activeMeetingApp
  sessionStore.updateActiveMeeting(
    activeWindow.activeMeetingApp,
    activeWindow.activeWindowTitle,
  )

  if (activeWindow.activeMeetingApp && activeWindow.activeMeetingApp !== previousMeetingApp) {
    console.info(`[Interview] Active Meeting Detected: ${activeWindow.activeMeetingApp}`)
  }
}

const validateActiveMeetingForCapture = async () => {
  const activeWindow = await window.interviewMateDesktop?.meeting.getActiveWindow()
  if (!activeWindow?.activeMeetingApp) {
    const activeWindowTitle = activeWindow?.activeWindowTitle ?? ''
    sessionStore.updateActiveMeeting('', activeWindowTitle)
    console.info('[Capture] Unsupported Window - Capture Skipped')
    console.info('[Capture] Waiting for Supported Meeting Application')
    capturePausedForUnsupportedWindow = true
    return false
  }

  console.info(`[Capture] Active Window: ${activeWindow.activeMeetingApp}`)
  sessionStore.updateActiveMeeting(
    activeWindow.activeMeetingApp,
    activeWindow.activeWindowTitle,
  )

  if (capturePausedForUnsupportedWindow) {
    console.info('[Capture] Resumed')
  }
  capturePausedForUnsupportedWindow = false
  return true
}

const startActiveMeetingPolling = () => {
  window.clearInterval(activeMeetingPollTimer)
  void detectActiveMeeting()
  activeMeetingPollTimer = window.setInterval(() => {
    if (sessionStore.isRunning) void detectActiveMeeting()
  }, 3_000)
}

const stopActiveMeetingPolling = () => {
  window.clearInterval(activeMeetingPollTimer)
  activeMeetingPollTimer = 0
}

const emitInterviewStarted = () => {
  const sessionId = sessionStore.activeSession?.id
  if (!sessionId) return
  const desktopPlatform = window.interviewMateDesktop?.platform ?? ''

  socket.emit('interview:start', {
    sessionId,
    sourceId: sessionStore.sourceId,
    sourceName: sessionStore.sourceName,
    activeMeetingApp: sessionStore.activeMeetingApp,
    activeWindowTitle: sessionStore.activeWindowTitle,
    stealthMode: stealthModeActive || pendingStealthMode,
    stealthPlatform: desktopPlatform,
    stealthProtectionSupported: desktopPlatform === 'darwin' || desktopPlatform === 'win32',
  })
}

const emitInterviewStopped = () =>
  new Promise<void>((resolve) => {
  const sessionId = sessionStore.activeSession?.id
    if (!sessionId || !socket.connected) {
      resolve()
      return
    }

    socket.timeout(1_000).emit('interview:stop', { sessionId }, () => resolve())
  })

const initializeSession = async (sessionId: string) => {
  transcriptStore.clear()
  assistantStore.clear()
  sessionStore.clearInterviewState()
  await Promise.all([
    sessionStore.loadSession(sessionId),
    transcriptStore.load(sessionId),
    assistantStore.load(sessionId),
  ])

  const latestTranscript = transcriptStore.items.at(-1)
  if (latestTranscript) sessionStore.updateTranscript(latestTranscript)
  const latestContext = sessionStore.activeSession?.screenContexts?.[0]
  if (latestContext) {
    assistantStore.updateScreenContext(latestContext)
    sessionStore.updateScreenContext(latestContext)
  }
  const latestAnswer = assistantStore.suggestions.at(-1)
  if (latestAnswer) {
    sessionStore.updateSuggestion(latestAnswer)
    publishCompanionResult(latestAnswer)
  }
  connectSocket()
}

const clearCurrentInterviewState = () => {
  console.info('[Interview] Clear State Before Update', {
    transcribing: transcribing.value,
    analyzingScreen: analyzingScreen.value,
    aiGenerating: assistantStore.generating,
    transcriptLength: transcriptStore.items.length,
    suggestionLength: assistantStore.suggestions.length,
  })

  activeRequests.forEach((controller) => controller.abort())
  activeRequests.clear()
  screenAnalysisQueue = Promise.resolve()
  audioUploadQueue = Promise.resolve()
  transcribing.value = false
  analyzingScreen.value = false
  transcriptStore.clear()
  assistantStore.clear()
  sessionStore.clearCurrentOutput()
  activeTab.value = 'answer'

  if (screenshotPreviewUrl) {
    URL.revokeObjectURL(screenshotPreviewUrl)
    screenshotPreviewUrl = ''
  }

  window.interviewMateDesktop?.floating.publish({
    question: '',
    answer: '',
    code: '',
    output: '',
    language: '',
    complexity: '',
    confidence: 0,
    provider: '',
    screenStatus: sessionStore.screenStatus,
    lastCapture: '',
    screenshotPreviewUrl: '',
    timestamp: new Date().toISOString(),
  })

  console.info('[Interview] Clear State After Update', {
    transcribing: transcribing.value,
    analyzingScreen: analyzingScreen.value,
    aiGenerating: assistantStore.generating,
    transcriptLength: transcriptStore.items.length,
    suggestionLength: assistantStore.suggestions.length,
  })
}

const clearCurrentInterview = async () => {
  console.info('[Interview] Clear Button Clicked')
  const sessionId = sessionStore.activeSession?.id
  if (!sessionId) {
    uiStore.pushToast({
      type: 'error',
      title: 'Nothing to clear',
      description: 'No active interview session is available.',
    })
    return
  }
  if (!socket.connected) {
    uiStore.pushToast({
      type: 'error',
      title: 'Could not clear interview',
      description: 'The realtime connection is offline. Reconnect and try again.',
    })
    return
  }

  clearingCurrentInterview.value = true
  console.info('[Interview] Clear Event Emitted', { sessionId })
  try {
    activeRequests.forEach((controller) => controller.abort())
    activeRequests.clear()
    transcribing.value = false
    analyzingScreen.value = false

    const response = await new Promise<{
      success: boolean
      message?: string
      data?: {
        cleared: boolean
        session: typeof sessionStore.activeSession
        deleted: {
          transcripts: number
          suggestions: number
          screenContexts: number
        }
      }
    }>((resolve, reject) => {
      socket.timeout(15_000).emit(
        'interview:clear',
        { sessionId },
        (error: Error | null, acknowledgement: typeof response) => {
          if (error) {
            reject(error)
            return
          }
          resolve(acknowledgement)
        },
      )
    })
    if (!response.success || !response.data?.cleared) {
      throw new Error(response.message || 'The backend could not clear the interview state.')
    }

    console.info('[Interview] Clear Acknowledgement Received', {
      sessionId,
      deleted: response.data.deleted,
    })
    if (response.data.session) {
      sessionStore.activeSession = response.data.session
    }
    clearCurrentInterviewState()
    uiStore.pushToast({
      type: 'success',
      title: 'Current interview cleared',
      description: 'Session details and account credits were preserved.',
    })
  } catch (error) {
    console.error('[Interview] Clear Request Failed', error)
    uiStore.pushToast({
      type: 'error',
      title: 'Could not clear interview',
      description:
        error instanceof Error ? error.message : 'The realtime request failed. Try again.',
    })
  } finally {
    clearingCurrentInterview.value = false
  }
}

const requestClearCurrentInterview = () => {
  showClearConfirmation.value = true
}

const confirmClearCurrentInterview = () => {
  showClearConfirmation.value = false
  void clearCurrentInterview()
}

const createSession = async () => {
  creating.value = true
  try {
    const session = await sessionStore.createSession({
      title: form.value.title || undefined,
      company: form.value.company || undefined,
      role: form.value.role || undefined,
    })
    await router.replace(`/sessions/${session.id}`)
    await initializeSession(session.id)
  } catch {
    uiStore.pushToast({ type: 'error', title: 'Could not create session' })
  } finally {
    creating.value = false
  }
}

const handleCaptureFrame = (frame: CaptureFrame) => {
  const sessionId = sessionStore.activeSession?.id
  const runId = lifecycleId
  if (!sessionId || !isRunning.value) return
console.log('ANALYZE_SCREEN_CALLED')
  if (screenshotPreviewUrl) URL.revokeObjectURL(screenshotPreviewUrl)
  screenshotPreviewUrl = URL.createObjectURL(frame.image)
  sessionStore.updateScreenshotPreview(screenshotPreviewUrl, frame.capturedAt)
  console.info('[Capture] Screenshot Captured')

  console.info('[ScreenAnalysis] capture diagnostics', {
    screenshotSize: frame.image.size,
    width: frame.width,
    height: frame.height,
    changed: frame.changed,
    blank: frame.blank,
    likelyTechnical: frame.likelyTechnical,
  })

  if (frame.blank || !frame.changed) return

  screenAnalysisQueue = screenAnalysisQueue.then(async () => {
    if (runId !== lifecycleId || !isRunning.value) return
    const controller = new AbortController()
    activeRequests.add(controller)
    analyzingScreen.value = true
    try {
      console.info('[ScreenAnalysis] OCR and code detection requested')
      await api.analyzeScreen(
  sessionId,
  frame.image,
  frame.sourceId,
  frame.sourceName,
  sessionStore.activeMeetingApp,
  sessionStore.activeWindowTitle,
  controller.signal,
)
      console.info('[ScreenAnalysis] OCR, code detection, and AI prompt completed')
    } catch (error) {
      if (controller.signal.aborted) return
      console.error('[ScreenAnalysis] backend analysis failed', error)
      const status = (error as { response?: { status?: number } }).response?.status
      if (status && ([401, 403, 429].includes(status) || status >= 500)) {
        uiStore.pushToast({
          type: 'error',
          title: 'Screen analysis failed',
          description: 'The interview will continue with audio while screen analysis retries.',
        })
      }
    } finally {
      activeRequests.delete(controller)
      if (runId === lifecycleId) analyzingScreen.value = false
    }
  })
}

// Called when user picks a source from the picker modal
const pickSource = async (source: CaptureSource) => {
    showSourcePicker.value = false
    try {
      sessionStore.setInterviewSource(source.id, source.name)
    const sharedStream = await screenAnalyzerService.start(source, handleCaptureFrame, () => {
      sessionStore.setScreenSharing(false)
      uiStore.pushToast({ type: 'info', title: 'Screen share ended' })
    }, validateActiveMeetingForCapture)
    const sessionId = sessionStore.activeSession?.id
    if (sessionId && isRunning.value) {
      await audioCaptureService.start(
        true,
        (audio) => uploadAudioChunk(sessionId, audio, lifecycleId),
        sharedStream,
      )
      sessionStore.voiceSource = audioCaptureService.getSourceKind()
    }
    sessionStore.setScreenSharing(true)
    emitInterviewStarted()
    if (pendingStealthMode) await activateStealthMode()
    console.info('[Interview] screen capture active via source picker', source.name)
  } catch (error) {
    sessionStore.setScreenSharing(false)
    console.warn('[Interview] screen capture failed after source selection', error)
    uiStore.pushToast({
      type: 'info',
      title: 'Audio-only mode',
      description: 'Screen capture could not start. Listening will continue normally.',
    })
  }
}

const cancelSourcePicker = () => {
  showSourcePicker.value = false
  pendingStealthMode = false
  if (sessionStore.isRunning) emitInterviewStarted()
}

const askForStealthMode = () => {
  if (uiStore.stealthSettings.autoEnable) return Promise.resolve(true)
  if (!uiStore.stealthSettings.askBeforeInterview) return Promise.resolve(false)
  console.info('[Stealth] Screen Sharing Dialog Displayed')
  showStealthDialog.value = true
  rememberStealthChoice.value = true
  return new Promise<boolean>((resolve) => {
    resolveStealthDialog = resolve
  })
}

const chooseStealthMode = (enabled: boolean) => {
  showStealthDialog.value = false
  if (rememberStealthChoice.value) {
    uiStore.updateStealthSettings({
      autoEnable: enabled,
      askBeforeInterview: false,
    })
  }
  resolveStealthDialog?.(enabled)
  resolveStealthDialog = null
}

const activateStealthMode = async () => {
  if (!pendingStealthMode || stealthModeActive) return
  pendingStealthMode = false
  stealthModeActive = true
  console.info('[Stealth] User Selected Stealth Mode')
  previousInvisibleState = Boolean((await window.interviewMateDesktop?.invisible.getContentProtection())?.enabled)
  const invisibleResult = await window.interviewMateDesktop?.invisible.setContentProtection(true)
  const stealthResult = await window.interviewMateDesktop?.stealth.setCaptureProtection(true)
  console.info('[Stealth] Protection Enabled')
  console.info('[Stealth] Main Window Protected')
  console.info('[Stealth] Companion Protected')
  console.info('[Stealth] Viewer Capture Exclusion Applied')
  if (stealthResult?.supported === false || invisibleResult?.supported === false) {
    uiStore.pushToast({
      type: 'info',
      title: 'Stealth protection is limited',
      description:
        stealthResult?.warning ??
        invisibleResult?.warning ??
        'This platform or meeting application may not fully hide Interview Mate AI from shared-screen viewers.',
    })
  }
  console.info('[Stealth] Background Processing Active')
}

const restoreStealthMode = async () => {
  if (!stealthModeActive && !pendingStealthMode) return
  pendingStealthMode = false
  stealthModeActive = false
  await window.interviewMateDesktop?.stealth.setCaptureProtection(false)
  await window.interviewMateDesktop?.invisible.setContentProtection(previousInvisibleState)
}

const startScreenCapture = async (): Promise<'pending-picker' | 'started' | 'unavailable'> => {
  try {
    console.info('[Interview] requesting screen capture')

   if (isElectronRuntime()) {
  console.info('[Interview] requesting capture sources')

  try {
    const sources = await screenAnalyzerService.listSources()

    console.info('[Interview] source count:', sources.length)
    console.table(
      sources.map((s) => ({
        id: s.id,
        name: s.name,
        displayId: s.displayId,
      })),
    )

    if (!sources.length) {
      console.error('[Interview] capture:list-sources returned 0 sources')

      uiStore.pushToast({
        type: 'info',
        title: 'No screens found',
        description:
          'Electron returned zero capture sources. Check preload and IPC wiring.',
      })

      return 'unavailable'
    }

    availableSources.value = sources
    showSourcePicker.value = true

    console.info('[Interview] source picker opened')

    return 'pending-picker'
  } catch (error) {
    console.error('[Interview] listSources failed', error)

    uiStore.pushToast({
      type: 'error',
      title: 'Screen source discovery failed',
      description: String(error),
    })

    return 'unavailable'
  }
}

    // Browser fallback: use background capture via getDisplayMedia
    const started = await screenAnalyzerService.startBackground(
      handleCaptureFrame,
      validateActiveMeetingForCapture,
    )
    if (started) {
      sessionStore.setInterviewSource('', 'Visible screen')
      sessionStore.setScreenSharing(true)
      console.info('[Interview] background screen capture active')
      return 'started'
    } else {
      console.warn('[Interview] background screen capture unavailable')
      uiStore.pushToast({
        type: 'info',
        title: 'Audio-only mode',
        description: 'Screen access was not granted. Listening will continue normally.',
      })
      return 'unavailable'
    }
  } catch (error) {
    sessionStore.setScreenSharing(false)
    console.warn('[Interview] screen capture unavailable; continuing audio-only', error)
    uiStore.pushToast({
      type: 'info',
      title: 'Audio-only mode',
      description: 'Screen access was not granted. Listening will continue normally.',
    })
    return 'unavailable'
  }
}

const uploadAudioChunk = (sessionId: string, audio: Blob, runId: number) => {
  audioUploadQueue = audioUploadQueue.then(async () => {
    if (runId !== lifecycleId || !isRunning.value) return
    const controller = new AbortController()
    activeRequests.add(controller)
    transcribing.value = true
    try {
      const result = await api.transcribeAudio(
        sessionId,
        'interviewer',
        audio,
        controller.signal,
      )
      console.info('[CompanionSync] transcript HTTP response received', {
        sessionId,
        transcriptLength: result.transcript.text.length,
        hasSuggestion: Boolean(result.suggestion),
      })
      transcriptStore.add(result.transcript)
      transcriptStore.interimText = ''
      sessionStore.updateTranscript(result.transcript)
      if (result.suggestion) {
        assistantStore.add(result.suggestion)
        sessionStore.updateSuggestion(result.suggestion)
        publishCompanionResult(result.suggestion, 'transcribe-http-response')
      }
      if (result.suggestionError) {
        assistantStore.generating = false
        console.warn('[Assistant] provider failover exhausted for this question')
      }
    } catch (error) {
      if (controller.signal.aborted) return
      const status = (error as { response?: { status?: number } }).response?.status
      if (status && ([401, 403, 429].includes(status) || status >= 500)) {
        uiStore.pushToast({
          type: 'error',
          title: 'Transcription failed',
          description: 'Interviewer audio could not be transcribed. Listening remains active.',
        })
      }
    } finally {
      activeRequests.delete(controller)
      if (runId === lifecycleId) transcribing.value = false
    }
  })
}

const emitVoicePartial = (
  sessionId: string,
  text: string,
  isFinal: boolean,
  runId: number,
) => {
  const normalized = text.trim().replace(/\s+/g, ' ')
  if (!normalized || runId !== lifecycleId || !socket.connected) return

  if (!isFinal) {
    console.info('[Voice] Interviewer Speaking')
    console.info('[Voice] Partial Transcript Updated')
  }

  socket.emit('voice:partial', {
    sessionId,
    text: normalized,
    isFinal,
    source: audioCaptureService.getSourceKind(),
    confidence: isFinal ? 0.86 : 0.68,
  })
}

const startStreamingSpeechRecognition = (
  sessionId: string,
  runId: number,
  persistFinalTranscript: boolean,
) => {
  if (!speechService.supported) return false

  speechService.startRecognition(
    ({ text, isFinal }) => {
      if (!text.trim() || runId !== lifecycleId) return
      window.clearTimeout(speechFinalTimer)
      emitVoicePartial(sessionId, text, isFinal, runId)
      if (!isFinal) {
        speechFinalTimer = window.setTimeout(() => {
          emitVoicePartial(sessionId, text, true, runId)
        }, 1_100)
        return
      }

      if (persistFinalTranscript) {
        socket.emit('transcript:new', {
          sessionId,
          speaker: 'interviewer',
          text: text.trim(),
        })
        assistantStore.generating = true
      }
    },
    () => sessionStore.setListening(false),
  )
  console.info('[Speech] Streaming Started')
  return true
}

const startAudioCapture = async (runId: number) => {
  const sessionId = sessionStore.activeSession?.id
  if (!sessionId) throw new Error('Session is not available')

  if (isElectronRuntime()) {
    await audioCaptureService.start(
      true,
      (audio) => uploadAudioChunk(sessionId, audio, runId),
      null,
    )
    startStreamingSpeechRecognition(sessionId, runId, false)
    sessionStore.setListening(true)
    return
  }

  await audioCaptureService.start(false, () => undefined)
  if (!startStreamingSpeechRecognition(sessionId, runId, true)) {
    throw new Error('Speech recognition is unavailable')
  }
  sessionStore.setListening(true)
}

const stopInterviewRuntime = async (notifyBackend = true) => {
  await restoreStealthMode()
  if (notifyBackend && sessionStore.isRunning) await emitInterviewStopped()
  lifecycleId += 1
  activeRequests.forEach((controller) => controller.abort())
  activeRequests.clear()
  stopActiveMeetingPolling()
  window.clearTimeout(speechFinalTimer)
  speechService.stopRecognition()
  audioCaptureService.stop()
  screenAnalyzerService.stop()
  removeSocketListeners()
  socket.disconnect()
  window.interviewMateDesktop?.floating.end()
  console.info('[Interview] Companion Closed')
  sessionStore.stopInterview()
  assistantStore.generating = false
  analyzingScreen.value = false
  transcribing.value = false
  showSourcePicker.value = false
  showStealthDialog.value = false
  showClearConfirmation.value = false
  resolveStealthDialog?.(false)
  resolveStealthDialog = null
  capturePausedForUnsupportedWindow = false
  screenAnalysisQueue = Promise.resolve()
  audioUploadQueue = Promise.resolve()
}

const startInterview = async () => {
  if (startingInterview.value || isRunning.value || !sessionStore.activeSession) return
  startingInterview.value = true
  lifecycleId += 1
  const runId = lifecycleId
  sessionStore.startInterview()
  window.interviewMateDesktop?.floating.start()
  console.info('[Interview] Companion Opened')
  connectSocket()
  startActiveMeetingPolling()

  try {
    // Start audio capture first (no dependency on screen)
    await startAudioCapture(runId)
    console.info('[Stealth] Permissions Granted')
    pendingStealthMode = await askForStealthMode()
    // Then start screen capture (shows picker in Electron, background in browser)
    const screenStatus = await startScreenCapture()
    if (screenStatus !== 'pending-picker') emitInterviewStarted()
    if (pendingStealthMode && screenStatus !== 'pending-picker') await activateStealthMode()
    console.info('[Interview] Started')
    uiStore.pushToast({ type: 'success', title: 'Interview started' })
  } catch (error) {
    console.error('[Interview] startup failed', error)
    await stopInterviewRuntime()
    uiStore.pushToast({
      type: 'error',
      title: 'Interview could not start',
      description: 'Audio capture permission is required to begin the interview.',
    })
  } finally {
    startingInterview.value = false
  }
}

const stopInterview = async () => {
  await stopInterviewRuntime()
  console.info('[Interview] Stopped')
  uiStore.pushToast({ type: 'info', title: 'Interview stopped' })
}

const endSession = async () => {
  if (!sessionStore.activeSession || endingSession.value) return
  endingSession.value = true
  await stopInterviewRuntime()
  try {
    await sessionStore.endSession(sessionStore.activeSession.id)
    uiStore.pushToast({ type: 'success', title: 'Session ended and saved' })
  } finally {
    endingSession.value = false
  }
}

watch(
  () => transcriptStore.items.length,
  async () => {
    await nextTick()
    transcriptPanel.value?.scrollTo({ top: transcriptPanel.value.scrollHeight, behavior: 'smooth' })
  },
)

onMounted(() => {
  void subscriptionStore.load()
  if (isNew.value) void sessionStore.fetchSessions().catch(() => undefined)
  if (!isNew.value) void initializeSession(String(route.params.id))
})

onBeforeUnmount(() => {
  void stopInterviewRuntime()
  if (screenshotPreviewUrl) URL.revokeObjectURL(screenshotPreviewUrl)
})
</script>

<template>
  <section v-if="isNew" class="im-live-onboarding-page space-y-5">
    <!-- <div>
      <p class="text-[12px] font-bold uppercase tracking-[0.12em] text-violet-300">Workspace</p>
      <h1 class="mt-1.5 text-[32px] font-extrabold leading-none text-slate-50">Live Interview</h1>
      <p class="mt-2 text-[14px] font-medium text-slate-300">
        Start an AI-powered interview session with real-time assistance.
      </p>
    </div> -->

    <section class="relative flex min-h-[112px] overflow-hidden rounded-[18px] border border-violet-400/25 bg-[linear-gradient(110deg,rgba(26,16,55,.96),rgba(10,16,29,.96)_42%,rgba(15,33,63,.94))] px-5 py-4">
      <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_50%,rgba(124,58,237,.28),transparent_28%),radial-gradient(circle_at_86%_42%,rgba(34,211,238,.12),transparent_28%)]"></div>
      <div class="relative z-10 flex w-full flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div class="flex min-w-0 items-center gap-4">
          <div class="hidden h-16 w-16 shrink-0 items-center justify-center rounded-2xl border border-violet-300/20 bg-violet-400/10 text-violet-200 sm:flex">
            <MicrophoneIcon class="h-9 w-9" />
          </div>
          <div class="min-w-0">
            <h2 class="text-[21px] font-extrabold text-slate-50">Live Interview</h2>
            <p class="mt-2 line-clamp-2 max-w-2xl text-[14px] font-medium leading-5 text-slate-300">
              Start an AI-powered interview session with real-time OCR, coding challenge detection, and intelligent answer generation.
            </p>
          </div>
        </div>

        <div class="grid shrink-0 gap-3 sm:grid-cols-2">
          <div class="min-w-[176px] rounded-[14px] border border-[#263347] bg-[#111827]/80 px-4 py-3">
            <div class="flex items-center gap-3">
              <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/10 text-cyan-300">
                <BanknotesIcon class="h-[18px] w-[18px]" />
              </span>
              <div>
                <p class="text-[12px] font-medium text-slate-400">Credits Remaining</p>
                <p class="mt-1 text-[24px] font-extrabold leading-none text-slate-50">{{ creditsRemaining }}</p>
              </div>
            </div>
          </div>
          <div class="min-w-[176px] rounded-[14px] border border-[#263347] bg-[#111827]/80 px-4 py-3">
            <div class="flex items-center gap-3">
              <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-400/10 text-emerald-300">
                <ClockIcon class="h-[18px] w-[18px]" />
              </span>
              <div>
                <p class="text-[12px] font-medium text-slate-400">Minutes Remaining</p>
                <p class="mt-1 text-[24px] font-extrabold leading-none text-slate-50">{{ minutesRemaining }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <form
      class="mx-auto max-w-4xl rounded-[18px] border border-[#263347] bg-[#0e1422] p-6 shadow-[0_22px_70px_rgba(0,0,0,.24)]"
      @submit.prevent="createSession"
    >
      <div class="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h2 class="text-[22px] font-extrabold text-slate-50">Create Interview Session</h2>
        <InterviewHistorySummary
          :total-interviews="totalHistoryCount"
          :is-loading="historySummaryLoading"
        />
      </div>
      <div>
        <p class="mt-2 text-[14px] font-medium text-slate-400">
          Add basic interview details before opening the live session.
        </p>
      </div>

      <div class="mt-5 border-t border-[#263347] pt-4">
        <label class="block text-[14px] font-bold text-slate-100">
          Session Title
          <input
            v-model="form.title"
            required
            class="mt-2 h-[46px] w-full rounded-xl border border-violet-400/70 bg-white/[0.04] px-4 text-slate-100 outline-none transition focus:border-cyan-400"
            placeholder="e.g. Frontend Interview"
          />
        </label>

        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <label class="block text-[14px] font-bold text-slate-100">
            Company
            <input
              v-model="form.company"
              class="mt-2 h-[46px] w-full rounded-xl border border-[#334155] bg-white/[0.04] px-4 text-slate-100 outline-none transition focus:border-cyan-400"
              placeholder="e.g. Google, Microsoft"
            />
          </label>
          <label class="block text-[14px] font-bold text-slate-100">
            Role
            <input
              v-model="form.role"
              required
              class="mt-2 h-[46px] w-full rounded-xl border border-[#334155] bg-white/[0.04] px-4 text-slate-100 outline-none transition focus:border-cyan-400"
              placeholder="e.g. Frontend Developer"
            />
          </label>
        </div>
      </div>

      <div class="mt-5 flex justify-center">
        <button
          class="inline-flex h-12 w-full items-center justify-center gap-3 rounded-[10px] bg-[linear-gradient(90deg,#7c3aed,#2f80ed)] px-8 text-[15px] font-extrabold text-white transition hover:scale-[1.01] disabled:opacity-60 sm:w-auto sm:min-w-[360px]"
          :disabled="creating"
        >
          <ArrowPathIcon v-if="creating" class="h-5 w-5" />
          <RocketLaunchIcon v-else class="h-5 w-5" />
          {{ creating ? 'Creating...' : 'Start Live Interview' }}
        </button>
      </div>
    </form>

    <p class="mt-[-4px] flex items-center justify-center gap-2 text-[14px] font-medium text-slate-400">
      <ShieldCheckIcon class="h-5 w-5 text-violet-300" />
      Your session is secure and private. We never store your interview data.
    </p>
  </section>

  <div v-else-if="sessionStore.loading && !sessionStore.activeSession" class="flex min-h-480px items-center justify-center">
    <div class="w-full max-w-4xl space-y-4">
      <SkeletonBlock class="h-12 w-64" />
      <div class="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <SkeletonBlock class="h-96 w-full" />
        <SkeletonBlock class="h-96 w-full" />
      </div>
    </div>
  </div>

  <main v-else-if="sessionStore.activeSession" class="im-prototype-page !min-h-0 h-full max-h-full overflow-hidden flex flex-col gap-4">
    <!-- <section class="flex min-h-[82px] items-center justify-between rounded-[18px] border border-[#1e293b] bg-[#0b111d] px-8">
      <div>
        <h2 class="text-[36px] font-extrabold leading-none text-slate-50">Live Interview</h2>
        <p class="mt-2 text-[13px] font-medium text-slate-500">
          {{ sessionStore.activeSession.title || 'Interview session' }}
          <span v-if="sessionStore.activeSession.company"> · {{ sessionStore.activeSession.company }}</span>
          <span v-if="sessionStore.activeSession.role"> · {{ sessionStore.activeSession.role }}</span>
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <span class="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-slate-200">
          <span class="h-2.5 w-2.5 rounded-full" :class="isListening ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'"></span>
          {{ isListening ? (transcribing ? 'Transcribing' : 'Listening') : 'Audio idle' }}
        </span>
        <span v-if="sessionStore.lastCapture" class="text-xs text-slate-500">
          Last capture {{ new Date(sessionStore.lastCapture).toLocaleTimeString() }}
        </span>
        <span class="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-slate-200">
          <span class="h-2.5 w-2.5 rounded-full" :class="isScreenSharing ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'"></span>
          {{ analyzingScreen ? 'Analyzing screen' : isScreenSharing ? 'Screen active' : 'Screen idle' }}
        </span>
        <span class="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-slate-200">
          <span class="h-2.5 w-2.5 rounded-full" :class="assistantStore.generating ? 'animate-pulse bg-cyan-500' : isRunning ? 'bg-emerald-500' : 'bg-slate-400'"></span>
          {{ assistantStore.generating ? 'AI generating' : isRunning ? 'AI active' : 'AI idle' }}
        </span>
        <span
          v-if="isListening"
          class="inline-flex items-center gap-2 rounded-xl border border-cyan-300/20 bg-cyan-400/10 px-3 py-2 text-sm font-bold text-cyan-100"
        >
          <span class="h-2.5 w-2.5 rounded-full animate-pulse bg-cyan-300"></span>
          Voice {{ sessionStore.voiceStatus }} · {{ sessionStore.voiceSource }}
        </span>
        <span
          v-if="sessionStore.activeMeetingApp || sessionStore.activeWindowTitle"
          class="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-slate-200"
        >
          {{ sessionStore.activeMeetingApp || 'Active window' }}
        </span>
      </div>
    </section> -->

    <section class="grid min-h-0 flex-1 grid-cols-1 grid-rows-2 gap-4 lg:grid-cols-[minmax(300px,0.82fr)_minmax(380px,1.18fr)] lg:grid-rows-1">
      <article class="min-h-0 overflow-hidden rounded-2xl border border-[#263347] bg-[#0e1422] flex flex-col">
        <div class="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 px-6 py-5">
          <h3 class="text-[18px] font-bold text-slate-50">Live Transcript</h3>
          <button
            type="button"
            class="inline-flex h-8 items-center justify-center rounded-lg border border-rose-400/20 bg-rose-500/[0.07] px-3 text-[12px] font-bold text-rose-200 transition hover:border-rose-300/40 hover:bg-rose-500/15 disabled:cursor-not-allowed disabled:opacity-40"
            :disabled="clearingCurrentInterview || !hasCurrentOutput"
            title="Clear current transcript and AI suggestions"
            @click="requestClearCurrentInterview"
          >
            Clear
          </button>
        </div>

        <div ref="transcriptPanel" class="im-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
          <div
            v-if="transcribing && !transcriptStore.items.length && !transcriptStore.interimText"
            class="space-y-5"
          >
            <article v-for="item in 4" :key="item" class="rounded-xl bg-[#0f172a] p-5">
              <SkeletonBlock class="h-3 w-24" />
              <SkeletonBlock class="mt-3 h-4 w-full" />
              <SkeletonBlock class="mt-2 h-4 w-4/5" />
            </article>
          </div>
          <div
            v-else-if="!transcriptStore.items.length && !transcriptStore.interimText"
            class="flex h-full min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-[#334155] px-6 text-center"
          >
            <p class="text-[14px] font-bold text-slate-200">No transcript yet.</p>
            <p class="mt-2 text-[12px] text-slate-500">Start an interview to begin capturing conversation.</p>
          </div>
          <article
            v-if="transcriptStore.interimText"
            class="rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-4"
          >
            <p class="text-xs font-bold uppercase text-cyan-300">Interviewer speaking</p>
            <p class="mt-2 leading-7 text-slate-100">{{ transcriptStore.interimText }}</p>
          </article>
          <article
            v-for="item in transcriptStore.items"
            :key="item.id"
            class="rounded-xl bg-[#0f172a] p-5"
          >
            <p class="text-xs font-bold uppercase text-slate-400">{{ item.speaker }}</p>
            <p class="mt-2 leading-7 text-slate-100">{{ item.text }}</p>
          </article>
        </div>
      </article>

      <article class="min-h-0 overflow-hidden rounded-2xl border border-[#263347] bg-[#0e1422] flex flex-col">
        <div class="shrink-0 border-b border-white/10 px-6 py-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-[18px] font-bold text-slate-50">AI Suggested Answer</h3>
            <div class="inline-flex rounded-xl border border-white/10 bg-black/20 p-1">
              <button
                class="rounded-md px-4 py-2 text-sm font-semibold transition"
                :class="activeTab === 'answer' ? 'bg-white/10 text-slate-50 shadow-sm' : 'text-slate-500 hover:text-slate-100'"
                @click="activeTab = 'answer'"
              >
                Answer
              </button>
              <button
                class="rounded-md px-4 py-2 text-sm font-semibold transition"
                :class="activeTab === 'code' ? 'bg-white/10 text-slate-50 shadow-sm' : 'text-slate-500 hover:text-slate-100'"
                @click="activeTab = 'code'"
              >
                Code
              </button>
              <button
                class="rounded-md px-4 py-2 text-sm font-semibold transition"
                :class="activeTab === 'screenshot' ? 'bg-white/10 text-slate-50 shadow-sm' : 'text-slate-500 hover:text-slate-100'"
                @click="activeTab = 'screenshot'"
              >
                Screenshot
              </button>
            </div>
          </div>
        </div>

        <div class="im-scrollbar min-h-0 flex-1 overflow-y-auto p-6">
          <div v-if="assistantStore.generating && !latestSuggestion" class="space-y-5">
            <SkeletonBlock class="h-4 w-56" />
            <SkeletonBlock class="mt-3 h-4 w-full" />
            <SkeletonBlock class="mt-2 h-4 w-3/4" />
          </div>
          <div
            v-if="sessionStore.liveAnswer && assistantStore.liveSuggestion?.live"
            class="mb-4 rounded-xl border border-cyan-300/20 bg-cyan-400/10 p-4"
          >
            <p class="text-xs font-bold uppercase text-cyan-300">
              Live voice answer · {{ sessionStore.liveQuestionType || 'Detecting' }}
            </p>
            <p class="mt-2 text-sm text-slate-300">
              Refining as the interviewer speaks.
            </p>
          </div>

          <div
            v-if="!latestSuggestion && !assistantStore.generating && activeTab !== 'screenshot'"
            class="flex h-full min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-[#334155] px-6 text-center"
          >
            <p class="text-[14px] font-bold text-slate-200">
              {{ activeTab === 'code' ? 'No generated code available.' : 'No AI suggestions available.' }}
            </p>
            <p class="mt-2 text-[12px] text-slate-500">
              {{ activeTab === 'code' ? 'Code will appear when a coding question is detected.' : 'Suggestions will appear once questions are detected.' }}
            </p>
          </div>

          <template v-if="activeTab === 'answer' && latestSuggestion">
            <section class="space-y-5">
              <div>
                <p class="text-xs font-bold uppercase text-cyan-300">Question</p>
                <h4 class="mt-2 text-xl font-semibold">{{ latestSuggestion.question }}</h4>
              </div>

              <div v-if="latestSuggestion.output">
                <p class="text-xs font-bold uppercase text-cyan-300">Output prediction</p>
                <pre class="mt-2 whitespace-pre-wrap rounded-lg bg-slate-950 p-4 font-mono text-sm text-white">{{ latestSuggestion.output }}</pre>
              </div>

              <div>
                <p class="text-xs font-bold uppercase text-cyan-300">Answer</p>
                <p class="mt-2 whitespace-pre-line leading-7 text-slate-200">{{ latestSuggestion.answer }}</p>
              </div>

              <div v-if="latestSuggestion.rootCause || latestSuggestion.fix" class="grid gap-4 md:grid-cols-2">
                <div v-if="latestSuggestion.rootCause" class="im-card-soft p-4">
                  <p class="text-xs font-bold uppercase text-slate-400">Root cause</p>
                  <p class="mt-2 text-sm leading-6">{{ latestSuggestion.rootCause }}</p>
                </div>
                <div v-if="latestSuggestion.fix" class="im-card-soft p-4">
                  <p class="text-xs font-bold uppercase text-slate-400">Fix</p>
                  <p class="mt-2 text-sm leading-6">{{ latestSuggestion.fix }}</p>
                </div>
              </div>

              <div v-if="latestSuggestion.complexity">
                <p class="text-xs font-bold uppercase text-cyan-300">Complexity</p>
                <p class="mt-2 text-sm leading-6 text-slate-200">{{ latestSuggestion.complexity }}</p>
              </div>

              <div class="border-t border-white/10 pt-4">
                <p class="text-xs font-bold uppercase text-slate-400">Confidence</p>
                <p class="mt-1 text-2xl font-bold text-emerald-300">
                  {{ Math.round(latestSuggestion.confidence * 100) }}%
                </p>
              </div>
            </section>
          </template>

          <template v-if="activeTab === 'code' && latestSuggestion">
            <section v-if="latestSuggestion.code || latestSuggestion.fix" class="space-y-4">
              <div class="flex items-center justify-between gap-3">
                <p class="text-xs font-bold uppercase text-cyan-300">
                  {{ latestSuggestion.language || 'Code' }}
                </p>
                <span class="rounded bg-white/10 px-2 py-1 text-xs font-bold text-slate-300">
                  {{ latestSuggestion.type }}
                </span>
              </div>
              <pre class="max-h-560px overflow-auto whitespace-pre rounded-lg bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100">{{ latestSuggestion.code || latestSuggestion.fix }}</pre>
            </section>
            <div v-else class="flex h-full min-h-360px items-center justify-center text-center text-slate-500">
              No generated code is needed for this answer.
            </div>
          </template>

          <template v-if="activeTab === 'screenshot'">
            <section v-if="analyzingScreen" class="space-y-5">
              <SkeletonBlock class="h-16 w-full rounded-xl" />
              <SkeletonBlock class="h-72 w-full rounded-xl" />
            </section>
            <section v-else-if="sessionStore.screenshotPreviewUrl" class="space-y-5">
              <div class="grid gap-3 sm:grid-cols-2">
                <div class="im-card-soft p-4">
                  <p class="text-xs font-bold uppercase text-slate-400">Last screenshot</p>
                  <p class="mt-2 font-semibold">{{ sessionStore.lastCapture ? new Date(sessionStore.lastCapture).toLocaleString() : 'No capture yet' }}</p>
                </div>
                <div class="im-card-soft p-4">
                  <p class="text-xs font-bold uppercase text-slate-400">Language detected</p>
                  <p class="mt-2 font-semibold">{{ sessionStore.detectedLanguage || 'Not detected' }}</p>
                </div>
                <div class="im-card-soft p-4">
                  <p class="text-xs font-bold uppercase text-slate-400">Code detection</p>
                  <p class="mt-2 font-semibold">{{ sessionStore.codeDetectionStatus }}</p>
                </div>
                <div class="im-card-soft p-4">
                  <p class="text-xs font-bold uppercase text-slate-400">OCR characters</p>
                  <p class="mt-2 font-semibold">{{ sessionStore.ocrCharacterCount }}</p>
                </div>
              </div>
              <div class="overflow-hidden rounded-xl border border-white/10 bg-black/30">
                <img :src="sessionStore.screenshotPreviewUrl" alt="Latest captured interview screen" class="max-h-430px w-full object-contain" />
              </div>
            </section>
            <div
              v-else
              class="flex h-full min-h-48 flex-col items-center justify-center rounded-xl border border-dashed border-[#334155] px-6 text-center"
            >
              <p class="text-[14px] font-bold text-slate-200">No screenshot analysis available.</p>
              <p class="mt-2 text-[12px] text-slate-500">The latest analyzed capture will appear here.</p>
            </div>
          </template>
        </div>
      </article>

    </section>

    <section class="flex shrink-0 flex-wrap items-center gap-3">
      <button
        class="im-button im-button-primary inline-flex min-w-44 disabled:cursor-wait disabled:opacity-60"
        :disabled="startingInterview || isRunning || sessionStore.activeSession.status !== 'active'"
        @click="startInterview"
      >
        <ArrowPathIcon v-if="startingInterview" class="h-5 w-5" />
        <MicrophoneIcon v-else class="h-5 w-5" />
        {{ isRunning ? 'Interview Running' : startingInterview ? 'Starting...' : 'Start Interview' }}
      </button>
      <button
        v-if="isRunning"
        class="im-button inline-flex min-w-40"
        @click="stopInterview"
      >
        <StopCircleIcon class="h-5 w-5" />
        Stop Interview
      </button>
      <button
        v-if="sessionStore.activeSession.status === 'active'"
        class="im-button inline-flex min-w-40 border-rose-400/20 bg-rose-500/20 text-rose-100 disabled:opacity-60"
        :disabled="endingSession"
        @click="endSession"
      >
        <StopCircleIcon class="h-5 w-5" />
        {{ endingSession ? 'Ending...' : 'End Session' }}
      </button>
    </section>

    <div
      v-if="showClearConfirmation"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="clear-interview-title"
      @click.self="showClearConfirmation = false"
    >
      <div class="w-full max-w-md rounded-2xl border border-[#334155] bg-[#0e1422] p-6 shadow-2xl shadow-black/50">
        <h3 id="clear-interview-title" class="text-[18px] font-bold text-slate-50">
          Clear current interview?
        </h3>
        <p class="mt-3 text-[13px] leading-6 text-slate-400">
          This permanently removes the current transcript, AI suggestions, code, and screenshot analysis. Session details and credits are preserved.
        </p>
        <div class="mt-6 flex justify-end gap-3">
          <button
            type="button"
            class="im-button"
            @click="showClearConfirmation = false"
          >
            Cancel
          </button>
          <button
            type="button"
            class="im-button border-rose-400/25 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30"
            @click="confirmClearCurrentInterview"
          >
            Clear Interview
          </button>
        </div>
      </div>
    </div>

    <!-- Source picker modal (Electron only) -->
    <StealthScreenSharingDialog
      v-if="showStealthDialog"
      v-model:remember="rememberStealthChoice"
      @choose="chooseStealthMode"
    />

    <div
      v-if="showSourcePicker"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      @click.self="cancelSourcePicker"
    >
      <div class="im-card w-full max-w-2xl p-6">
        <h3 class="text-lg font-bold">Select a screen or window to share</h3>
        <p class="mt-1 text-sm text-slate-500">Interview Mate AI will capture this source to detect questions and code.</p>

        <div class="mt-5 grid max-h-420px grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
          <button
            v-for="src in availableSources"
            :key="src.id"
            class="im-card-soft flex flex-col items-center gap-2 p-3 text-left transition hover:border-cyan-300/50"
            @click="pickSource(src)"
          >
            <div class="h-24 w-full overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
              <img
                v-if="src.thumbnailDataUrl"
                :src="src.thumbnailDataUrl"
                :alt="src.name"
                class="h-full w-full object-cover"
              />
              <div v-else class="flex h-full items-center justify-center text-xs text-slate-500">No preview</div>
            </div>
            <span class="w-full truncate text-center text-xs font-semibold text-slate-200">{{ src.name }}</span>
          </button>
        </div>

        <div class="mt-5 flex justify-end">
          <button
            class="im-button"
            @click="cancelSourcePicker"
          >
            Cancel — continue audio only
          </button>
        </div>
      </div>
    </div>
  </main>
</template>
