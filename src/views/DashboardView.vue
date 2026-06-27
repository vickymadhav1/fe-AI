<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth.store'
import { useSessionStore } from '@/stores/session.store'
import { useSubscriptionStore } from '@/stores/subscription.store'
import type { AiProviderHealth, DashboardStatistics } from '@/types'

const authStore = useAuthStore()
const sessionStore = useSessionStore()
const subscriptionStore = useSubscriptionStore()
const providerHealth = ref<AiProviderHealth[]>([])
const dashboardStatistics = ref<DashboardStatistics | null>(null)
const statisticsLoading = ref(true)
let refreshTimer: ReturnType<typeof setInterval> | undefined

const refreshStatistics = async () => {
  try {
    dashboardStatistics.value = await api.getDashboardStatistics()
  } finally {
    statisticsLoading.value = false
  }
}

onMounted(async () => {
  await Promise.allSettled([
    sessionStore.fetchSessions(),
    subscriptionStore.load(),
    refreshStatistics(),
    api.getAiProviderHealth().then((providers) => {
      providerHealth.value = providers
    }),
  ])
  refreshTimer = setInterval(() => {
    void refreshStatistics()
    void subscriptionStore.load()
  }, 15_000)
})

onBeforeUnmount(() => {
  if (refreshTimer) clearInterval(refreshTimer)
})

const subscription = computed(() => subscriptionStore.subscription)
const sessions = computed(() => sessionStore.sessions)
const dashboardLoading = computed(
  () =>
    statisticsLoading.value ||
    sessionStore.loading ||
    (subscriptionStore.loading && !subscription.value),
)
const user = computed(() => authStore.user)
const latestProfileSession = computed(() => sessions.value[0] ?? null)

const currentProvider = computed(() => sessionStore.provider.trim())
const currentProviderHealth = computed(() =>
  providerHealth.value.find(
    (provider) => provider.name.toLowerCase() === currentProvider.value.toLowerCase(),
  ),
)
const primaryHealthyProvider = computed(
  () => providerHealth.value.find((provider) => provider.status === 'healthy') ?? null,
)
const displayedProvider = computed(() => currentProvider.value || primaryHealthyProvider.value?.name || '')
const displayedProviderStatus = computed(() => {
  if (currentProviderHealth.value) return currentProviderHealth.value.status
  if (!currentProvider.value && primaryHealthyProvider.value) return primaryHealthyProvider.value.status
  return ''
})

const formatDate = (value?: string | null): string => {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(value))
}
const formatDateTime = (value?: string | null): string => {
  if (!value) return 'Not available'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}
const displayName = computed(() => user.value?.name?.trim() || user.value?.email || 'Account')
const initials = computed(() =>
  displayName.value
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join(''),
)
const subscriptionLabel = computed(() => (subscription.value?.active ? 'Premium' : 'Free'))
const subscriptionProgress = computed(() => {
  const total = subscription.value?.totalCredits ?? 0
  const remaining = subscription.value?.remainingCredits ?? 0
  return total > 0 ? Math.min(100, Math.round((remaining / total) * 100)) : 0
})
const currentStatus = computed(() =>
  dashboardStatistics.value?.currentSession.running ? 'Running' : 'Ready for interview',
)
const protectionActive = computed(
  () => subscriptionStore.invisibleModeActive && sessionStore.isRunning,
)
const platformLabel = navigator.platform || 'Not available'
const walletItems = computed(() => [
  ['Credits remaining', dashboardStatistics.value?.wallet.creditsRemaining ?? 'Unavailable'],
  ['Minutes remaining', dashboardStatistics.value?.wallet.minutesRemaining ?? 'Unavailable'],
  ['Credits used', dashboardStatistics.value?.wallet.creditsUsed ?? 'Unavailable'],
  [
    'Total interview time',
    dashboardStatistics.value
      ? `${dashboardStatistics.value.wallet.totalInterviewMinutes} min`
      : 'Unavailable',
  ],
  [
    "Today's usage",
    dashboardStatistics.value
      ? `${dashboardStatistics.value.wallet.todayUsageMinutes} min`
      : 'Unavailable',
  ],
  [
    'Current session',
    dashboardStatistics.value?.currentSession.running
      ? `${dashboardStatistics.value.wallet.currentSessionMinutes} min`
      : 'No active session',
  ],
])
const statisticItems = computed(() => [
  ['Total interviews', dashboardStatistics.value?.interviews.total ?? 'Unavailable'],
  ["Today's interviews", dashboardStatistics.value?.interviews.today ?? 'Unavailable'],
  ['Completed', dashboardStatistics.value?.interviews.completed ?? 'Unavailable'],
  [
    'Average confidence',
    dashboardStatistics.value?.interviews.averageConfidence === null
      ? 'Not available'
      : dashboardStatistics.value
        ? `${dashboardStatistics.value.interviews.averageConfidence}%`
        : 'Unavailable',
  ],
  [
    'Coding challenges',
    dashboardStatistics.value?.interviews.codingChallenges ?? 'Unavailable',
  ],
  [
    'Behavioral questions',
    dashboardStatistics.value?.interviews.behavioralQuestions ?? 'Unavailable',
  ],
  [
    'System design',
    dashboardStatistics.value?.interviews.systemDesignQuestions ?? 'Unavailable',
  ],
  [
    'AI suggestions',
    dashboardStatistics.value?.interviews.suggestionsGenerated ?? 'Unavailable',
  ],
])
</script>

