import { defineStore } from 'pinia'
import { api } from '@/services/api'
import type { Transcript } from '@/types'

export const useTranscriptStore = defineStore('transcripts', {
  state: () => ({
    items: [] as Transcript[],
    interimText: '',
  }),
  actions: {
    async load(sessionId: string) {
      this.items = await api.getTranscripts(sessionId)
    },
    add(transcript: Transcript) {
      if (!this.items.some((item) => item.id === transcript.id)) this.items.push(transcript)
    },
    clear() {
      this.items = []
      this.interimText = ''
    },
  },
})
