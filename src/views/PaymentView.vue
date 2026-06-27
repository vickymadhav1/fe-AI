<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ArrowPathIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'
import { api } from '@/services/api'
import CreditStats from '@/components/invisible/CreditStats.vue'
import ProtectionCard from '@/components/invisible/ProtectionCard.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import PricingCard from '@/components/payment/PricingCard.vue'
import { razorpayConfig, requireRazorpayFrontendKey } from '@/config/razorpay.config'
import { useAuthStore } from '@/stores/auth.store'
import { useSessionStore } from '@/stores/session.store'
import { useSubscriptionStore } from '@/stores/subscription.store'
import { type StealthSettings, useUiStore } from '@/stores/ui.store'
import type { AiProviderHealth, AiProviderStatus } from '@/types'

const authStore = useAuthStore()
const sessionStore = useSessionStore()
const subscriptionStore = useSubscriptionStore()
const uiStore = useUiStore()
const razorpayLoading = ref(false)
const loadingProviders = ref(false)
const providers = ref<AiProviderHealth[]>([])
const stealthState = ref<StealthProtectionResult | null>(null)
const invisibleProtectionStatus = ref('')

const subscription = computed(() => subscriptionStore.subscription)
const remainingCredits = computed(() => subscription.value?.remainingCredits ?? 0)
const totalCredits = computed(() => subscription.value?.totalCredits ?? 0)
const creditsUsed = computed(() => subscription.value?.creditsUsed ?? 0)
const creditsPerMinute = computed(() => subscription.value?.creditsPerMinute ?? 0)
const remainingMinutes = computed(() => Math.floor(remainingCredits.value / Math.max(1, creditsPerMinute.value)))
const currentPlan = computed(() => subscription.value?.plan?.name ?? 'No active plan')
const subscriptionStatus = computed(() => {
  const status = subscription.value?.status ?? 'inactive'
  if (status === 'active') return remainingCredits.value <= 50 ? 'Active (Credits Low)' : 'Active (Credits Available)'
  if (status === 'exhausted') return 'Exhausted (0 Credits)'
  if (status === 'inactive') return 'Not Subscribed'
  return status
})

const plans = computed(() => subscription.value?.plans ?? [])
const busy = computed(
  () =>
    subscriptionStore.loading ||
    subscriptionStore.creatingOrder ||
    subscriptionStore.verifyingPayment ||
    razorpayLoading.value,
)

const statusLabel: Record<AiProviderStatus, string> = {
  healthy: 'Healthy',
  invalid_key: 'Invalid key',
  rate_limited: 'Rate limited',
  offline: 'Offline',
  disabled: 'Disabled',
}

const statusColor: Record<AiProviderStatus, string> = {
  healthy: 'bg-emerald-500',
  invalid_key: 'bg-rose-500',
  rate_limited: 'bg-amber-500',
  offline: 'bg-rose-500',
  disabled: 'bg-slate-400',
}

const loadProviderHealth = async (refresh = false) => {
  loadingProviders.value = true
  try {
    providers.value = await api.getAiProviderHealth(refresh)
  } finally {
    loadingProviders.value = false
  }
}

const loadStealthState = async () => {
  stealthState.value = await window.interviewMateDesktop?.stealth.getState() ?? null
  if (stealthState.value) {
    console.info('[Stealth] Native bridge initialized', {
      loaded: stealthState.value.nativeBridgeLoaded,
      platform: stealthState.value.platformName,
    })
  }
}

const updateStealthBoolean = (key: keyof Omit<StealthSettings, 'shortcut'>, event: Event) => {
  uiStore.updateStealthSettings({
    [key]: (event.target as HTMLInputElement).checked,
  })
}

const updateStealthShortcut = (event: Event) => {
  uiStore.updateStealthSettings({
    shortcut: (event.target as HTMLInputElement).value,
  })
}

const explainInvisibleUnavailable = () => {
  if (!subscription.value?.active) return 'An active Invisible credit wallet is required.'
  if (remainingCredits.value <= 0) return 'Invisible credits are exhausted.'
  if (!sessionStore.isRunning) return 'Start an interview before enabling Invisible Mode.'
  return ''
}

