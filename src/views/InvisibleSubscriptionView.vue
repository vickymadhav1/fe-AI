<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { EyeSlashIcon } from '@heroicons/vue/24/outline'
import CreditStats from '@/components/invisible/CreditStats.vue'
import ProtectionCard from '@/components/invisible/ProtectionCard.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import { useSessionStore } from '@/stores/session.store'
import { useSubscriptionStore } from '@/stores/subscription.store'
import { useUiStore } from '@/stores/ui.store'

const sessionStore = useSessionStore()
const subscriptionStore = useSubscriptionStore()
const uiStore = useUiStore()
const protectionStatus = ref('')
let creditTimer = 0

const subscription = computed(() => subscriptionStore.subscription)
const remainingCredits = computed(() => subscription.value?.remainingCredits ?? 0)
const totalCredits = computed(() => subscription.value?.totalCredits ?? 0)
const creditsUsed = computed(() => subscription.value?.creditsUsed ?? 0)
const creditsPerMinute = computed(() => subscription.value?.creditsPerMinute ?? 5)
const remainingMinutes = computed(() =>
  Math.floor(remainingCredits.value / Math.max(1, creditsPerMinute.value)),
)

const statusLabel = computed(() => {
  const status = subscription.value?.status ?? 'inactive'
  if (status === 'active') {
    return remainingCredits.value <= 50 ? 'Active (Credits Low)' : 'Active (Credits Available)'
  }
  if (status === 'exhausted') return 'Exhausted (0 Credits)'
  if (status === 'inactive') return 'Not Subscribed'
  return status
})

const stopCreditTimer = () => {
  window.clearInterval(creditTimer)
  creditTimer = 0
}

const explainUnavailable = () => {
  if (!subscription.value?.active) return 'An active Invisible subscription is required.'
  if (remainingCredits.value <= 0) return 'Invisible credits are exhausted.'
  if (!sessionStore.isRunning) return 'Start an interview before enabling Invisible Mode.'
  return ''
}

const startCreditTimer = () => {
  stopCreditTimer()
  creditTimer = window.setInterval(async () => {
    if (!sessionStore.isRunning) {
      await disableInvisibleMode('Interview stopped. Invisible Mode disabled.')
      return
    }
    await subscriptionStore.deductMinute()
    if (!subscriptionStore.invisibleModeActive) {
      await disableInvisibleMode('Invisible credits exhausted')
    }
  }, 60_000)
}

const enableInvisibleMode = async () => {
  const unavailable = explainUnavailable()
  if (unavailable) {
    uiStore.pushToast({ type: 'info', title: 'Invisible Mode unavailable', description: unavailable })
    return
  }

  await subscriptionStore.setProtection(true)
  const result = await window.interviewMateDesktop?.invisible.setContentProtection(true)
  subscriptionStore.setInvisibleMode(true)
  protectionStatus.value = result?.supported === false
    ? result.warning ?? 'Protection depends on operating system and meeting-app support on this platform.'
    : 'Content protection applied.'
  console.info('[Invisible] Enabled')
  console.info('[Invisible] Content Protection Applied')
  startCreditTimer()
  uiStore.pushToast({ type: 'success', title: 'Invisible Mode enabled' })
}

const disableInvisibleMode = async (message = 'Invisible Mode disabled') => {
  stopCreditTimer()
  await subscriptionStore.setProtection(false).catch(() => undefined)
  await window.interviewMateDesktop?.invisible.setContentProtection(false)
  subscriptionStore.setInvisibleMode(false)
  protectionStatus.value = 'Content protection removed.'
  console.info('[Invisible] Disabled')
  console.info('[Invisible] Content Protection Removed')
  uiStore.pushToast({ type: 'info', title: message })
}

const toggleInvisibleMode = async () => {
  if (subscriptionStore.invisibleModeActive) {
    await disableInvisibleMode()
    return
  }
  await enableInvisibleMode()
}

onMounted(() => void subscriptionStore.load())

onBeforeUnmount(() => {
  if (subscriptionStore.invisibleModeActive) void disableInvisibleMode('Invisible Mode disabled')
})
</script>