<template>
  <div class="im-dashboard-page space-y-6">
    <section class="relative min-h-[88px] rounded-2xl border border-[#202a3d] bg-[#0c111d] px-6 py-5 sm:px-8">
      <div>
        <p class="text-[12px] font-bold uppercase tracking-[0.12em] text-cyan-300">Account overview</p>
        <h1 class="mt-2 text-[30px] font-bold leading-none text-slate-50 sm:text-[36px]">Welcome back, {{ user?.name?.split(' ')[0] || 'there' }}</h1>
      </div>
      <RouterLink
        to="/sessions/new"
        class="mt-5 inline-flex h-11 items-center justify-center rounded-lg bg-slate-50 px-6 text-[14px] font-bold !text-black transition hover:scale-[1.015] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 sm:absolute sm:right-8 sm:top-[21px] sm:mt-0"
      >
        Start Interview
      </RouterLink>
    </section>

    <template v-if="dashboardLoading">
      <section class="grid gap-6 xl:grid-cols-[1.35fr_.85fr]">
        <article v-for="item in 2" :key="item" class="h-[260px] rounded-2xl border border-[#263249] bg-[#101827] p-6">
          <SkeletonBlock class="h-5 w-40" />
          <SkeletonBlock class="mt-7 h-16 w-64 rounded-xl" />
          <SkeletonBlock class="mt-7 h-24 w-full rounded-xl" />
        </article>
      </section>
      <section class="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <article v-for="item in 6" :key="item" class="h-[250px] rounded-2xl border border-[#263249] bg-[#101827] p-6">
          <SkeletonBlock class="h-5 w-36" />
          <SkeletonBlock v-for="row in 3" :key="row" class="mt-6 h-10 w-full rounded-lg" />
        </article>
      </section>
    </template>

    <template v-else>
      <section class="grid gap-6 xl:grid-cols-[1.35fr_.85fr]">
        <article class="im-proto-card-hover rounded-2xl border border-[#263249] bg-[linear-gradient(135deg,rgba(24,32,51,.96),rgba(13,17,28,.9))] p-6">
          <div class="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div class="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-[24px] font-extrabold text-cyan-200">
              <img v-if="user?.photo || user?.avatarUrl" :src="user.photo || user.avatarUrl" alt="" class="h-full w-full object-cover" />
              <span v-else>{{ initials }}</span>
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-3">
                <h2 class="truncate text-[24px] font-bold text-slate-50">{{ displayName }}</h2>
                <span class="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[11px] font-bold text-amber-200">{{ subscriptionLabel }} member</span>
              </div>
              <p class="mt-1 text-[13px] text-slate-400">{{ user?.email }}</p>
              <p v-if="latestProfileSession?.role || latestProfileSession?.company" class="mt-2 text-[13px] font-semibold text-slate-300">
                {{ latestProfileSession?.role || 'Role not provided' }}
                <span v-if="latestProfileSession?.company"> at {{ latestProfileSession.company }}</span>
              </p>
            </div>
          </div>
          <div class="mt-7 grid gap-4 border-t border-[#28344a] pt-5 sm:grid-cols-3">
            <div>
              <p class="text-[11px] font-bold uppercase text-slate-500">Member since</p>
              <p class="mt-2 text-[13px] font-semibold text-slate-200">{{ formatDate(user?.createdAt) }}</p>
            </div>
            <div>
              <p class="text-[11px] font-bold uppercase text-slate-500">Last login</p>
              <p class="mt-2 text-[13px] font-semibold text-slate-200">{{ formatDateTime(user?.lastLoginAt) }}</p>
            </div>
            <div>
              <p class="text-[11px] font-bold uppercase text-slate-500">Current status</p>
              <p class="mt-2 inline-flex items-center gap-2 text-[13px] font-semibold text-emerald-300">
                <span class="h-2 w-2 rounded-full bg-emerald-400"></span>{{ currentStatus }}
              </p>
            </div>
          </div>
        </article>

        <article class="im-proto-card-hover rounded-2xl border border-violet-300/20 bg-[linear-gradient(145deg,rgba(91,33,182,.2),rgba(14,19,31,.94)_58%)] p-6">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[12px] font-bold uppercase text-violet-200">Subscription</p>
              <h2 class="mt-2 text-[28px] font-extrabold text-slate-50">{{ subscriptionLabel }}</h2>
            </div>
            <span :class="subscription?.active ? 'bg-emerald-400/10 text-emerald-300' : 'bg-slate-700 text-slate-300'" class="rounded-full px-3 py-1 text-[11px] font-bold">
              {{ subscription?.active ? 'Active' : 'Inactive' }}
            </span>
          </div>
          <div class="mt-7 grid grid-cols-2 gap-4">
            <div>
              <p class="text-[11px] font-bold uppercase text-slate-500">Plan</p>
              <p class="mt-2 text-[14px] font-semibold text-slate-200">{{ subscription?.plan?.name || 'No active plan' }}</p>
            </div>
            <div>
              <p class="text-[11px] font-bold uppercase text-slate-500">Usage rate</p>
              <p class="mt-2 text-[14px] font-semibold text-slate-200">{{ subscription?.creditsPerMinute ?? 0 }} credits / minute</p>
            </div>
          </div>
          <div class="mt-6">
            <div class="flex justify-between text-[12px] font-semibold text-slate-400">
              <span>{{ subscription?.remainingCredits ?? 0 }} credits remaining</span>
              <span>{{ subscriptionProgress }}%</span>
            </div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
              <div class="h-full rounded-full bg-[linear-gradient(90deg,#8b5cf6,#22d3ee)] transition-[width] duration-500" :style="{ width: `${subscriptionProgress}%` }"></div>
            </div>
          </div>
        </article>
      </section>

      <section class="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <article class="im-proto-card-hover rounded-2xl border border-[#263249] bg-[#101827] p-6">
          <h2 class="text-[18px] font-bold text-slate-50">Wallet summary</h2>
          <div class="mt-6 grid grid-cols-2 gap-4">
            <div v-for="item in walletItems" :key="String(item[0])" class="rounded-xl border border-[#263249] bg-white/[0.025] p-4">
              <p class="text-[11px] font-bold uppercase leading-4 text-slate-500">{{ item[0] }}</p>
              <p class="mt-2 text-[20px] font-extrabold text-slate-50">{{ item[1] }}</p>
            </div>
          </div>
        </article>

        <article class="im-proto-card-hover rounded-2xl border border-[#263249] bg-[#101827] p-6">
          <h2 class="text-[18px] font-bold text-slate-50">Interview statistics</h2>
          <div class="mt-6 grid grid-cols-2 gap-x-5 gap-y-5">
            <div v-for="item in statisticItems" :key="String(item[0])">
              <p class="text-[11px] font-bold uppercase leading-4 text-slate-500">{{ item[0] }}</p>
              <p class="mt-1 text-[19px] font-extrabold text-slate-100">{{ item[1] }}</p>
            </div>
          </div>
        </article>

        <!-- <article class="im-proto-card-hover rounded-2xl border border-[#263249] bg-[#101827] p-6">
          <div class="flex items-center justify-between">
            <h2 class="text-[18px] font-bold text-slate-50">Current session</h2>
            <span :class="sessionStore.isRunning ? 'text-emerald-300' : 'text-slate-400'" class="text-[12px] font-bold">{{ sessionStore.isRunning ? 'Running' : 'No active interview' }}</span>
          </div>
          <dl class="mt-6 space-y-4 text-[13px]">
            <div class="flex justify-between gap-4"><dt class="text-slate-500">Duration</dt><dd class="font-semibold text-slate-200">{{ currentSessionMinutes }} min</dd></div>
            <div class="flex justify-between gap-4"><dt class="text-slate-500">AI provider</dt><dd class="font-semibold text-slate-200">{{ currentProvider || 'Not active' }}</dd></div>
            <div class="flex justify-between gap-4"><dt class="text-slate-500">Meeting platform</dt><dd class="truncate font-semibold text-slate-200">{{ sessionStore.activeMeetingApp || 'Not detected' }}</dd></div>
            <div class="flex justify-between gap-4"><dt class="text-slate-500">Capture</dt><dd class="font-semibold text-slate-200">{{ sessionStore.screenStatus }}</dd></div>
            <div class="flex justify-between gap-4"><dt class="text-slate-500">Microphone</dt><dd class="font-semibold text-slate-200">{{ sessionStore.isListening ? 'Listening' : 'Idle' }}</dd></div>
            <div class="flex justify-between gap-4"><dt class="text-slate-500">Invisible mode</dt><dd class="font-semibold text-slate-200">{{ protectionActive ? 'Enabled' : 'Disabled' }}</dd></div>
          </dl>
        </article> -->

        <!-- <article class="im-proto-card-hover rounded-2xl border border-[#263249] bg-[#101827] p-6">
          <h2 class="text-[18px] font-bold text-slate-50">Protection status</h2>
          <dl class="mt-6 space-y-4 text-[13px]">
            <div class="flex justify-between gap-4"><dt class="text-slate-500">Meeting detected</dt><dd class="font-semibold text-slate-200">{{ sessionStore.activeMeetingApp || 'No' }}</dd></div>
            <div class="flex justify-between gap-4"><dt class="text-slate-500">Companion protected</dt><dd class="font-semibold" :class="protectionActive ? 'text-emerald-300' : 'text-slate-400'">{{ protectionActive ? 'Protected' : 'Not protected' }}</dd></div>
            <div class="flex justify-between gap-4"><dt class="text-slate-500">Main window protected</dt><dd class="font-semibold" :class="protectionActive ? 'text-emerald-300' : 'text-slate-400'">{{ protectionActive ? 'Protected' : 'Not protected' }}</dd></div>
            <div class="flex justify-between gap-4"><dt class="text-slate-500">Platform</dt><dd class="font-semibold capitalize text-slate-200">{{ platformLabel }}</dd></div>
          </dl>
        </article> -->

        <!-- <article class="im-proto-card-hover rounded-2xl border border-[#263249] bg-[#101827] p-6">
          <h2 class="text-[18px] font-bold text-slate-50">AI provider</h2>
          <div class="mt-7 rounded-xl border border-cyan-300/15 bg-cyan-300/[0.04] p-5">
            <div class="flex items-center justify-between gap-4">
              <p class="text-[22px] font-extrabold capitalize text-slate-50">{{ displayedProvider || 'Not active' }}</p>
              <span v-if="displayedProviderStatus" class="rounded-full bg-emerald-400/10 px-3 py-1 text-[11px] font-bold capitalize text-emerald-300">{{ displayedProviderStatus.replace('_', ' ') }}</span>
            </div>
            <p class="mt-3 text-[12px] leading-5 text-slate-400">
              {{ currentProvider ? 'Provider serving the current interview.' : 'First healthy configured provider.' }}
            </p>
          </div>
        </article> -->

        <article class="im-proto-card-hover rounded-2xl border border-[#263249] bg-[#101827] p-6">
          <h2 class="text-[18px] font-bold text-slate-50">Invisible usage</h2>
          <div class="mt-6 flex items-end justify-between">
            <div>
              <p class="text-[11px] font-bold uppercase text-slate-500">Remaining time</p>
              <p class="mt-2 text-[32px] font-extrabold text-slate-50">{{ Math.floor(subscription?.remainingMinutes ?? 0) }} min</p>
            </div>
            <p class="text-right text-[12px] font-semibold text-slate-400">Last used<br><span class="text-slate-200">{{ formatDateTime(subscription?.lastUsedAt) }}</span></p>
          </div>
          <div class="mt-6 h-2 overflow-hidden rounded-full bg-slate-800">
            <div class="h-full rounded-full bg-cyan-400 transition-[width] duration-500" :style="{ width: `${subscriptionProgress}%` }"></div>
          </div>
          <p class="mt-4 text-[12px] text-slate-500">Credits are consumed only while Invisible Mode is active during an interview.</p>
        </article>
      </section>
    </template>
  </div>
</template>