const enableInvisibleMode = async () => {
  const unavailable = explainInvisibleUnavailable()
  if (unavailable) {
    uiStore.pushToast({ type: 'info', title: 'Invisible Mode unavailable', description: unavailable })
    return
  }

  await subscriptionStore.setProtection(true)
  const result = await window.interviewMateDesktop?.invisible.setContentProtection(true)
  subscriptionStore.setInvisibleMode(true)
  invisibleProtectionStatus.value = result?.supported === false
    ? result.warning ?? 'Protection depends on operating system and meeting-app support on this platform.'
    : 'Content protection applied.'
  await loadStealthState()
  uiStore.pushToast({ type: 'success', title: 'Invisible Mode enabled' })
}

const disableInvisibleMode = async () => {
  await subscriptionStore.setProtection(false).catch(() => undefined)
  await window.interviewMateDesktop?.invisible.setContentProtection(false)
  subscriptionStore.setInvisibleMode(false)
  invisibleProtectionStatus.value = 'Content protection removed.'
  await loadStealthState()
  uiStore.pushToast({ type: 'info', title: 'Invisible Mode disabled' })
}

const toggleInvisibleMode = async () => {
  if (subscriptionStore.invisibleModeActive) {
    await disableInvisibleMode()
    return
  }
  await enableInvisibleMode()
}

const loadRazorpay = () =>
  new Promise<void>((resolve, reject) => {
    if (window.Razorpay) {
      resolve()
      return
    }

    const script = document.createElement('script')
    script.src = razorpayConfig.checkoutUrl
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Razorpay checkout could not load.'))
    document.head.appendChild(script)
  })

const purchase = async (planId = 'invisible_starter') => {
  razorpayLoading.value = true
  let paymentCompleted = false
  try {
    const razorpayKey = requireRazorpayFrontendKey()
    await loadRazorpay()
    const orderResponse = await subscriptionStore.createOrder(planId)
    const checkout = new window.Razorpay!({
      key: razorpayKey,
      amount: orderResponse.order.amount,
      currency: orderResponse.order.currency,
      name: 'Interview Mate AI',
      description: orderResponse.plan.name,
      order_id: orderResponse.order.id,
      method: {
        upi: true,
        card: false,
        netbanking: false,
        wallet: false,
        emi: false,
        paylater: false,
      },
      config: {
        display: {
          blocks: {
            upi: {
              name: 'Pay by UPI',
              instruments: [{ method: 'upi' }],
            },
          },
          sequence: ['block.upi'],
          preferences: {
            show_default_blocks: false,
          },
        },
      },
      prefill: {
        name: authStore.user?.name ?? undefined,
        email: authStore.user?.email,
      },
      theme: { color: '#0891b2' },
      modal: {
        ondismiss: () => {
          if (paymentCompleted) return
          void subscriptionStore.markPaymentFailed(
            orderResponse.order.id,
            'Payment cancelled by user',
          )
          uiStore.pushToast({ type: 'info', title: 'Payment cancelled' })
        },
      },
      handler: async (response) => {
        paymentCompleted = true
        await subscriptionStore.verifyPayment({
          razorpayOrderId: response.razorpay_order_id,
          razorpayPaymentId: response.razorpay_payment_id,
          razorpaySignature: response.razorpay_signature,
        })
        await subscriptionStore.load()
        uiStore.pushToast({ type: 'success', title: 'Invisible credits added' })
      },
    })

    checkout.on('payment.failed', (response) => {
      paymentCompleted = true
      void subscriptionStore.markPaymentFailed(
        orderResponse.order.id,
        response.error?.description ?? response.error?.reason ?? 'Payment failed',
      )
      uiStore.pushToast({
        type: 'error',
        title: 'Payment failed',
        description: response.error?.description ?? 'Try again.',
      })
    })
    checkout.open()
  } catch (error) {
    uiStore.pushToast({
      type: 'error',
      title: 'Payment unavailable',
      description: error instanceof Error ? error.message : 'Try again.',
    })
  } finally {
    razorpayLoading.value = false
  }
}

onMounted(() => {
  void subscriptionStore.load()
  void loadProviderHealth()
  void loadStealthState()
})
</script>

