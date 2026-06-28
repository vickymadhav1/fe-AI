<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { SparklesIcon } from '@heroicons/vue/24/solid'
import { ArrowPathIcon, ExclamationCircleIcon } from '@heroicons/vue/24/outline'
import { getGoogleAuthErrorMessage, googleAuth } from '@/services/google-auth'
import { useAuthStore } from '@/stores/auth.store'

const router = useRouter()
const authStore = useAuthStore()
const error = ref('')
const googleLoading = ref(false)
const displayError = computed(() => error.value || authStore.error)

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
  <div class="relative min-h-screen overflow-hidden bg-[var(--im-bg)] text-white">
    <div class="absolute inset-0 bg-[radial-gradient(circle_at_70%_20%,rgba(56,189,248,.24),transparent_28rem),radial-gradient(circle_at_84%_30%,rgba(124,58,237,.22),transparent_24rem)]"></div>

    <main class="relative z-10 grid min-h-screen lg:grid-cols-[1.15fr_0.85fr]">
      <section class="flex flex-col justify-between p-8 sm:p-12 lg:p-16">
        <div class="flex items-center gap-3">
          <div class="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-300 to-violet-500 text-slate-950 shadow-lg shadow-cyan-500/20">
            <SparklesIcon class="h-6 w-6" />
          </div>
          <p class="text-lg font-black">Interview Mate AI</p>
        </div>

        <div class="max-w-3xl py-16">
          <p class="im-caption text-cyan-300">AI-powered preparation and live assistance</p>
          <h1 class="mt-6 max-w-4xl text-5xl font-black leading-[1.05] sm:text-6xl">
            Enter interviews with an AI copilot that stays focused.
          </h1>
          <p class="mt-6 max-w-2xl text-[15px] leading-7 text-slate-300">
            Real-time transcript analysis, contextual suggestions, Invisible credits, and a companion window designed for live conversations.
          </p>
        </div>
      </section>

      <section class="flex items-center justify-center p-6">
        <div class="im-card w-full max-w-[420px] p-10">
          <h2 class="text-2xl font-black">Welcome back</h2>
          <p class="mt-2 text-sm font-medium text-slate-500">Sign in to continue to your workspace</p>

          <div v-if="displayError" class="mt-6 flex gap-3 rounded-xl border border-rose-400/20 bg-rose-500/10 p-4 text-sm text-rose-100">
            <ExclamationCircleIcon class="h-5 w-5 shrink-0" />
            {{ displayError }}
          </div>

          <div class="mt-8 space-y-4">
            <button
              class="im-button w-full"
              :disabled="authStore.loading || googleLoading"
              @click="loginWithGoogle"
            >
              <span class="flex h-5 w-5 items-center justify-center rounded-full bg-white text-sm font-black text-slate-950">G</span>
              <ArrowPathIcon v-if="googleLoading || authStore.loading" class="h-5 w-5" />
              {{ googleLoading || authStore.loading ? 'Signing in' : 'Continue with Google' }}
            </button>
          </div>
        </div>
      </section>
    </main>
  </div>
</template>
