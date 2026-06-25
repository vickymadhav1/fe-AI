<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { ArrowPathIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import { razorpayConfig, requireRazorpayFrontendKey } from '@/config/razorpay.config'
import { useAuthStore } from '@/stores/auth.store'
import { useSessionStore } from '@/stores/session.store'
import { useSubscriptionStore } from '@/stores/subscription.store'
import { useUiStore } from '@/stores/ui.store'

const authStore = useAuthStore()
const sessionStore = useSessionStore()
const subscriptionStore = useSubscriptionStore()
const uiStore = useUiStore()
const razorpayLoading = ref(false)
const protectionStatus = ref('')
let creditTimer = 0

const subscription = computed(() => subscriptionStore.subscription)
const plan = computed(() => subscription.value?.plan)
const plans = computed(() => subscription.value?.plans ?? (plan.value ? [plan.value] : []))
const hasPurchased = computed(() => (subscription.value?.totalCredits ?? 0) > 0)
const busy = computed(
  () =>
    subscriptionStore.loading ||
    subscriptionStore.creatingOrder ||
    subscriptionStore.verifyingPayment,
)

const formatDate = (value?: string | null, fallback = 'Never') =>
  value ? new Date(value).toLocaleString() : fallback

const statusLabel = computed(() => {
  const status = subscription.value?.status ?? 'inactive'
  const labels: Record<string, string> = {
    inactive: 'Not Subscribed',
    pending: 'Payment Pending',
    successful: 'Payment Successful',
    active:
      (subscription.value?.remainingCredits ?? 0) <= 50
        ? 'Active (Credits Low)'
        : 'Active (Credits Available)',
    exhausted: 'Exhausted (0 Credits)',
    failed: 'Payment Failed',
  }
  return labels[status] ?? status
})

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

const stopCreditTimer = () => {
  window.clearInterval(creditTimer)
  creditTimer = 0
}

const explainUnavailable = () => {
  if (!subscription.value?.active) return 'An active Invisible subscription is required.'
  if ((subscription.value?.remainingCredits ?? 0) <= 0) return 'Invisible credits are exhausted.'
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
    ? 'Protection depends on operating system and meeting-app support on this platform.'
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
  void disableInvisibleMode('Invisible Mode disabled')
})
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex items-center gap-3">
          <EyeSlashIcon class="h-7 w-7 text-cyan-500" />
          <div>
            <h2 class="text-xl font-bold">Invisible Subscription</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Premium Invisible Mode access.</p>
          </div>
        </div>
        <button
          class="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          :disabled="busy"
          @click="purchase()"
        >
          <ArrowPathIcon v-if="razorpayLoading || subscriptionStore.creatingOrder || subscriptionStore.verifyingPayment" class="h-5 w-5 animate-spin" />
          {{ hasPurchased ? 'Add Credits' : 'Purchase' }}
        </button>
      </div>
    </section>

    <section class="grid gap-6 lg:grid-cols-[360px_1fr]">
      <article class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <template v-if="subscriptionStore.loading">
          <SkeletonBlock class="h-6 w-40" />
          <SkeletonBlock class="mt-5 h-20 w-full" />
          <SkeletonBlock class="mt-4 h-10 w-32" />
        </template>
        <template v-else>
          <p class="text-sm text-slate-500 dark:text-slate-400">{{ hasPurchased ? 'Upgrade' : 'Plan' }}</p>
          <h3 class="mt-2 text-2xl font-bold">{{ hasPurchased ? 'Add Invisible Credits' : 'Starter' }}</h3>
          <div class="mt-5 space-y-3">
            <button
              v-for="item in plans"
              :key="item.id"
              class="w-full rounded-lg border border-slate-200 p-4 text-left transition hover:border-cyan-500 disabled:opacity-60 dark:border-slate-800"
              :disabled="busy"
              @click="purchase(item.id)"
            >
              <span class="block font-semibold">{{ item.name }}</span>
              <span class="mt-1 block text-2xl font-bold">₹{{ item.amount }}</span>
              <span class="mt-1 block text-sm text-slate-500 dark:text-slate-400">
                {{ item.totalCredits }} credits
              </span>
            </button>
          </div>
        </template>
      </article>

      <article class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <template v-if="subscriptionStore.loading || subscriptionStore.verifyingPayment">
          <div class="grid gap-4 md:grid-cols-2">
            <SkeletonBlock v-for="item in 6" :key="item" class="h-20 w-full" />
          </div>
        </template>
        <template v-else>
          <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            <div class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <p class="text-xs font-bold uppercase text-slate-400">Subscription Status</p>
              <p class="mt-2 text-lg font-semibold">{{ statusLabel }}</p>
            </div>
            <div class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <p class="text-xs font-bold uppercase text-slate-400">Total Credits</p>
              <p class="mt-2 text-lg font-semibold">{{ subscription?.totalCredits ?? 0 }}</p>
            </div>
            <div class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <p class="text-xs font-bold uppercase text-slate-400">Credits Remaining</p>
              <p class="mt-2 text-lg font-semibold">{{ subscription?.remainingCredits ?? 0 }}</p>
            </div>
            <div class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <p class="text-xs font-bold uppercase text-slate-400">Credits Used</p>
              <p class="mt-2 text-lg font-semibold">{{ subscription?.creditsUsed ?? 0 }}</p>
            </div>
            <div class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <p class="text-xs font-bold uppercase text-slate-400">Usage Rate</p>
              <p class="mt-2 text-lg font-semibold">{{ subscription?.creditsPerMinute ?? 5 }} Credits / Minute</p>
            </div>
            <div class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <p class="text-xs font-bold uppercase text-slate-400">Last Used</p>
              <p class="mt-2 text-sm font-semibold">{{ formatDate(subscription?.lastUsedAt) }}</p>
            </div>
            <div class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <p class="text-xs font-bold uppercase text-slate-400">Purchase Date</p>
              <p class="mt-2 text-sm font-semibold">{{ formatDate(subscription?.purchaseDate, 'Not purchased') }}</p>
            </div>
            <div class="rounded-lg border border-slate-200 p-4 dark:border-slate-800">
              <p class="text-xs font-bold uppercase text-slate-400">Invisible Mode</p>
              <p class="mt-2 text-lg font-semibold">
                {{ subscriptionStore.invisibleModeActive ? 'Enabled' : 'Disabled' }}
              </p>
            </div>
          </div>

          <div class="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5 dark:border-slate-800">
            <div>
              <p class="font-semibold">Invisible Mode</p>
              <p class="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Consumes {{ subscription?.creditsPerMinute ?? 5 }} credits per active minute.
              </p>
            </div>
            <button
              class="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold disabled:opacity-60 dark:border-slate-700"
              :disabled="!subscriptionStore.invisibleModeActive && (!subscription?.active || (subscription?.remainingCredits ?? 0) <= 0 || !sessionStore.isRunning)"
              @click="toggleInvisibleMode"
            >
              {{ subscriptionStore.invisibleModeActive ? 'Disable Invisible Mode' : 'Enable Invisible Mode' }}
            </button>
          </div>

          <p v-if="explainUnavailable() && !subscriptionStore.invisibleModeActive" class="mt-4 text-sm font-semibold text-amber-600">
            {{ explainUnavailable() }}
          </p>

          <p v-if="protectionStatus" class="mt-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
            {{ protectionStatus }}
          </p>

          <p v-if="subscriptionStore.paymentStatus" class="mt-4 text-sm font-semibold text-cyan-600 dark:text-cyan-400">
            {{ subscriptionStore.paymentStatus }}
          </p>
          <p v-if="subscriptionStore.error" class="mt-4 text-sm font-semibold text-rose-600">
            {{ subscriptionStore.error }}
          </p>
        </template>
      </article>
    </section>
  </div>
</template>
