<script setup lang="ts">
import {
  ArrowPathIcon,
  MicrophoneIcon,
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
import { useAssistantStore } from '@/stores/assistant.store'
import { useSessionStore } from '@/stores/session.store'
import { useTranscriptStore } from '@/stores/transcript.store'
import { useUiStore } from '@/stores/ui.store'
import type { ScreenContext, Suggestion, Transcript } from '@/types'

const route = useRoute()
const router = useRouter()
const sessionStore = useSessionStore()
const transcriptStore = useTranscriptStore()
const assistantStore = useAssistantStore()
const uiStore = useUiStore()
const socket = getSocket()
const { isRunning, isListening, isScreenSharing } = storeToRefs(sessionStore)

const form = ref({ title: '', company: '', role: '' })
const creating = ref(false)
const transcribing = ref(false)
const analyzingScreen = ref(false)
const startingInterview = ref(false)
const endingSession = ref(false)
const activeTab = ref<'answer' | 'code' | 'screenshot'>('answer')
const transcriptPanel = ref<HTMLElement | null>(null)
const isNew = computed(() => route.params.id === 'new')
const latestSuggestion = computed(() => assistantStore.suggestions.at(-1) ?? null)
const activeRequests = new Set<AbortController>()

// Source picker state
const showSourcePicker = ref(false)
const availableSources = ref<CaptureSource[]>([])

let lifecycleId = 0
let screenAnalysisQueue = Promise.resolve()
let audioUploadQueue = Promise.resolve()
let screenshotPreviewUrl = ''

const safeConfidence = (value: unknown) => {
  const confidence = Number(value)
  return Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.8
}

const publishCompanionResult = (suggestion: Suggestion) => {
  window.interviewMateDesktop?.floating.publish({
    question: suggestion.question,
    answer: suggestion.answer,
    code: suggestion.code ?? suggestion.fix ?? '',
    output: suggestion.output ?? '',
    language: suggestion.language ?? '',
    complexity: suggestion.complexity ?? '',
    confidence: safeConfidence(suggestion.confidence),
    provider: suggestion.provider ?? '',
    screenStatus: sessionStore.screenStatus,
    lastCapture: sessionStore.lastCapture,
    timestamp: new Date().toISOString(),
  })
}

const removeSocketListeners = () => {
  socket.off('transcript:update')
  socket.off('question:detected')
  socket.off('answer:generated')
  socket.off('screen:updated')
  socket.off('server:error')
}

const connectSocket = () => {
  removeSocketListeners()
  if (!socket.connected) socket.connect()
  socket.emit('session:join', { sessionId: String(route.params.id) })

  socket.on('transcript:update', (payload) => {
    const transcript = payload as Transcript
    transcriptStore.add(transcript)
    transcriptStore.interimText = ''
    sessionStore.updateTranscript(transcript)
  })
  socket.on('question:detected', (payload) => {
    const question = String((payload as { question?: string }).question ?? '')
    if (question) {
      assistantStore.detectQuestion(question)
      sessionStore.currentQuestion = question
    }
  })
  socket.on('answer:generated', (payload) => {
    const suggestion = payload as Suggestion
    assistantStore.add(suggestion)
    sessionStore.updateSuggestion(suggestion)
    publishCompanionResult(suggestion)
  })
  socket.on('screen:updated', (payload) => {
    const context = payload as ScreenContext
    assistantStore.updateScreenContext(context)
    sessionStore.updateScreenContext(context)
    const latest = assistantStore.suggestions.at(-1)
    if (latest) publishCompanionResult(latest)
  })
  socket.on('server:error', ({ message }) => {
    assistantStore.generating = false
    console.warn('[Realtime] server error', message)
  })
}

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
    await screenAnalyzerService.start(source, handleCaptureFrame, () => {
      sessionStore.setScreenSharing(false)
      uiStore.pushToast({ type: 'info', title: 'Screen share ended' })
    })
    sessionStore.setScreenSharing(true)
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

const startScreenCapture = async (): Promise<void> => {
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

      return
    }

    availableSources.value = sources
    showSourcePicker.value = true

    console.info('[Interview] source picker opened')

    return
  } catch (error) {
    console.error('[Interview] listSources failed', error)

    uiStore.pushToast({
      type: 'error',
      title: 'Screen source discovery failed',
      description: String(error),
    })

    return
  }
}

    // Browser fallback: use background capture via getDisplayMedia
    const started = await screenAnalyzerService.startBackground(handleCaptureFrame)
    if (started) {
      sessionStore.setScreenSharing(true)
      console.info('[Interview] background screen capture active')
    } else {
      console.warn('[Interview] background screen capture unavailable')
      uiStore.pushToast({
        type: 'info',
        title: 'Audio-only mode',
        description: 'Screen access was not granted. Listening will continue normally.',
      })
    }
  } catch (error) {
    sessionStore.setScreenSharing(false)
    console.warn('[Interview] screen capture unavailable; continuing audio-only', error)
    uiStore.pushToast({
      type: 'info',
      title: 'Audio-only mode',
      description: 'Screen access was not granted. Listening will continue normally.',
    })
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

const startAudioCapture = async (runId: number) => {
  const sessionId = sessionStore.activeSession?.id
  if (!sessionId) throw new Error('Session is not available')

  if (isElectronRuntime()) {
    await audioCaptureService.start(
      true,
      (audio) => uploadAudioChunk(sessionId, audio, runId),
      null,
    )
    sessionStore.setListening(true)
    return
  }

  if (!speechService.supported) throw new Error('Speech recognition is unavailable')
  await audioCaptureService.start(false, () => undefined)
  speechService.startRecognition(
    ({ text, isFinal }) => {
      if (!isFinal || !text.trim() || runId !== lifecycleId) return
      socket.emit('transcript:new', {
        sessionId,
        speaker: 'interviewer',
        text: text.trim(),
      })
      assistantStore.generating = true
    },
    () => sessionStore.setListening(false),
  )
  sessionStore.setListening(true)
}

const stopInterviewRuntime = () => {
  lifecycleId += 1
  activeRequests.forEach((controller) => controller.abort())
  activeRequests.clear()
  speechService.stopRecognition()
  audioCaptureService.stop()
  screenAnalyzerService.stop()
  removeSocketListeners()
  socket.disconnect()
  window.interviewMateDesktop?.floating.end()
  sessionStore.stopInterview()
  assistantStore.generating = false
  analyzingScreen.value = false
  transcribing.value = false
  showSourcePicker.value = false
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
  connectSocket()

  try {
    // Start audio capture first (no dependency on screen)
    await startAudioCapture(runId)
    // Then start screen capture (shows picker in Electron, background in browser)
    await startScreenCapture()
    uiStore.pushToast({ type: 'success', title: 'Interview started' })
  } catch (error) {
    console.error('[Interview] startup failed', error)
    stopInterviewRuntime()
    uiStore.pushToast({
      type: 'error',
      title: 'Interview could not start',
      description: 'Audio capture permission is required to begin the interview.',
    })
  } finally {
    startingInterview.value = false
  }
}

const endSession = async () => {
  if (!sessionStore.activeSession || endingSession.value) return
  endingSession.value = true
  stopInterviewRuntime()
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
  if (!isNew.value) void initializeSession(String(route.params.id))
})