<template>
  <div class="im-prototype-page">
    <section class="flex flex-wrap items-start justify-between gap-5">
      <div>
        <h1 class="text-[40px] font-extrabold leading-none text-slate-50">Payment</h1>
        <p class="mt-5 text-[14px] font-medium text-slate-300">Subscription, wallet, checkout, and interview preferences</p>
      </div>
      <div class="rounded-[14px] border border-[#263347] bg-[#0b111d] px-6 py-4">
        <p class="text-[11px] font-bold uppercase text-slate-500">Wallet Balance</p>
        <p class="mt-2 text-[24px] font-extrabold text-slate-50">{{ subscription?.remainingCredits ?? 0 }} credits</p>
      </div>
    </section>

    <section v-if="subscriptionStore.loading" class="mt-9 grid gap-6 xl:grid-cols-[1fr_420px]">
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
        <SkeletonBlock class="h-5 w-32" />
        <div class="mt-7 space-y-4">
          <SkeletonBlock v-for="item in 5" :key="item" class="h-4 w-full" />
        </div>
      </article>
    </section>

    <section v-else class="mt-9 grid gap-6 xl:grid-cols-[1fr_420px]">
      <!-- <CreditStats
        :remaining-credits="remainingCredits"
        :total-credits="totalCredits || Math.max(remainingCredits, 1)"
        :credits-used="creditsUsed"
        :credits-per-minute="creditsPerMinute"
      /> -->

      <!-- <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-6">
        <h2 class="text-[19px] font-bold text-slate-50">Subscription</h2>
        <div class="mt-7 space-y-4 text-[14px] font-medium text-slate-300">
          <p class="flex justify-between gap-4"><span>Current Plan</span><span class="text-right text-slate-50">{{ currentPlan }}</span></p>
          <p class="flex justify-between gap-4"><span>Status</span><span class="text-right text-cyan-300">{{ subscriptionStatus }}</span></p>
          <p class="flex justify-between gap-4"><span>Remaining Minutes</span><span class="text-right text-slate-50">{{ remainingMinutes }}</span></p>
          <p class="flex justify-between gap-4"><span>Consumption Rate</span><span class="text-right text-slate-50">{{ creditsPerMinute }} credits / active minute</span></p>
          <p class="flex justify-between gap-4"><span>Renewal</span><span class="text-right text-slate-50">Top up anytime</span></p>
        </div>
      </article> -->
    </section>

    <section v-if="subscriptionStore.loading" class="mt-8 grid gap-6 xl:grid-cols-3">
      <article v-for="item in 3" :key="item" class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <SkeletonBlock class="h-5 w-36" />
        <div class="mt-7 space-y-4">
          <SkeletonBlock v-for="line in 3" :key="line" class="h-4 w-full" />
        </div>
      </article>
    </section>

    <section v-else class="mt-8 grid gap-6 xl:grid-cols-3">
      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <h2 class="text-[19px] font-bold text-slate-50">Wallet</h2>
        <div class="mt-7 space-y-4 text-[14px] font-medium text-slate-300">
          <p class="flex justify-between"><span>Balance</span><span>{{ remainingCredits }} credits</span></p>
          <p class="flex justify-between"><span>Credits Used</span><span>{{ creditsUsed }}</span></p>
          <p class="flex justify-between"><span>Last Used</span><span>{{ subscription?.lastUsedAt ? new Date(subscription.lastUsedAt).toLocaleDateString() : 'Never' }}</span></p>
        </div>
      </article>

      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <h2 class="text-[19px] font-bold text-slate-50">Credit history</h2>
        <div class="mt-7 space-y-4 text-[14px] font-medium text-slate-300">
          <p class="flex justify-between"><span>Purchase Date</span><span>{{ subscription?.purchaseDate ? new Date(subscription.purchaseDate).toLocaleDateString() : 'None' }}</span></p>
          <p class="flex justify-between"><span>Last Order</span><span>{{ subscription?.orderId ? 'Recorded' : 'None' }}</span></p>
          <p class="flex justify-between"><span>Payment</span><span>{{ subscription?.paymentId ? 'Verified' : 'Pending' }}</span></p>
        </div>
      </article>

      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <h2 class="text-[19px] font-bold text-slate-50">Usage analytics</h2>
        <div class="mt-7 space-y-4 text-[14px] font-medium text-slate-300">
          <p class="flex justify-between"><span>Total Credits</span><span>{{ totalCredits }}</span></p>
          <p class="flex justify-between"><span>Available Minutes</span><span>{{ remainingMinutes }}</span></p>
          <p class="flex justify-between"><span>Active Interview</span><span>{{ sessionStore.isRunning ? 'Running' : 'Stopped' }}</span></p>
        </div>
      </article>
    </section>

    <section class="mt-9 rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
      <div class="flex items-center justify-between gap-4">
        <h2 class="text-[19px] font-bold text-slate-50">Upgrade credits</h2>
        <span class="text-[13px] font-medium text-slate-500">1 rupee = 1 credit · 5 credits per active minute</span>
      </div>
      <div v-if="subscriptionStore.loading" class="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <article v-for="item in 4" :key="item" class="rounded-2xl border border-[#334155] bg-[#111827] p-7">
          <SkeletonBlock class="h-5 w-28" />
          <SkeletonBlock class="mt-9 h-8 w-24" />
          <SkeletonBlock class="mt-6 h-4 w-32" />
          <SkeletonBlock class="mt-7 h-4 w-28" />
          <SkeletonBlock class="mt-8 h-[42px] w-full rounded-lg" />
        </article>
      </div>
      <div v-else class="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        <PricingCard
          v-for="(plan, index) in plans"
          :key="plan.id"
          :plan="plan"
          :featured="index === 1"
          :busy="busy"
          @purchase="purchase"
        />
      </div>
    </section>

    <section v-if="subscriptionStore.loading" class="mt-8 grid gap-6 xl:grid-cols-[380px_1fr_316px]">
      <article v-for="item in 3" :key="item" class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <SkeletonBlock class="h-5 w-36" />
        <SkeletonBlock class="mt-7 h-4 w-full" />
        <SkeletonBlock class="mt-4 h-4 w-3/4" />
        <SkeletonBlock class="mt-8 h-[54px] w-full rounded-[10px]" />
      </article>
    </section>

    <!-- <section v-else class="mt-8 grid gap-6 xl:grid-cols-[380px_1fr_316px]">
      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <h2 class="text-[19px] font-bold text-slate-50">Wallet top-up</h2>
        <p class="mt-6 text-[14px] font-medium text-slate-300">Choose any plan to add credits to your existing balance. Credits do not expire by time.</p>
        <button
          class="mt-8 flex h-[54px] w-full items-center justify-center gap-2 rounded-[10px] bg-slate-50 text-[14px] font-extrabold text-slate-900 disabled:opacity-60"
          :disabled="busy"
          @click="purchase(plans[0]?.id ?? 'invisible_starter')"
        >
          <ArrowPathIcon v-if="busy" class="h-5 w-5" />
          Purchase
        </button>
      </article>

      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <h2 class="text-[19px] font-bold text-slate-50">Razorpay UPI flow</h2>
        <div class="mt-7 grid gap-4 md:grid-cols-3">
          <div class="rounded-[10px] border border-cyan-200 bg-cyan-50 p-4 text-slate-900">
            <p class="text-[13px] font-extrabold">UPI Apps</p>
          </div>
          <div class="rounded-[10px] border border-slate-300 bg-slate-50 p-4 text-slate-700">
            <p class="text-[13px] font-extrabold">UPI ID</p>
          </div>
          <div class="rounded-[10px] border border-slate-300 bg-slate-50 p-4 text-slate-700">
            <p class="text-[13px] font-extrabold">QR Code</p>
          </div>
        </div>
        <p class="mt-7 text-[13px] font-medium text-slate-500">Cards, wallets, EMI, pay later, and net banking remain disabled in Checkout.</p>
      </article>

      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <h2 class="text-[19px] font-bold text-slate-50">Purchase history</h2>
        <div class="mt-7 space-y-4 text-[14px] font-medium text-slate-300">
          <p class="flex justify-between"><span>Last order</span><span>{{ subscription?.orderId ? 'Recorded' : 'None' }}</span></p>
          <p class="flex justify-between"><span>Payment</span><span>{{ subscription?.paymentId ? 'Verified' : 'Pending' }}</span></p>
          <p class="flex justify-between"><span>Total credits</span><span>{{ subscription?.totalCredits ?? 0 }}</span></p>
        </div>
      </article>
    </section> -->

    <!-- <section class="mt-8 grid gap-6 xl:grid-cols-2">
      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <div class="flex items-center justify-between gap-4">
          <h2 class="text-[19px] font-bold text-slate-50">AI preferences</h2>
          <button class="flex h-9 items-center gap-2 rounded-lg border border-[#334155] bg-[#111827] px-3 text-[12px] font-bold text-slate-300" :disabled="loadingProviders" @click="loadProviderHealth(true)">
            <ArrowPathIcon class="h-4 w-4" />
            Refresh
          </button>
        </div>
        <div v-if="loadingProviders" class="mt-7 space-y-5">
          <SkeletonBlock v-for="item in 4" :key="item" class="h-5 w-full" />
        </div>
        <div v-else class="mt-7 space-y-5">
          <div class="flex items-center justify-between gap-4">
            <span class="text-[14px] font-medium text-slate-300">Preferred AI Provider</span>
            <span class="text-right text-[14px] font-bold text-slate-50">{{ providers[0]?.name ?? 'Gemini' }}</span>
          </div>
          <div class="flex items-center justify-between gap-4">
            <span class="text-[14px] font-medium text-slate-300">Suggestion Style</span>
            <span class="text-right text-[14px] font-bold text-slate-50">Concise</span>
          </div>
          <div class="flex items-center justify-between gap-4">
            <span class="text-[14px] font-medium text-slate-300">Answer Depth</span>
            <span class="text-right text-[14px] font-bold text-slate-50">Senior</span>
          </div>
          <div v-if="providers[0]" class="flex items-center gap-2 text-[12px] font-semibold text-slate-400">
            <span class="h-2.5 w-2.5 rounded-full" :class="statusColor[providers[0].status]"></span>
            {{ providers[0].name }} {{ statusLabel[providers[0].status] }}
          </div>
        </div>
      </article>

      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <h2 class="text-[19px] font-bold text-slate-50">Capture preferences</h2>
        <div v-if="subscriptionStore.loading" class="mt-7 space-y-5">
          <SkeletonBlock v-for="item in 4" :key="item" class="h-5 w-full" />
        </div>
        <div v-else class="mt-7 space-y-5 text-[14px] font-medium text-slate-300">
          <p class="flex justify-between gap-4"><span>Capture Interval</span><span class="text-right text-slate-50">15 sec</span></p>
          <p class="flex justify-between gap-4"><span>Supported Meeting Detection</span><span class="text-right text-cyan-300">{{ sessionStore.activeMeetingApp || 'Pending' }}</span></p>
          <p class="flex justify-between gap-4"><span>Screen Validation Status</span><span class="text-right text-slate-50">{{ sessionStore.screenStatus || 'Idle' }}</span></p>
          <p class="flex justify-between gap-4"><span>Capture Source</span><span class="text-right text-slate-50">{{ sessionStore.sourceName || 'Not selected' }}</span></p>
        </div>
      </article>
    </section> -->

    <!-- <section class="mt-8 grid gap-6 xl:grid-cols-[1fr_420px]">
      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <div class="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 class="text-[19px] font-bold text-slate-50">Invisible preferences</h2>
            <p class="mt-3 text-[13px] font-medium text-slate-500">Protection controls and platform capability status</p>
          </div>
          <button
            class="flex h-[46px] min-w-[210px] items-center justify-center gap-3 rounded-full border border-teal-700 bg-teal-950 px-5 text-[13px] font-extrabold text-teal-100 disabled:opacity-60"
            :disabled="subscriptionStore.loading"
            @click="toggleInvisibleMode"
          >
            <EyeSlashIcon class="h-5 w-5" />
            {{ subscriptionStore.invisibleModeActive ? 'Disable Invisible Mode' : 'Enable Invisible Mode' }}
          </button>
        </div>

        <div v-if="subscriptionStore.loading" class="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div v-for="item in 4" :key="item" class="rounded-[10px] border border-[#334155] bg-[#111827] p-4">
            <SkeletonBlock class="h-3 w-28" />
            <SkeletonBlock class="mt-3 h-4 w-24" />
          </div>
        </div>
        <div v-else class="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div class="rounded-[10px] border border-[#334155] bg-[#111827] p-4">
            <p class="text-[11px] font-bold uppercase text-slate-500">Native Protection</p>
            <p class="mt-3 text-[14px] font-bold" :class="stealthState?.nativeProtection ? 'text-emerald-300' : 'text-amber-300'">
              {{ stealthState?.nativeProtection ? 'Supported' : 'Fallback' }}
            </p>
          </div>
          <div class="rounded-[10px] border border-[#334155] bg-[#111827] p-4">
            <p class="text-[11px] font-bold uppercase text-slate-500">Capture Exclusion</p>
            <p class="mt-3 text-[14px] font-bold" :class="stealthState?.captureExclusion ? 'text-emerald-300' : 'text-amber-300'">
              {{ stealthState?.captureExclusion ? (stealthState?.enabled ? 'Enabled' : 'Available') : 'Unavailable' }}
            </p>
          </div>
          <div class="rounded-[10px] border border-[#334155] bg-[#111827] p-4">
            <p class="text-[11px] font-bold uppercase text-slate-500">Companion Protection</p>
            <p class="mt-3 text-[14px] font-bold" :class="subscriptionStore.invisibleModeActive ? 'text-emerald-300' : 'text-slate-400'">
              {{ subscriptionStore.invisibleModeActive ? 'Protected' : 'Idle' }}
            </p>
          </div>
          <div class="rounded-[10px] border border-[#334155] bg-[#111827] p-4">
            <p class="text-[11px] font-bold uppercase text-slate-500">Platform</p>
            <p class="mt-3 text-[14px] font-bold text-cyan-300">{{ stealthState?.platformName ?? 'Unknown' }}</p>
          </div>
        </div>

        <p v-if="stealthState?.warning" class="mt-4 rounded-[10px] border border-amber-400/20 bg-amber-400/10 p-4 text-[13px] font-medium text-amber-100">
          {{ stealthState.warning }}
        </p>

        <div class="mt-7 grid gap-4 md:grid-cols-2">
          <label class="flex min-h-12 items-center justify-between gap-4 rounded-[10px] border border-[#334155] bg-[#111827] px-4 py-3 text-[14px] text-slate-300">
            Ask before every interview
            <input :checked="uiStore.stealthSettings.askBeforeInterview" type="checkbox" class="h-5 w-5 accent-cyan-500" @change="updateStealthBoolean('askBeforeInterview', $event)" />
          </label>
          <label class="flex min-h-12 items-center justify-between gap-4 rounded-[10px] border border-[#334155] bg-[#111827] px-4 py-3 text-[14px] text-slate-300">
            Automatically enable Stealth Mode
            <input :checked="uiStore.stealthSettings.autoEnable" type="checkbox" class="h-5 w-5 accent-cyan-500" @change="updateStealthBoolean('autoEnable', $event)" />
          </label>
          <label class="flex min-h-12 items-center gap-3 rounded-[10px] border border-[#334155] bg-[#111827] px-4 py-3 text-[14px] text-slate-300 md:col-span-2">
            Shortcut
            <input :value="uiStore.stealthSettings.shortcut" class="min-w-0 flex-1 bg-transparent text-right text-slate-100 focus:outline-none" @change="updateStealthShortcut" />
          </label>
        </div>

        <p v-if="explainInvisibleUnavailable() && !subscriptionStore.invisibleModeActive" class="mt-5 text-[13px] font-semibold text-amber-300">
          {{ explainInvisibleUnavailable() }}
        </p>
      </article>

      <ProtectionCard
        :active="subscriptionStore.invisibleModeActive"
        :protection-status="invisibleProtectionStatus"
        :meeting-app="sessionStore.activeMeetingApp"
        :active-window-title="sessionStore.activeWindowTitle"
      />
    </section> -->

    <section class="mt-8 rounded-[18px] border border-[#263347] bg-[#0b111d] p-8">
      <h2 class="text-[19px] font-bold text-slate-50">Benefits</h2>
      <p class="mt-4 text-[14px] font-medium text-slate-300">
        Credits never expire by time. Deduction happens only while Invisible Mode is enabled during a running interview.
      </p>
      <p v-if="subscriptionStore.paymentStatus" class="mt-4 text-[13px] font-semibold text-cyan-300">{{ subscriptionStore.paymentStatus }}</p>
      <p v-if="subscriptionStore.error" class="mt-4 text-[13px] font-semibold text-rose-400">{{ subscriptionStore.error }}</p>
    </section>
  </div>
</template>
