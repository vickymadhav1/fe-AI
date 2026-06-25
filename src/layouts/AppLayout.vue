<script setup lang="ts">
import {
  BellIcon,
  ClockIcon,
  Cog6ToothIcon,
  EyeSlashIcon,
  MicrophoneIcon,
  MoonIcon,
  ArrowRightStartOnRectangleIcon,
  SparklesIcon,
  SunIcon,
} from '@heroicons/vue/24/outline'
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { googleAuth } from '@/services/google-auth'
import { apiLoading } from '@/services/api'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()

const navItems = [
  { label: 'Live Session', to: '/sessions/new', icon: MicrophoneIcon },
  { label: 'History', to: '/history', icon: ClockIcon },
  { label: 'Invisible', to: '/invisible', icon: EyeSlashIcon },
  { label: 'Settings', to: '/settings', icon: Cog6ToothIcon },
]

const pageTitle = computed(() => String(route.meta.title ?? 'Live Session'))

const logout = async () => {
  await googleAuth.signOut().catch((error) => {
    console.error('Firebase sign-out failed:', error)
  })
  authStore.logout()
  uiStore.pushToast({ type: 'info', title: 'Signed out' })
  await router.push('/')
}
</script>

<template>
  <div class="min-h-screen bg-slate-100 text-slate-950 dark:bg-slate-950 dark:text-white">
    <div v-if="apiLoading" class="fixed inset-x-0 top-0 z-50 h-1 overflow-hidden bg-cyan-100 dark:bg-cyan-950">
      <div class="h-full w-1/3 animate-[api-loading_1s_ease-in-out_infinite] bg-cyan-500"></div>
    </div>
    <aside class="fixed inset-y-0 left-0 z-30 hidden w-72 flex-col border-r border-slate-200 bg-white px-5 py-6 dark:border-slate-800 dark:bg-slate-900 lg:flex">
      <RouterLink to="/sessions/new" class="flex items-center gap-3">
        <div class="flex h-11 w-11 items-center justify-center rounded-lg bg-cyan-500 text-white shadow-lg shadow-cyan-500/25">
          <SparklesIcon class="h-6 w-6" />
        </div>
        <div>
          <p class="text-lg font-bold">Interview Mate AI</p>
          <p class="text-xs text-slate-500 dark:text-slate-400">Desktop interview copilot</p>
        </div>
      </RouterLink>

      <nav class="mt-10 space-y-2">
        <RouterLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          active-class="bg-slate-950 text-white hover:bg-slate-950 hover:text-white dark:bg-white dark:text-slate-950 dark:hover:bg-white"
        >
          <component :is="item.icon" class="h-5 w-5" />
          {{ item.label }}
        </RouterLink>
      </nav>

      <div class="mt-auto rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
        <p class="text-sm font-semibold">Live session ready</p>
        <p class="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">
          Capture transcript, screen context, and AI answers from one workspace.
        </p>
      </div>
    </aside>

    <div class="lg:pl-72">
      <header class="sticky top-0 z-20 border-b border-slate-200 bg-white/90 px-4 py-4 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90 sm:px-6 lg:px-8">
        <div class="flex items-center justify-between gap-4">
          <div>
            <p class="text-xs font-semibold uppercase tracking-wide text-cyan-600 dark:text-cyan-400">Workspace</p>
            <h1 class="text-2xl font-bold">{{ pageTitle }}</h1>
          </div>

          <div class="flex items-center gap-3">
            <button
              class="rounded-lg border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              @click="uiStore.toggleTheme()"
            >
              <SunIcon v-if="uiStore.theme === 'dark'" class="h-5 w-5" />
              <MoonIcon v-else class="h-5 w-5" />
            </button>
            <button class="relative rounded-lg border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <BellIcon class="h-5 w-5" />
              <span class="absolute right-2 top-2 h-2 w-2 rounded-full bg-cyan-500"></span>
            </button>
            <div class="hidden items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900 sm:flex">
              <img :src="authStore.user?.photo ?? authStore.user?.avatarUrl" alt="" class="h-9 w-9 rounded-full bg-slate-200" />
              <div>
                <p class="text-sm font-semibold">{{ authStore.user?.name ?? 'Madhav' }}</p>
                <p class="text-xs text-slate-500 dark:text-slate-400">{{ authStore.user?.role ?? 'Frontend Engineer' }}</p>
              </div>
            </div>
            <button
              class="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              @click="logout"
            >
              <ArrowRightStartOnRectangleIcon class="h-5 w-5" />
              <span class="hidden sm:inline">Logout</span>
            </button>
          </div>
        </div>

        <nav class="mt-4 grid grid-cols-4 gap-2 lg:hidden">
          <RouterLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            class="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs text-slate-500 dark:text-slate-400"
            active-class="bg-slate-950 text-white dark:bg-white dark:text-slate-950"
          >
            <component :is="item.icon" class="h-5 w-5" />
            {{ item.label }}
          </RouterLink>
        </nav>
      </header>

      <main class="px-4 py-6 sm:px-6 lg:px-8">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<style>
@keyframes api-loading {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(400%); }
}
</style>