onBeforeUnmount(() => {
  stopInterviewRuntime()
  if (screenshotPreviewUrl) URL.revokeObjectURL(screenshotPreviewUrl)
})
</script>

<template>
  <form
    v-if="isNew"
    class="mx-auto max-w-2xl space-y-6 rounded-lg border border-slate-200 bg-white p-8 dark:border-slate-800 dark:bg-slate-900"
    @submit.prevent="createSession"
  >
    <div>
      <h2 class="text-2xl font-bold">Create interview session</h2>
      <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">
        Add basic interview details before opening the live session.
      </p>
    </div>
    <label class="block text-sm font-semibold">
      Session title
      <input v-model="form.title" required class="mt-2 w-full rounded-lg border border-slate-300 bg-transparent px-4 py-3 dark:border-slate-700" placeholder="Frontend Interview" />
    </label>
    <div class="grid gap-4 sm:grid-cols-2">
      <label class="block text-sm font-semibold">
        Company
        <input v-model="form.company" class="mt-2 w-full rounded-lg border border-slate-300 bg-transparent px-4 py-3 dark:border-slate-700" placeholder="Company name" />
      </label>
      <label class="block text-sm font-semibold">
        Role
        <input v-model="form.role" required class="mt-2 w-full rounded-lg border border-slate-300 bg-transparent px-4 py-3 dark:border-slate-700" placeholder="Frontend Developer" />
      </label>
    </div>
    <button class="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-5 py-3 font-semibold text-white disabled:opacity-60" :disabled="creating">
      <ArrowPathIcon v-if="creating" class="h-5 w-5 animate-spin" />
      <MicrophoneIcon v-else class="h-5 w-5" />
      {{ creating ? 'Creating...' : 'Create Session' }}
    </button>
  </form>

  <div v-else-if="sessionStore.loading && !sessionStore.activeSession" class="flex min-h-[480px] items-center justify-center">
    <div class="text-center">
      <ArrowPathIcon class="mx-auto h-8 w-8 animate-spin text-cyan-500" />
      <p class="mt-3 text-sm font-semibold text-slate-600 dark:text-slate-300">Loading live session...</p>
    </div>
  </div>

  <main v-else-if="sessionStore.activeSession" class="flex h-[calc(100vh-8rem)] min-h-[680px] flex-col gap-5">
    <section class="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
      <div>
        <p class="text-xs font-bold uppercase text-cyan-600 dark:text-cyan-400">Workspace</p>
        <h2 class="text-3xl font-bold">Live Session</h2>
        <p class="mt-2 text-slate-500 dark:text-slate-400">
          {{ sessionStore.activeSession.title || 'Interview session' }}
          <span v-if="sessionStore.activeSession.company"> · {{ sessionStore.activeSession.company }}</span>
          <span v-if="sessionStore.activeSession.role"> · {{ sessionStore.activeSession.role }}</span>
        </p>
      </div>

      <div class="flex flex-wrap items-center gap-2">
        <span class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900">
          <span class="h-2.5 w-2.5 rounded-full" :class="isListening ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'"></span>
          {{ isListening ? (transcribing ? 'Transcribing' : 'Listening') : 'Audio idle' }}
        </span>
        <span v-if="sessionStore.lastCapture" class="text-xs text-slate-500 dark:text-slate-400">
          Last capture {{ new Date(sessionStore.lastCapture).toLocaleTimeString() }}
        </span>
        <span class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900">
          <span class="h-2.5 w-2.5 rounded-full" :class="isScreenSharing ? 'animate-pulse bg-emerald-500' : 'bg-slate-400'"></span>
          {{ analyzingScreen ? 'Analyzing screen' : isScreenSharing ? 'Screen active' : 'Screen idle' }}
        </span>
        <span class="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900">
          <span class="h-2.5 w-2.5 rounded-full" :class="assistantStore.generating ? 'animate-pulse bg-cyan-500' : isRunning ? 'bg-emerald-500' : 'bg-slate-400'"></span>
          {{ assistantStore.generating ? 'AI generating' : isRunning ? 'AI active' : 'AI idle' }}
        </span>
      </div>
    </section>

    <section class="grid min-h-0 flex-1 gap-5 xl:grid-cols-[0.9fr_1.1fr]">
      <article class="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h3 class="text-lg font-semibold">Live Transcript</h3>
        </div>

        <div ref="transcriptPanel" class="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <p v-if="!transcriptStore.items.length" class="text-slate-500 dark:text-slate-400">
            Start the interview to capture interviewer questions.
          </p>
          <article
            v-for="item in transcriptStore.items"
            :key="item.id"
            class="border-l-2 border-cyan-500 pl-4"
          >
            <p class="text-xs font-bold uppercase text-slate-400">{{ item.speaker }}</p>
            <p class="mt-2 leading-7 text-slate-900 dark:text-slate-100">{{ item.text }}</p>
          </article>
        </div>
      </article>

      <article class="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div class="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <h3 class="text-lg font-semibold">AI Suggested Answer</h3>
            <div class="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950">
              <button
                class="rounded-md px-4 py-2 text-sm font-semibold transition"
                :class="activeTab === 'answer' ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'"
                @click="activeTab = 'answer'"
              >
                Answer
              </button>
              <button
                class="rounded-md px-4 py-2 text-sm font-semibold transition"
                :class="activeTab === 'code' ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'"
                @click="activeTab = 'code'"
              >
                Code
              </button>
              <button
                class="rounded-md px-4 py-2 text-sm font-semibold transition"
                :class="activeTab === 'screenshot' ? 'bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'"
                @click="activeTab = 'screenshot'"
              >
                Screenshot
              </button>
            </div>
          </div>
        </div>

        <div class="min-h-0 flex-1 overflow-y-auto p-5">
          <div v-if="assistantStore.generating" class="mb-4 rounded-lg border border-cyan-200 bg-cyan-50 p-4 text-sm font-semibold text-cyan-800 dark:border-cyan-900 dark:bg-cyan-950/40 dark:text-cyan-100">
            <span class="mr-2 inline-block h-2 w-2 animate-pulse rounded-full bg-cyan-500"></span>
            AI is preparing a context-aware answer...
          </div>

          <div v-if="!latestSuggestion" class="flex h-full min-h-[360px] items-center justify-center text-center text-slate-500 dark:text-slate-400">
            Suggestions appear automatically when a question, visible code, or coding prompt is detected.
          </div>

          <template v-else-if="activeTab === 'answer'">
            <section class="space-y-5">
              <div>
                <p class="text-xs font-bold uppercase text-cyan-600 dark:text-cyan-400">Question</p>
                <h4 class="mt-2 text-xl font-semibold">{{ latestSuggestion.question }}</h4>
              </div>

              <div v-if="latestSuggestion.output">
                <p class="text-xs font-bold uppercase text-cyan-600 dark:text-cyan-400">Output prediction</p>
                <pre class="mt-2 whitespace-pre-wrap rounded-lg bg-slate-950 p-4 font-mono text-sm text-white">{{ latestSuggestion.output }}</pre>
              </div>

              <div>
                <p class="text-xs font-bold uppercase text-cyan-600 dark:text-cyan-400">Answer</p>
                <p class="mt-2 whitespace-pre-line leading-7 text-slate-700 dark:text-slate-200">{{ latestSuggestion.answer }}</p>
              </div>

              <div v-if="latestSuggestion.rootCause || latestSuggestion.fix" class="grid gap-4 md:grid-cols-2">
                <div v-if="latestSuggestion.rootCause" class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <p class="text-xs font-bold uppercase text-slate-400">Root cause</p>
                  <p class="mt-2 text-sm leading-6">{{ latestSuggestion.rootCause }}</p>
                </div>
                <div v-if="latestSuggestion.fix" class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <p class="text-xs font-bold uppercase text-slate-400">Fix</p>
                  <p class="mt-2 text-sm leading-6">{{ latestSuggestion.fix }}</p>
                </div>
              </div>

              <div v-if="latestSuggestion.complexity">
                <p class="text-xs font-bold uppercase text-cyan-600 dark:text-cyan-400">Complexity</p>
                <p class="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-200">{{ latestSuggestion.complexity }}</p>
              </div>

              <div class="border-t border-slate-200 pt-4 dark:border-slate-800">
                <p class="text-xs font-bold uppercase text-slate-400">Confidence</p>
                <p class="mt-1 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {{ Math.round(latestSuggestion.confidence * 100) }}%
                </p>
              </div>
            </section>
          </template>

          <template v-else-if="activeTab === 'code'">
            <section v-if="latestSuggestion.code || latestSuggestion.fix" class="space-y-4">
              <div class="flex items-center justify-between gap-3">
                <p class="text-xs font-bold uppercase text-cyan-600 dark:text-cyan-400">
                  {{ latestSuggestion.language || 'Code' }}
                </p>
                <span class="rounded bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-300">
                  {{ latestSuggestion.type }}
                </span>
              </div>
              <pre class="max-h-[560px] overflow-auto whitespace-pre rounded-lg bg-slate-950 p-4 font-mono text-sm leading-6 text-slate-100">{{ latestSuggestion.code || latestSuggestion.fix }}</pre>
            </section>
            <div v-else class="flex h-full min-h-[360px] items-center justify-center text-center text-slate-500 dark:text-slate-400">
              No generated code is needed for this answer.
            </div>
          </template>

          <template v-else>
            <section class="space-y-5">
              <div class="grid gap-3 sm:grid-cols-2">
                <div class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <p class="text-xs font-bold uppercase text-slate-400">Last screenshot</p>
                  <p class="mt-2 font-semibold">{{ sessionStore.lastCapture ? new Date(sessionStore.lastCapture).toLocaleString() : 'No capture yet' }}</p>
                </div>
                <div class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <p class="text-xs font-bold uppercase text-slate-400">Language detected</p>
                  <p class="mt-2 font-semibold">{{ sessionStore.detectedLanguage || 'Not detected' }}</p>
                </div>
                <div class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <p class="text-xs font-bold uppercase text-slate-400">Code detection</p>
                  <p class="mt-2 font-semibold">{{ sessionStore.codeDetectionStatus }}</p>
                </div>
                <div class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
                  <p class="text-xs font-bold uppercase text-slate-400">OCR characters</p>
                  <p class="mt-2 font-semibold">{{ sessionStore.ocrCharacterCount }}</p>
                </div>
              </div>
              <div class="overflow-hidden rounded-lg border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-950">
                <img v-if="sessionStore.screenshotPreviewUrl" :src="sessionStore.screenshotPreviewUrl" alt="Latest captured interview screen" class="max-h-[430px] w-full object-contain" />
                <div v-else class="flex min-h-72 items-center justify-center text-slate-500">Screenshot preview appears after screen capture starts.</div>
              </div>
            </section>
          </template>
        </div>
      </article>
    </section>

    <section class="flex flex-wrap items-center gap-3">
      <button
        class="inline-flex min-w-44 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-5 py-3 font-semibold text-white disabled:cursor-wait disabled:opacity-60"
        :disabled="startingInterview || isRunning || sessionStore.activeSession.status !== 'active'"
        @click="startInterview"
      >
        <ArrowPathIcon v-if="startingInterview" class="h-5 w-5 animate-spin" />
        <MicrophoneIcon v-else class="h-5 w-5" />
        {{ isRunning ? 'Interview Running' : startingInterview ? 'Starting...' : 'Start Interview' }}
      </button>
      <button
        v-if="sessionStore.activeSession.status === 'active'"
        class="inline-flex min-w-40 items-center justify-center gap-2 rounded-lg bg-rose-600 px-5 py-3 font-semibold text-white disabled:opacity-60"
        :disabled="endingSession"
        @click="endSession"
      >
        <StopCircleIcon class="h-5 w-5" />
        {{ endingSession ? 'Ending...' : 'End Session' }}
      </button>
    </section>

    <!-- Source picker modal (Electron only) -->
    <div
      v-if="showSourcePicker"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      @click.self="showSourcePicker = false"
    >
      <div class="w-full max-w-2xl rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        <h3 class="text-lg font-bold">Select a screen or window to share</h3>
        <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">Interview Mate AI will capture this source to detect questions and code.</p>

        <div class="mt-5 grid max-h-[420px] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-3">
          <button
            v-for="src in availableSources"
            :key="src.id"
            class="flex flex-col items-center gap-2 rounded-lg border border-slate-200 p-3 text-left transition hover:border-cyan-500 hover:shadow-md dark:border-slate-700 dark:hover:border-cyan-500"
            @click="pickSource(src)"
          >
            <div class="h-24 w-full overflow-hidden rounded bg-slate-100 dark:bg-slate-800">
              <img
                v-if="src.thumbnailDataUrl"
                :src="src.thumbnailDataUrl"
                :alt="src.name"
                class="h-full w-full object-cover"
              />
              <div v-else class="flex h-full items-center justify-center text-xs text-slate-400">No preview</div>
            </div>
            <span class="w-full truncate text-center text-xs font-semibold text-slate-700 dark:text-slate-200">{{ src.name }}</span>
          </button>
        </div>

        <div class="mt-5 flex justify-end">
          <button
            class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            @click="showSourcePicker = false"
          >
            Cancel — continue audio only
          </button>
        </div>
      </div>
    </div>
  </main>
</template>