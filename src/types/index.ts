export type ThemeMode = 'light' | 'dark'

export type InterviewStatus = 'scheduled' | 'completed' | 'draft' | 'cancelled'

export type InterviewType = 'Technical' | 'HR' | 'Managerial' | 'System Design' | 'Mock'

export interface User {
  id: string
  firebaseUid?: string
  name: string | null
  email: string
  photo?: string | null
  credits?: number
  createdAt?: string
  updatedAt?: string
  lastLoginAt?: string
  role?: string
  avatarUrl?: string
}

export interface Credits {
  remaining: number
  used: number
  monthlyLimit: number
}

export interface Interview {
  id: string
  company: string
  role: string
  date: string
  time: string
  duration: number
  type: InterviewType
  meetingLink: string
  resumeName: string
  jobDescriptionName: string
  jobDescription: string
  status: InterviewStatus
  score?: number
}

export interface ChatMessage {
  id: string
  interviewId: string
  role: 'candidate' | 'assistant'
  content: string
  createdAt: string
}

export interface AiSuggestion {
  id: string
  interviewId: string
  title: string
  content: string
  confidence: number
}

export interface CreateInterviewPayload {
  company: string
  role: string
  date: string
  time: string
  duration: number
  type: InterviewType
  meetingLink: string
  resumeName: string
  jobDescriptionName: string
  jobDescription: string
}

export interface ToastMessage {
  id: string
  title: string
  description?: string
  type: 'success' | 'error' | 'info'
}

export interface InterviewSession {
  id: string
  userId: string
  title: string | null
  company: string | null
  role: string | null
  status: 'active' | 'completed'
  startedAt: string
  endedAt: string | null
  interviewRunning?: boolean
  activeRunStartedAt?: string | null
  interviewDurationSeconds?: number
  runtimeDurationTracked?: boolean
  createdAt: string
  updatedAt: string
  transcripts?: Transcript[]
  suggestions?: Suggestion[]
  screenContexts?: ScreenContext[]
  _count?: { transcripts: number; suggestions: number }
}

export interface DashboardStatistics {
  wallet: {
    creditsRemaining: number
    minutesRemaining: number
    creditsUsed: number
    totalInterviewMinutes: number
    todayUsageMinutes: number
    currentSessionMinutes: number
  }
  interviews: {
    total: number
    today: number
    completed: number
    codingChallenges: number
    behavioralQuestions: number
    systemDesignQuestions: number
    suggestionsGenerated: number
    averageConfidence: number | null
  }
  currentSession: {
    running: boolean
    sessionId: string | null
  }
  invisibleUsage: {
    remainingMinutes: number
    lastUsedAt: string | null
    progress: number
  }
}

export interface Transcript {
  id: string
  sessionId: string
  speaker: 'interviewer' | 'candidate' | 'system'
  text: string
  createdAt: string
}

export interface Suggestion {
  id: string
  sessionId: string
  question: string
  answer: string
  provider?: string
  type: 'THEORY' | 'CODING' | 'CODING_PROMPT' | 'SYNTAX' | 'DEBUGGING' | 'SYSTEM_DESIGN' | 'SQL' | 'BEHAVIORAL' | 'OUTPUT' | 'OPTIMIZATION'
  code: string | null
  output: string | null
  language: string | null
  complexity: string | null
  rootCause: string | null
  fix: string | null
  analysisMode: 'GENERAL' | 'OUTPUT' | 'BUG_FIX' | 'OPTIMIZATION' | 'LINE_BY_LINE'
  keyPoints: string[]
  confidence: number
  promptDebug: string
  createdAt: string
  live?: boolean
  sequence?: number
}

export interface VoicePartial {
  sessionId: string
  text: string
  isFinal: boolean
  source: 'system' | 'microphone' | 'unknown'
  confidence: number
}

export interface VoiceQuestionDraft {
  sessionId: string
  sequence: number
  question: string
  source: 'voice'
  audioSource: 'system' | 'microphone' | 'unknown'
  classification: {
    type: Suggestion['type']
    confidence: number
  }
  confidence: number
  partial: boolean
}

export interface VoiceAnswerChunk {
  sessionId: string
  sequence: number
  question: string
  answer: string
  provider?: string
  confidence: number
  done: boolean
}

export interface ScreenContext {
  id: string
  sessionId: string
  source: 'screen' | 'editor' | 'clipboard'
  content: string
  rawOcrText: string
  ocrConfidence: number
  captureStatus: 'working' | 'failed'
  ocrStatus: 'pending' | 'working' | 'failed'
  code: string
  language: string
  terminalOutput: string
  errors: string
  detectedQuestion: string
  codeDetected: boolean
  screenshotBytes?: number
  ocrCharacterCount?: number
  languageConfidence?: number
  createdAt: string
}

export type AiProviderStatus = 'healthy' | 'invalid_key' | 'rate_limited' | 'offline' | 'disabled'

export interface AiProviderHealth {
  name: 'groq' | 'gemini' | 'openrouter' | 'together' | 'huggingface'
  configured: boolean
  status: AiProviderStatus
  lastError: string | null
  lastCheckedAt: string | null
  requestCount: number
  successCount: number
  failureCount: number
  disabledForMs: number
}

export type InvisibleSubscriptionStatus =
  | 'inactive'
  | 'pending'
  | 'successful'
  | 'active'
  | 'exhausted'
  | 'failed'

export interface InvisiblePlan {
  id: string
  name: string
  amount: number
  currency: 'INR'
  totalCredits: number
  creditsPerMinute: number
}

export interface InvisibleSubscription {
  active: boolean
  status: InvisibleSubscriptionStatus
  plan: InvisiblePlan
  plans: InvisiblePlan[]
  totalCredits: number
  remainingCredits: number
  creditsUsed: number
  totalMinutes: number
  remainingMinutes: number
  creditsPerMinute: number
  purchaseDate: string | null
  lastUsedAt: string | null
  paymentId: string | null
  orderId: string | null
}

export interface InvisibleOrderResponse {
  keyId: string
  order: {
    id: string
    amount: number
    currency: string
    receipt: string
    status: string
  }
  plan: InvisiblePlan
  subscription: InvisibleSubscription
}
