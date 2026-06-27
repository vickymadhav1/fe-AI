import { defineStore } from 'pinia'
import { api } from '@/services/api'
import type { Credits, User } from '@/types'

const readStoredUser = (): User | null => {
  try {
    const value = localStorage.getItem('interview-mate-user')
    return value ? (JSON.parse(value) as User) : null
  } catch {
    localStorage.removeItem('interview-mate-user')
    return null
  }
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: readStoredUser(),
    token: localStorage.getItem('interview-mate-token') ?? '',
    credits: null as Credits | null,
    loading: false,
    error: '',
  }),

  getters: {
    isAuthenticated: (state) => Boolean(state.user && state.token),
  },

  actions: {
    async loginWithGoogle(idToken: string) {
      this.loading = true
      this.error = ''

      try {
        const session = await api.loginWithGoogle(idToken)
        const lastLoginAt = new Date().toISOString()
        this.user = { ...session.user, lastLoginAt }
        this.token = session.token
        const availableCredits = session.user.credits ?? 0
        this.credits = {
          remaining: availableCredits,
          used: 0,
          monthlyLimit: availableCredits,
        }
        localStorage.setItem('interview-mate-user', JSON.stringify(this.user))
        localStorage.setItem('interview-mate-token', session.token)
      } catch {
        this.error = 'Unable to sign in with Google. Try again.'
        throw new Error(this.error)
      } finally {
        this.loading = false
      }
    },

    logout() {
      this.user = null
      this.token = ''
      this.credits = null
      this.error = ''
      localStorage.removeItem('interview-mate-user')
      localStorage.removeItem('interview-mate-token')
    },
  },
})
