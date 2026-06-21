import type { SpeechRecognitionProvider, SpeechResult } from './types'

interface BrowserRecognitionEvent {
  resultIndex: number
  results: ArrayLike<{
    isFinal: boolean
    0: { transcript: string }
  }>
}

interface BrowserSpeechRecognition {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: BrowserRecognitionEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
}

type RecognitionConstructor = new () => BrowserSpeechRecognition

export class WebSpeechProvider implements SpeechRecognitionProvider {
  private recognition: BrowserSpeechRecognition | null = null
  private shouldRestart = false
  private restartTimer = 0
  private errorReported = false

  get supported() {
    return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  }

  start(onResult: (result: SpeechResult) => void, onError: (message: string) => void) {
    const Recognition = (window.SpeechRecognition ||
      window.webkitSpeechRecognition) as RecognitionConstructor | undefined

    if (!Recognition) {
      onError('Web Speech recognition is not available in this browser.')
      return
    }

    this.shouldRestart = true
    this.errorReported = false
    window.clearTimeout(this.restartTimer)
    this.recognition = new Recognition()
    this.recognition.continuous = true
    this.recognition.interimResults = true
    this.recognition.lang = 'en-US'
    this.recognition.onresult = (event) => {
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index]
        if (!result) continue
        onResult({ text: result[0].transcript.trim(), isFinal: result.isFinal })
      }
    }
    this.recognition.onerror = (event) => {
      const fatalErrors = new Set([
        'audio-capture',
        'network',
        'not-allowed',
        'service-not-allowed',
      ])

      if (fatalErrors.has(event.error)) {
        this.shouldRestart = false
      }

      if (event.error === 'aborted' || this.errorReported) return

      this.errorReported = true
      const messages: Record<string, string> = {
        network:
          'The built-in speech service is unavailable in Electron. Listening has been stopped; use the manual question field or configure a server speech provider.',
        'not-allowed': 'Microphone permission was denied. Enable it in System Settings and try again.',
        'service-not-allowed': 'Speech recognition is blocked by the operating system.',
        'audio-capture': 'No microphone input is available.',
        'no-speech': 'No speech was detected. Please try again.',
      }
      onError(messages[event.error] ?? `Speech recognition failed: ${event.error}`)
    }
    this.recognition.onend = () => {
      if (!this.shouldRestart) return

      this.restartTimer = window.setTimeout(() => {
        try {
          this.recognition?.start()
        } catch {
          this.shouldRestart = false
        }
      }, 500)
    }
    this.recognition.start()
  }

  stop() {
    this.shouldRestart = false
    window.clearTimeout(this.restartTimer)
    this.recognition?.stop()
    this.recognition = null
  }
}
