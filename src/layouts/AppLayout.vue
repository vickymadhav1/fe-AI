<script setup lang="ts">
import {
  ArrowRightStartOnRectangleIcon,
  BellIcon,
  ChartBarIcon,
  ClockIcon,
  CreditCardIcon,
  EyeSlashIcon,
  LifebuoyIcon,
  MicrophoneIcon,
  SparklesIcon,
} from '@heroicons/vue/24/outline'
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import { googleAuth } from '@/services/google-auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const uiStore = useUiStore()

const groups = [
  {
    label: '',
    items: [{ label: 'Dashboard', to: '/dashboard', icon: ChartBarIcon }],
  },
  {
    label: 'INTERVIEW',
    items: [
      { label: 'Live Interview', to: '/sessions/new', icon: MicrophoneIcon },
      { label: 'History', to: '/history', icon: ClockIcon },
    ],
  },
  {
    label: 'MONETIZATION',
    items: [
      { label: 'Invisible', to: '/invisible', icon: EyeSlashIcon },
      { label: 'Payment', to: '/payment', icon: CreditCardIcon },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { label: 'Support', to: '/support', icon: LifebuoyIcon },
    ],
  },
]

const pageTitle = computed(() => String(route.meta.title ?? 'Dashboard'))

const isActiveRoute = (to: string) => {
  if (to === '/sessions/new') return route.path.startsWith('/sessions/')
  return route.path === to
}

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
  <div class="h-screen overflow-hidden bg-[linear-gradient(135deg,#080a12,#111827_52%,#07080d)] text-slate-50">
    <aside class="fixed left-6 top-6 bottom-6 z-30 hidden w-[268px] rounded-[18px] border border-[#1f2937] bg-[#0b0f19] px-6 py-8 shadow-2xl shadow-black/35 lg:flex lg:flex-col">
      <RouterLink to="/dashboard" class="flex items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-300 via-violet-400 to-emerald-300 text-slate-950">
          <SparklesIcon class="h-5 w-5" />
        </div>
        <span class="text-[19px] font-extrabold leading-none text-slate-50">Interview Mate AI</span>
      </RouterLink>

      <nav class="mt-10 space-y-8">
        <div v-for="group in groups" :key="group.label || 'primary'">
          <p v-if="group.label" class="mb-4 px-2 text-[12px] font-semibold text-slate-500">
            {{ group.label }}
          </p>
          <div class="space-y-2">
            <RouterLink
              v-for="item in group.items"
              :key="`${group.label}-${item.label}`"
              :to="item.to"
              class="flex h-11 items-center gap-3 rounded-lg px-3 text-[14px] font-semibold text-slate-400 transition hover:bg-[#111827] hover:text-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
              :class="isActiveRoute(item.to) ? 'border border-[#334155] bg-[#111827] text-slate-50' : ''"
            >
              <span class="flex h-5 w-5 items-center justify-center">
                <component :is="item.icon" class="h-5 w-5" />
              </span>
              {{ item.label }}
            </RouterLink>
          </div>
        </div>
      </nav>

      <div class="mt-4 flex items-center justify-between gap-2">
        <button class="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-50" aria-label="Notifications">
          <BellIcon class="h-4 w-4" />
        </button>
        <button
          class="rounded-lg border border-white/10 bg-white/5 p-2 text-slate-400 transition hover:bg-white/10 hover:text-slate-50"
          aria-label="Logout"
          @click="logout"
        >
          <ArrowRightStartOnRectangleIcon class="h-4 w-4" />
        </button>
      </div>
    </aside>

    <nav class="fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 border-t border-white/10 bg-[#0b0f19]/95 p-2 backdrop-blur lg:hidden">
      <RouterLink
        v-for="item in groups.flatMap((group) => group.items)"
        :key="item.label"
        :to="item.to"
        class="flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] font-bold text-slate-500"
        :class="isActiveRoute(item.to) ? 'bg-white/10 text-slate-50' : ''"
      >
        <component :is="item.icon" class="h-5 w-5" />
        {{ item.label }}
      </RouterLink>
    </nav>

    <section class="fixed left-0 right-0 top-0 z-20 h-20 border-b border-white/10 bg-[#0b111d]/90 px-6 backdrop-blur-xl lg:left-[316px]">
      <div class="flex h-full items-center justify-between gap-4">
        <div>
          <p class="text-[11px] font-extrabold uppercase text-cyan-300">Workspace</p>
          <h1 class="text-[24px] font-extrabold leading-tight text-slate-50">{{ pageTitle }}</h1>
        </div>
        <div class="hidden items-center gap-3 sm:flex">
          <span class="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[12px] font-bold text-slate-300">
            {{ authStore.user?.name ?? 'Interview Mate AI' }}
          </span>
        </div>
      </div>
    </section>

    <main class="fixed inset-x-0 bottom-0 top-20 overflow-hidden pb-16 lg:left-[316px] lg:pb-0">
      <div class="im-scrollbar h-full max-h-full max-w-full overflow-y-auto overflow-x-hidden px-6 py-6">
        <RouterView v-slot="{ Component, route: activeRoute }">
          <component :is="Component" :key="activeRoute.fullPath" />
        </RouterView>
      </div>
    </main>
  </div>
</template>
