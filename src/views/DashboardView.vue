<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import {
  BanknotesIcon,
  CheckBadgeIcon,
  ClockIcon,
  CreditCardIcon,
  SparklesIcon,
  TrophyIcon,
} from '@heroicons/vue/24/outline'
import KPIGrid, { type DashboardKpi } from '@/components/dashboard/KPIGrid.vue'
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
const activeUsage = computed(() => Boolean(sessionStore.interviewStartTime && sessionStore.isRunning))
const formatUsageNumber = (value: number) =>
  Number.isInteger(value) ? value : Number(value.toFixed(2))
const displayedCreditsRemaining = computed(() => {
  if (activeUsage.value) return formatUsageNumber(sessionStore.remainingCredits)
  return subscription.value?.remainingCredits ?? dashboardStatistics.value?.wallet.creditsRemaining ?? 'Unavailable'
})
const displayedMinutesRemaining = computed(() => {
  if (activeUsage.value) return sessionStore.formattedRemainingTime
  return subscription.value?.remainingMinutes !== undefined
    ? Math.ceil(subscription.value.remainingMinutes)
    : dashboardStatistics.value?.wallet.minutesRemaining ?? 'Unavailable'
})
const displayedCreditsUsed = computed(() => {
  if (activeUsage.value) return formatUsageNumber(sessionStore.creditsUsed)
  return subscription.value?.creditsUsed ?? dashboardStatistics.value?.wallet.creditsUsed ?? 'Unavailable'
})
const subscriptionProgress = computed(() => {
  if (activeUsage.value && subscription.value?.totalCredits) {
    return Math.min(
      100,
      Math.max(0, Math.round((sessionStore.remainingCredits / subscription.value.totalCredits) * 100)),
    )
  }
  if (dashboardStatistics.value) return dashboardStatistics.value.invisibleUsage.progress
  const total = subscription.value?.totalCredits ?? 0
  const remaining = subscription.value?.remainingCredits ?? 0
  return total > 0 ? Math.min(100, Math.round((remaining / total) * 100)) : 0
})
const currentStatus = computed(() =>
  sessionStore.isRunning || dashboardStatistics.value?.currentSession.running
    ? 'Running'
    : 'Ready for interview',
)
const protectionActive = computed(
  () => subscriptionStore.invisibleModeActive && sessionStore.isRunning,
)
const platformLabel = navigator.platform || 'Not available'
const averageConfidenceValue = computed(() => {
  if (!dashboardStatistics.value) return 'Unavailable'
  return dashboardStatistics.value.interviews.averageConfidence === null
    ? 'Not available'
    : `${dashboardStatistics.value.interviews.averageConfidence}%`
})
const kpiItems = computed<DashboardKpi[]>(() => [
  {
    id: 'credits',
    title: 'Credits Remaining',
    value: displayedCreditsRemaining.value,
    icon: BanknotesIcon,
    helper: 'Available',
  },
  {
    id: 'minutes',
    title: 'Minutes Remaining',
    value: displayedMinutesRemaining.value,
    icon: ClockIcon,
    helper: 'Available',
  },
  {
    id: 'credits-used',
    title: 'Credits Used',
    value: displayedCreditsUsed.value,
    icon: CreditCardIcon,
    helper: 'Consumed',
  },
  {
    id: 'interviews',
    title: 'Total Interviews',
    value: dashboardStatistics.value?.interviews.total ?? 'Unavailable',
    icon: TrophyIcon,
    helper: 'All time',
  },
  {
    id: 'confidence',
    title: 'Average Confidence',
    value: averageConfidenceValue.value,
    icon: SparklesIcon,
    helper: 'AI score',
  },
  {
    id: 'completed',
    title: 'Completed Interviews',
    value: dashboardStatistics.value?.interviews.completed ?? 'Unavailable',
    icon: CheckBadgeIcon,
    helper: 'Finished',
  },
])
</script>

