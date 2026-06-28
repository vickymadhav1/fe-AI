import { defineStore } from 'pinia'
import { AxiosError } from 'axios'
import { api } from '@/services/api'
import type { Credits, User } from '@/types'

let validationPromise: Promise<boolean> | null = null

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
    sessionValidated: false,
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
        this.sessionValidated = true
      } catch {
        this.error = 'Unable to sign in with Google. Try again.'
        throw new Error(this.error)
      } finally {
        this.loading = false
      }
    },

    async validateStoredSession() {
      if (this.sessionValidated) return this.isAuthenticated
      if (validationPromise) return validationPromise

      validationPromise = this.performStoredSessionValidation().finally(() => {
        validationPromise = null
      })

      return validationPromise
    },

    async performStoredSessionValidation() {
      const storedToken = localStorage.getItem('interview-mate-token') ?? ''
      if (!storedToken) {
        this.logout()
        this.sessionValidated = true
        return false
      }

      this.loading = true
      this.error = ''
      this.token = storedToken

      try {
        const profile = await api.getProfile()
        const lastLoginAt = this.user?.lastLoginAt ?? new Date().toISOString()
        this.user = { ...profile, lastLoginAt }
        this.credits = {
          remaining: profile.credits ?? 0,
          used: 0,
          monthlyLimit: profile.credits ?? 0,
        }
        localStorage.setItem('interview-mate-user', JSON.stringify(this.user))
        this.sessionValidated = true
        return true
      } catch (error) {
        const status = error instanceof AxiosError ? error.response?.status : undefined
        if (status === 401 || status === 404) {
          this.logout()
          this.sessionValidated = true
          return false
        }

        this.error = 'Could not verify your session. Check the backend connection and try again.'
        this.user = null
        this.token = ''
        this.credits = null
        this.sessionValidated = false
        return false
      } finally {
        this.loading = false
      }
    },

    logout() {
      validationPromise = null
      this.user = null
      this.token = ''
      this.credits = null
      this.error = ''
      this.sessionValidated = false
      localStorage.removeItem('interview-mate-user')
      localStorage.removeItem('interview-mate-token')
    },
  },
})
