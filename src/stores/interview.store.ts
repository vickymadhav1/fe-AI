import { defineStore } from 'pinia'
import { api } from '@/services/api'
import type { CreateInterviewPayload, Interview } from '@/types'

export const useInterviewStore = defineStore('interviews', {
  state: () => ({
    interviews: [] as Interview[],
    loading: false,
    creating: false,
    error: '',
  }),

  getters: {
    upcoming: (state) =>
      state.interviews
        .filter((interview) => interview.status === 'scheduled')
        .sort((a, b) => `${a.date} ${a.time}`.localeCompare(`${b.date} ${b.time}`)),
    completed: (state) => state.interviews.filter((interview) => interview.status === 'completed'),
    totalSessions: (state) => state.interviews.length,
    mockInterviews: (state) => state.interviews.filter((interview) => interview.type === 'Mock').length,
    successRate: (state) => {
      const scored = state.interviews.filter((interview) => typeof interview.score === 'number')
      if (!scored.length) return 0
      return Math.round(scored.reduce((sum, item) => sum + (item.score ?? 0), 0) / scored.length)
    },
  },

  actions: {
    async fetchInterviews() {
      this.loading = true
      this.error = ''

      try {
        this.interviews = await api.getInterviews()
      } catch {
        this.error = 'Could not load interviews.'
      } finally {
        this.loading = false
      }
    },

    async createInterview(payload: CreateInterviewPayload) {
      this.creating = true
      this.error = ''

      try {
        const interview = await api.createInterview(payload)
        this.interviews.unshift(interview)
        return interview
      } finally {
        this.creating = false
      }
    },

    findById(id: string) {
      return this.interviews.find((interview) => interview.id === id)
    },

    deleteInterview(id: string) {
      this.interviews = this.interviews.filter((interview) => interview.id !== id)
    },
  },
})
