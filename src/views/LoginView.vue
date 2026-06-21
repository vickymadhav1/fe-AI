<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { SparklesIcon } from '@heroicons/vue/24/solid'
import { ArrowPathIcon, ExclamationCircleIcon } from '@heroicons/vue/24/outline'
import { getGoogleAuthErrorMessage, googleAuth } from '@/services/google-auth'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'

const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()
const error = ref('')
const googleLoading = ref(false)


const loginWithGoogle = async () => {
  googleLoading.value = true
  error.value = ''

  try {
    const user = await googleAuth.signIn()
    await authStore.loginWithGoogle(user.accessToken)
    await router.push('/dashboard')
  } catch (loginError) {
    console.error('Google login failed:', loginError)
    error.value = getGoogleAuthErrorMessage(loginError)
  } finally {
    googleLoading.value = false
  }
}
</script>

<template>
  <div class="grid min-h-screen bg-slate-950 text-white lg:grid-cols-[1.1fr_0.9fr]">
    <section class="relative flex min-h-420px flex-col justify-between overflow-hidden p-8 sm:p-12 lg:p-16">
      <div class="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(34,211,238,0.28),transparent_30%),radial-gradient(circle_at_80%_10%,rgba(16,185,129,0.22),transparent_26%)]"></div>
      <div class="relative z-10 flex items-center gap-3">
        <div class="flex h-12 w-12 items-center justify-center rounded-lg bg-cyan-500 shadow-xl shadow-cyan-500/30">
          <SparklesIcon class="h-7 w-7" />
        </div>
        <div>
          <p class="text-xl font-bold">Interview Mate AI</p>
          <p class="text-sm text-slate-300">Your real-time interview command center</p>
        </div>
      </div>

      <div class="relative z-10 max-w-2xl">
        <p class="mb-4 text-sm font-semibold uppercase tracking-wide text-cyan-300">AI-powered preparation and live assistance</p>
        <h1 class="text-5xl font-bold leading-tight sm:text-6xl">Walk into every interview with a sharper answer ready.</h1>
        <p class="mt-6 max-w-xl text-lg leading-8 text-slate-300">
          Plan sessions, capture live transcripts, simulate AI answer suggestions, and track your interview history from one polished desktop-first workspace.
        </p>
      </div>
    </section>

    <section class="flex items-center justify-center bg-slate-100 p-6 text-slate-950 dark:bg-slate-950 dark:text-white">
      <div class="w-full max-w-md rounded-lg border border-slate-200 bg-white p-8 shadow-2xl shadow-slate-950/10 dark:border-slate-800 dark:bg-slate-900">
        <h2 class="text-3xl font-bold">Welcome back</h2>
        <p class="mt-2 text-slate-500 dark:text-slate-400">Sign in with your Google account to open your interview workspace.</p>

        <div v-if="error" class="mt-6 flex gap-3 rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950 dark:text-rose-100">
          <ExclamationCircleIcon class="h-5 w-5 shrink-0" />
          {{ error }}
        </div>

        <div class="mt-8 space-y-4">
          <button
            class="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
            :disabled="authStore.loading || googleLoading"
            @click="loginWithGoogle"
          >
            <span class="flex h-5 w-5 items-center justify-center rounded-full bg-white text-sm font-bold text-slate-950">G</span>
            <ArrowPathIcon v-if="googleLoading || authStore.loading" class="h-5 w-5 animate-spin" />
            {{ googleLoading || authStore.loading ? 'Signing in with Google...' : 'Continue with Google' }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
