<script setup lang="ts">
import {
  ChartBarIcon,
  ClockIcon,
  CreditCardIcon,
  EyeSlashIcon,
  LifebuoyIcon,
  MicrophoneIcon,
  SparklesIcon,
} from '@heroicons/vue/24/outline'
import { StarIcon } from '@heroicons/vue/24/solid'
import { computed } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import ProfileChip from '@/components/shell/ProfileChip.vue'
import SidebarFooter from '@/components/shell/SidebarFooter.vue'
import { useAuthStore } from '@/stores/auth.store'
import { useSessionStore } from '@/stores/session.store'
import { useUiStore } from '@/stores/ui.store'
import { googleAuth } from '@/services/google-auth'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const sessionStore = useSessionStore()
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
const showDuration = computed(() => route.path.startsWith('/sessions/') && Boolean(sessionStore.interviewStartTime))
const displayName = computed(() => authStore.user?.name?.trim() || authStore.user?.email || 'Interview Mate AI')
const initials = computed(() =>
  displayName.value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join(''),
)

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
    <aside class="fixed left-6 top-6 bottom-6 z-30 hidden w-268px rounded-[18px] border border-[#1f2937] bg-[#0b0f19] px-6 py-8 shadow-2xl shadow-black/35 lg:flex lg:flex-col">
      <RouterLink to="/dashboard" class="flex items-center gap-3 focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300">
        <div class="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-300 via-violet-400 to-emerald-300 text-slate-950">
          <SparklesIcon class="h-5 w-5" />
        </div>
        <span class="flex items-center gap-2 text-[19px] font-extrabold leading-none text-slate-50">
          <StarIcon class="h-[18px] w-[18px] text-amber-300 drop-shadow-[0_0_10px_rgba(251,191,36,.28)]" />
          Interview Mate AI
        </span>
      </RouterLink>

      <nav class="mt-10 flex-1 space-y-8">
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

      <SidebarFooter
        :name="displayName"
        :initials="initials"
        @logout="logout"
      />
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
      <div class="grid h-full grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4">
        <div class="min-w-0">
          <p class="text-[11px] font-extrabold uppercase text-cyan-300">Workspace</p>
          <h1 class="text-[24px] font-extrabold leading-tight text-slate-50">{{ pageTitle }}</h1>
        </div>
        <div
          v-if="showDuration"
          class="hidden min-w-[178px] justify-center whitespace-nowrap rounded-full border border-white/10 bg-white/[.045] px-4 py-2 text-[13px] font-extrabold text-slate-200 sm:flex"
        >
          <span>Duration:&nbsp;</span>
          <span class="font-mono tabular-nums text-slate-50">{{ sessionStore.formattedDuration }}</span>
        </div>
        <div v-else></div>
        <div class="hidden min-w-0 items-center justify-end gap-3 sm:flex">
          <ProfileChip :name="displayName" />
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
