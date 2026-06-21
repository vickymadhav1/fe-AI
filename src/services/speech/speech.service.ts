import { WebSpeechProvider } from './web-speech.provider'
import type { SpeechRecognitionProvider, SpeechResult } from './types'

class SpeechService {
  constructor(private provider: SpeechRecognitionProvider = new WebSpeechProvider()) {}

  get supported() {
    return this.provider.supported
  }

  startRecognition(
    onResult: (result: SpeechResult) => void,
    onError: (message: string) => void,
  ) {
    this.provider.start(onResult, onError)
  }

  stopRecognition() {
    this.provider.stop()
  }
}

export const speechService = new SpeechService()
