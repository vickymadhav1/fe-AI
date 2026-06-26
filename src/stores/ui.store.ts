import { defineStore } from 'pinia'
import type { ThemeMode, ToastMessage } from '@/types'

export interface StealthSettings {
  askBeforeInterview: boolean
  autoEnable: boolean
  protectMainWindow: boolean
  protectCompanionWindow: boolean
  shortcut: string
}

const defaultStealthSettings: StealthSettings = {
  askBeforeInterview: true,
  autoEnable: false,
  protectMainWindow: true,
  protectCompanionWindow: true,
  shortcut: 'Alt+Space',
}

const stealthSettingsKey = 'interview-mate-stealth-settings'

export const useUiStore = defineStore('ui', {
  state: () => ({
    theme: 'light' as ThemeMode,
    toasts: [] as ToastMessage[],
    stealthSettings: { ...defaultStealthSettings },
  }),

  actions: {
    initializeTheme() {
      const savedTheme = window.localStorage.getItem('theme') as ThemeMode | null
      this.theme = savedTheme ?? 'light'
      document.documentElement.classList.toggle('dark', this.theme === 'dark')
    },

    initializeStealthSettings() {
      try {
        const saved = window.localStorage.getItem(stealthSettingsKey)
        this.stealthSettings = saved
          ? { ...defaultStealthSettings, ...JSON.parse(saved) as Partial<StealthSettings> }
          : { ...defaultStealthSettings }
      } catch {
        this.stealthSettings = { ...defaultStealthSettings }
      }
      void window.interviewMateDesktop?.stealth.registerShortcut(this.stealthSettings.shortcut)
    },

    updateStealthSettings(settings: Partial<StealthSettings>) {
      this.stealthSettings = { ...this.stealthSettings, ...settings }
      window.localStorage.setItem(stealthSettingsKey, JSON.stringify(this.stealthSettings))
      if (settings.shortcut) {
        void window.interviewMateDesktop?.stealth.registerShortcut(this.stealthSettings.shortcut)
      }
    },

    setTheme(theme: ThemeMode) {
      this.theme = theme
      window.localStorage.setItem('theme', theme)
      document.documentElement.classList.toggle('dark', theme === 'dark')
    },

    toggleTheme() {
      this.setTheme(this.theme === 'dark' ? 'light' : 'dark')
    },

    pushToast(toast: Omit<ToastMessage, 'id'>) {
      const duplicate = this.toasts.some(
        (item) =>
          item.type === toast.type &&
          item.title === toast.title &&
          item.description === toast.description,
      )

      if (duplicate) return

      const message = { id: `toast_${Date.now()}`, ...toast }
      this.toasts.push(message)
      this.toasts = this.toasts.slice(-4)
      window.setTimeout(() => this.dismissToast(message.id), 3600)
    },

    dismissToast(id: string) {
      this.toasts = this.toasts.filter((toast) => toast.id !== id)
    },
  },
})