<template>
  <div class="im-dashboard-page space-y-5">
    <!-- <section class="relative min-h-[84px] rounded-2xl border border-[#202a3d] bg-[#0c111d] px-5 py-4 sm:px-6">
      <div>
        <p class="text-[12px] font-bold uppercase tracking-[0.12em] text-cyan-300">Account overview</p>
        <h1 class="mt-1.5 text-[28px] font-bold leading-none text-slate-50 sm:text-[32px]">Welcome back, {{ user?.name?.split(' ')[0] || 'there' }}</h1>
      </div>
      <RouterLink
        to="/sessions/new"
        class="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-slate-50 px-5 text-[13px] font-bold !text-black transition hover:scale-[1.015] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 sm:absolute sm:right-6 sm:top-[22px] sm:mt-0"
      >
        Start Interview
      </RouterLink>
    </section> -->

    <template v-if="dashboardLoading">
      <section class="grid gap-6 xl:grid-cols-[1.35fr_.85fr]">
        <article v-for="item in 2" :key="item" class="h-260px rounded-2xl border border-[#263249] bg-[#101827] p-6">
          <SkeletonBlock class="h-5 w-40" />
          <SkeletonBlock class="mt-7 h-16 w-64 rounded-xl" />
          <SkeletonBlock class="mt-7 h-24 w-full rounded-xl" />
        </article>
      </section>
      <section class="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
        <article v-for="item in 6" :key="item" class="h-132px rounded-2xl border border-[#263249] bg-[#101827] p-6">
          <SkeletonBlock class="h-5 w-36" />
          <SkeletonBlock class="mt-5 h-9 w-24 rounded-lg" />
        </article>
      </section>
    </template>

    <template v-else>
      <section class="grid items-stretch gap-5 xl:grid-cols-[1.35fr_.85fr]">
        <article class="im-proto-card-hover rounded-2xl border border-[#263249] bg-[linear-gradient(135deg,rgba(24,32,51,.96),rgba(13,17,28,.9))] p-5">
          <div class="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div class="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-[20px] font-extrabold text-cyan-200">
              <img v-if="user?.photo || user?.avatarUrl" :src="user.photo || user.avatarUrl" alt="" class="h-full w-full object-cover" />
              <span v-else>{{ initials }}</span>
            </div>
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-3">
                <h2 class="truncate text-[22px] font-bold text-slate-50">{{ displayName }}</h2>
                <span class="rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-1 text-[11px] font-bold text-amber-200">{{ subscriptionLabel }} member</span>
                <div>
                  <RouterLink
        to="/sessions/new"
        class="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-slate-50 px-5 text-[13px] font-bold !text-black ml-2 sm:mt-0"
      >
        Start Session
      </RouterLink>
                </div>
              </div>
              <p class="mt-1 text-[13px] text-slate-400">{{ user?.email }}</p>
              <p v-if="latestProfileSession?.role || latestProfileSession?.company" class="mt-2 text-[13px] font-semibold text-slate-300">
                <!-- {{ latestProfileSession?.role || 'Role not provided' }} -->
                <!-- <span v-if="latestProfileSession?.company"> at {{ latestProfileSession.company }}</span> -->
              </p>
            </div>
          </div>
          <div class="mt-5 grid gap-4 border-t border-[#28344a] pt-4 sm:grid-cols-3">
            <div>
              <p class="text-[11px] font-bold uppercase text-slate-500">Member since</p>
              <p class="mt-1.5 text-[13px] font-semibold text-slate-200">{{ formatDate(user?.createdAt) }}</p>
            </div>
            <div>
              <p class="text-[11px] font-bold uppercase text-slate-500">Last login</p>
              <p class="mt-1.5 text-[13px] font-semibold text-slate-200">{{ formatDateTime(user?.lastLoginAt) }}</p>
            </div>
            <div>
              <p class="text-[11px] font-bold uppercase text-slate-500">Current status</p>
              <p class="mt-1.5 inline-flex items-center gap-2 text-[13px] font-semibold text-emerald-300">
                <span class="h-2 w-2 rounded-full bg-emerald-400"></span>{{ currentStatus }}
              </p>
            </div>
          </div>
        </article>

        <article class="im-proto-card-hover rounded-2xl border border-violet-300/20 bg-[linear-gradient(145deg,rgba(91,33,182,.2),rgba(14,19,31,.94)_58%)] p-5">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[12px] font-bold uppercase text-violet-200">Subscription</p>
              <h2 class="mt-1.5 text-[25px] font-extrabold text-slate-50">{{ subscriptionLabel }}</h2>
            </div>
            <span :class="subscription?.active ? 'bg-emerald-400/10 text-emerald-300' : 'bg-slate-700 text-slate-300'" class="rounded-full px-3 py-1 text-[11px] font-bold">
              {{ subscription?.active ? 'Active' : 'Inactive' }}
            </span>
          </div>
          <div class="mt-5 grid grid-cols-2 gap-4">
            <div>
              <p class="text-[11px] font-bold uppercase text-slate-500">Plan</p>
              <p class="mt-1.5 text-[14px] font-semibold text-slate-200">{{ subscription?.plan?.name || 'No active plan' }}</p>
            </div>
            <div>
              <p class="text-[11px] font-bold uppercase text-slate-500">Usage rate</p>
              <p class="mt-1.5 text-[14px] font-semibold text-slate-200">{{ subscription?.creditsPerMinute ?? 0 }} credits / minute</p>
            </div>
          </div>
          <div class="mt-5">
            <div class="flex justify-between text-[12px] font-semibold text-slate-400">
              <span>{{ displayedCreditsRemaining }} credits remaining</span>
              <span>{{ subscriptionProgress }}%</span>
            </div>
            <div class="mt-2 h-2 overflow-hidden rounded-full bg-slate-800">
              <div class="h-full rounded-full bg-[linear-gradient(90deg,#8b5cf6,#22d3ee)] transition-[width] duration-500" :style="{ width: `${subscriptionProgress}%` }"></div>
            </div>
          </div>
        </article>
      </section>

      <KPIGrid :items="kpiItems" />
    </template>
  </div>
</template>