<template>
  <div class="im-prototype-page">
    <section class="flex flex-wrap items-start justify-between gap-5">
      <div>
        <h1 class="text-[40px] font-extrabold leading-none text-slate-50">Invisible Mode</h1>
        <p class="mt-5 text-[14px] font-medium text-slate-300">Capture protection, session status, and credit usage</p>
      </div>
      <button
        class="flex h-[52px] min-w-[230px] items-center gap-4 rounded-full border border-teal-700 bg-teal-950 pl-3 pr-6 text-[14px] font-extrabold text-teal-100 disabled:opacity-60"
        :disabled="subscriptionStore.loading"
        @click="toggleInvisibleMode"
      >
        <span class="flex h-9 w-9 items-center justify-center rounded-full bg-teal-300 text-teal-950">
          <EyeSlashIcon class="h-5 w-5" />
        </span>
        {{ subscriptionStore.invisibleModeActive ? 'Invisible Mode On' : 'Invisible Mode Off' }}
      </button>
    </section>

    <section v-if="subscriptionStore.loading" class="mt-8 grid gap-6 xl:grid-cols-[1fr_432px]">
      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-6">
        <SkeletonBlock class="h-5 w-32" />
        <div class="mt-8 grid gap-4 sm:grid-cols-3">
          <div v-for="item in 3" :key="item">
            <SkeletonBlock class="h-3 w-28" />
            <SkeletonBlock class="mt-3 h-9 w-24" />
          </div>
        </div>
        <SkeletonBlock class="mt-7 h-[18px] w-full rounded-full" />
        <SkeletonBlock class="mt-4 h-3 w-28" />
      </article>
      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-6">
        <SkeletonBlock class="h-5 w-40" />
        <div class="mt-8 space-y-5">
          <SkeletonBlock v-for="item in 4" :key="item" class="h-5 w-full" />
        </div>
      </article>
    </section>

    <section v-else class="mt-8 grid gap-6 xl:grid-cols-[1fr_432px]">
      <CreditStats
        :remaining-credits="remainingCredits"
        :total-credits="totalCredits || Math.max(remainingCredits, 1)"
        :credits-used="creditsUsed"
        :credits-per-minute="creditsPerMinute"
      />
      <ProtectionCard
        :active="subscriptionStore.invisibleModeActive"
        :protection-status="protectionStatus"
        :meeting-app="sessionStore.activeMeetingApp"
        :active-window-title="sessionStore.activeWindowTitle"
      />
    </section>

    <section v-if="subscriptionStore.loading" class="mt-6 grid gap-6 xl:grid-cols-3">
      <article v-for="item in 3" :key="item" class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-6">
        <SkeletonBlock class="h-3 w-32" />
        <SkeletonBlock class="mt-4 h-8 w-36" />
      </article>
    </section>

    <section v-else class="mt-6 grid gap-6 xl:grid-cols-3">
      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-6">
        <p class="text-[11px] font-bold uppercase text-slate-500">Subscription Status</p>
        <p class="mt-4 text-[24px] font-extrabold text-slate-50">{{ statusLabel }}</p>
      </article>
      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-6">
        <p class="text-[11px] font-bold uppercase text-slate-500">Remaining Minutes</p>
        <p class="mt-4 text-[24px] font-extrabold text-slate-50">{{ remainingMinutes }}</p>
      </article>
      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-6">
        <p class="text-[11px] font-bold uppercase text-slate-500">Active Session</p>
        <p class="mt-4 text-[24px] font-extrabold text-slate-50">{{ sessionStore.isRunning ? 'Running' : 'Not running' }}</p>
      </article>
    </section>

    <section class="mt-6 rounded-[18px] border border-[#263347] bg-[#0e1422] p-6">
      <!-- <h2 class="text-[19px] font-bold text-slate-50">Session information</h2> -->
      <div v-if="subscriptionStore.loading" class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <!-- <div v-for="item in 4" :key="item" class="rounded-[10px] border border-[#334155] bg-[#111827] p-4">
          <SkeletonBlock class="h-3 w-24" />
          <SkeletonBlock class="mt-3 h-4 w-32" />
        </div> -->
      </div>
      <!-- <div v-else class="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div class="rounded-[10px] border border-[#334155] bg-[#111827] p-4">
          <p class="text-[11px] font-bold uppercase text-slate-500">Meeting App</p>
          <p class="mt-3 text-[14px] font-bold text-slate-200">{{ sessionStore.activeMeetingApp || 'Pending' }}</p>
        </div>
        <div class="rounded-[10px] border border-[#334155] bg-[#111827] p-4">
          <p class="text-[11px] font-bold uppercase text-slate-500">Capture Source</p>
          <p class="mt-3 text-[14px] font-bold text-slate-200">{{ sessionStore.sourceName || 'Not selected' }}</p>
        </div>
        <div class="rounded-[10px] border border-[#334155] bg-[#111827] p-4">
          <p class="text-[11px] font-bold uppercase text-slate-500">Interview</p>
          <p class="mt-3 text-[14px] font-bold text-slate-200">{{ sessionStore.isRunning ? 'Running' : 'Stopped' }}</p>
        </div>
        <div class="rounded-[10px] border border-[#334155] bg-[#111827] p-4">
          <p class="text-[11px] font-bold uppercase text-slate-500">Protection</p>
          <p class="mt-3 text-[14px] font-bold text-slate-200">{{ protectionStatus || 'Idle' }}</p>
        </div>
      </div> -->
      <p v-if="explainUnavailable() && !subscriptionStore.invisibleModeActive" class="mt-5 text-[13px] font-semibold text-amber-300">
        {{ explainUnavailable() }}
      </p>
    </section>
  </div>
</template>
