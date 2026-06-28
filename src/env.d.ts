/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_APP_NAME?: string
  readonly VITE_APP_VERSION?: string
  readonly VITE_DEV_PORT?: string
  readonly VITE_API_BASE_URL?: string
  readonly VITE_SOCKET_URL?: string
  readonly VITE_GOOGLE_CLIENT_ID?: string
  readonly VITE_RAZORPAY_KEY_ID?: string
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_STORAGE_BUCKET?: string
  readonly VITE_FIREBASE_MESSAGING_SENDER_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
}

interface GoogleCredentialResponse {
  credential?: string
  select_by?: string
}

interface GoogleAccountsId {
  initialize(options: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
  }): void
  prompt(callback?: (notification: unknown) => void): void
  renderButton(
    parent: HTMLElement,
    options: {
      theme?: 'outline' | 'filled_blue' | 'filled_black'
      size?: 'large' | 'medium' | 'small'
      text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
      shape?: 'rectangular' | 'pill' | 'circle' | 'square'
      width?: number
    },
  ): void
  cancel(): void
}

interface Window {
  SpeechRecognition?: new () => unknown
  webkitSpeechRecognition?: new () => unknown
  interviewMateDesktop?: {
    isElectron: boolean
    platform: string
    logging: {
      setContext(context: { sessionId?: string; lifecycleId?: string }): void
    }
    capture: {
      listSources(): Promise<CaptureSource[]>
      saveDebug(bytes: Uint8Array, width: number, height: number): Promise<string>
      getVisibleScreen(): Promise<{
        available: boolean
        reason?: string
        bytes?: Uint8Array
        width?: number
        height?: number
        capturedAt?: string
        debugPath?: string
        sourceName?: string
      }>
    }
    meeting: {
      getActiveWindow(): Promise<ActiveMeetingWindow>
    }
    invisible: {
      setContentProtection(enabled: boolean): Promise<InvisibleProtectionResult>
      getContentProtection(): Promise<InvisibleProtectionResult>
    }
    stealth: {
      restoreWindows(): Promise<StealthProtectionResult>
      setCaptureProtection(enabled: boolean): Promise<StealthProtectionResult>
      registerShortcut(accelerator: string): Promise<{ registered: boolean; accelerator: string }>
      getState(): Promise<StealthProtectionResult & { shortcut: string }>
    }
    floating: {
      getLatest(): Promise<FloatingResult | null>
      publish(result: FloatingResult): void
      start(): void
      end(): void
      minimize(): void
      requestShutdown(): Promise<void>
      getWindowState(): Promise<CompanionWindowState | null>
      setAlwaysOnTop(enabled: boolean): Promise<CompanionWindowState | null>
      setTransparency(value: number): Promise<CompanionWindowState | null>
      copyCode(): void
      onResult(callback: (result: FloatingResult) => void): () => void
      onShutdownRequested(callback: () => void | Promise<void>): () => void
    }
  }
  google?: {
    accounts: {
      id: GoogleAccountsId
    }
  }
  Razorpay?: new (options: RazorpayOptions) => {
    open(): void
    on(event: 'payment.failed', callback: (response: RazorpayFailureResponse) => void): void
  }
}

interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  description: string
  order_id: string
  handler(response: RazorpaySuccessResponse): void
  prefill?: {
    name?: string
    email?: string
  }
  modal?: {
    ondismiss?: () => void
  }
  method?: {
    upi?: boolean
    card?: boolean
    netbanking?: boolean
    wallet?: boolean
    emi?: boolean
    paylater?: boolean
  }
  config?: {
    display?: {
      blocks?: Record<string, {
        name: string
        instruments: Array<{ method: string }>
      }>
      sequence?: string[]
      preferences?: {
        show_default_blocks?: boolean
      }
    }
  }
  theme?: {
    color?: string
  }
}

interface RazorpaySuccessResponse {
  razorpay_order_id: string
  razorpay_payment_id: string
  razorpay_signature: string
}

interface RazorpayFailureResponse {
  error?: {
    description?: string
    reason?: string
  }
}

interface ActiveMeetingWindow {
  activeMeetingApp: string
  activeWindowTitle: string
}

interface InvisibleProtectionResult {
  enabled: boolean
  supported: boolean
  platform: string
  platformName?: string
  warning?: string
}

interface StealthProtectionResult {
  hidden?: boolean
  protected?: boolean
  enabled: boolean
  supported: boolean
  platform: string
  platformName?: string
  nativeBridgeLoaded?: boolean
  nativeProtection?: boolean
  captureExclusion?: boolean
  dockHiding?: boolean
  taskbarHiding?: boolean
  mainWindowProtected?: boolean
  companionWindowProtected?: boolean
  dockHidden?: boolean
  taskbarHidden?: boolean
  activeMeetingApp?: string
  activeWindowTitle?: string
  warning?: string
}

interface CaptureSource {
  id: string
  name: string
  displayId: string
  thumbnailDataUrl: string
}

interface FloatingResult {
  question: string
  answer: string
  code: string
  output: string
  language: string
  complexity: string
  confidence: number
  provider?: string
  screenStatus?: string
  lastCapture?: string
  timestamp: string
  screenshotPreviewUrl?: string
  interviewStartTime?: string
  elapsedSeconds?: number
  formattedDuration?: string
  remainingSeconds?: number
  remainingMinutes?: number
}

interface CompanionWindowState {
  x: number
  y: number
  width: number
  height: number
  alwaysOnTop: boolean
  transparency: number
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<{}, {}, any>
  export default component
}
