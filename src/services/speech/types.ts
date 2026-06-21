export type SpeechSpeaker = 'interviewer' | 'candidate'

export interface SpeechResult {
  text: string
  isFinal: boolean
}

export interface SpeechRecognitionProvider {
  readonly supported: boolean
  start(onResult: (result: SpeechResult) => void, onError: (message: string) => void): void
  stop(): void
}
