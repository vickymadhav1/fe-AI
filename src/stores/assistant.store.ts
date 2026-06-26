import { defineStore } from 'pinia'
import { api } from '@/services/api'
import type { ScreenContext, Suggestion } from '@/types'

export const useAssistantStore = defineStore('assistant', {
  state: () => ({
    suggestions: [] as Suggestion[],
    currentQuestion: '',
    latestScreenContext: null as ScreenContext | null,
    generating: false,
    liveSuggestion: null as Suggestion | null,
  }),
  actions: {
    async load(sessionId: string) {
      this.suggestions = (await api.getSessionSuggestions(sessionId)).map((suggestion) =>
        this.normalizeSuggestion(suggestion),
      )
    },
    add(suggestion: Suggestion) {
      const normalized = this.normalizeSuggestion(suggestion)
      this.currentQuestion = suggestion.question
      this.liveSuggestion = null
      this.suggestions = [
        ...this.suggestions.filter((item) => item.id !== suggestion.id),
        normalized,
      ]
      this.generating = false
    },
    updateLiveSuggestion(suggestion: Suggestion) {
      this.liveSuggestion = this.normalizeSuggestion(suggestion)
      this.currentQuestion = suggestion.question
      this.generating = !suggestion.answer.trim()
    },
    normalizeSuggestion(suggestion: Suggestion): Suggestion {
      const confidence = Number(suggestion.confidence)
      return {
        ...suggestion,
        confidence: Number.isFinite(confidence)
          ? Math.max(suggestion.answer.trim() ? 0.7 : 0, Math.min(1, confidence))
          : 0.8,
      }
    },
    detectQuestion(question: string) {
      if (question.trim() === this.currentQuestion.trim()) return
      this.currentQuestion = question
      this.generating = true
    },
    updateScreenContext(context: ScreenContext) {
      this.latestScreenContext = context
    },
    clear() {
      this.suggestions = []
      this.currentQuestion = ''
      this.latestScreenContext = null
      this.generating = false
      this.liveSuggestion = null
    },
  },
})
