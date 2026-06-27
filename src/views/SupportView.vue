<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import SupportForm from '@/components/support/SupportForm.vue'
import VersionInformationCard from '@/components/support/VersionInformationCard.vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import {
  getSupportVersionInfo,
  submitSupportRequest,
  type SupportDiagnostics,
  type SupportRequest,
  type SupportRequestType,
} from '@/services/supportService'
import { useAuthStore } from '@/stores/auth.store'
import { useSubscriptionStore } from '@/stores/subscription.store'
import { useUiStore } from '@/stores/ui.store'

const ready = ref(false)
const submitting = ref(false)
const selectedType = ref<SupportRequestType>('support')
const authStore = useAuthStore()
const subscriptionStore = useSubscriptionStore()
const uiStore = useUiStore()
const versionInfo = ref<SupportDiagnostics>({})
const user = computed(() => authStore.user)
const subscription = computed(() => subscriptionStore.subscription)

const supportOptions: Array<{
  type: SupportRequestType
  title: string
  description: string
  placeholder: string
}> = [
  {
    type: 'support',
    title: 'Contact Support',
    description: 'Send account, billing, or technical questions to the support team.',
    placeholder: 'How can we help you?',
  },
  {
    type: 'bug',
    title: 'Report a Bug',
    description: 'Share logs, screenshots, and steps to reproduce product issues.',
    placeholder: 'Describe the issue, what happened, and how to reproduce it.',
  },
  {
    type: 'feature',
    title: 'Feature Request',
    description: 'Suggest improvements for AI answers, screen capture, or workflow controls.',
    placeholder: "Tell us about the feature you'd like to see.",
  },
]

const selectedOption = computed(
  () => supportOptions.find((option) => option.type === selectedType.value) ?? supportOptions[0]!,
)

const refreshVersionInfo = () => {
  versionInfo.value = getSupportVersionInfo()
}

const handleSubmit = async (request: SupportRequest) => {
  submitting.value = true
  try {
    await submitSupportRequest(request, {
      user: user.value,
      subscription: subscription.value,
    })
    refreshVersionInfo()
    uiStore.pushToast({
      type: 'success',
      title: 'Your request has been submitted successfully.',
      description: "We'll review it and get back to you as soon as possible.",
    })
  } catch {
    uiStore.pushToast({
      type: 'error',
      title: 'Could not submit report',
      description: 'Please check your connection and try again.',
    })
  } finally {
    submitting.value = false
  }
}

onMounted(() => {
  void subscriptionStore.load().finally(refreshVersionInfo)
  refreshVersionInfo()
  window.requestAnimationFrame(() => {
    ready.value = true
  })
})
</script>

<template>
  <div class="im-support-page">
    <section>
      <h1 class="text-[36px] font-extrabold leading-none text-slate-50">Support</h1>
      <p class="mt-2 text-[14px] font-medium text-slate-300">Help center, diagnostics, and product feedback</p>
    </section>

    <section v-if="!ready" class="mt-4 grid gap-4 xl:grid-cols-3">
      <article v-for="item in 3" :key="item" class="min-h-[140px] rounded-[18px] border border-[#334155] bg-[#111827] px-8 py-5">
        <SkeletonBlock class="h-5 w-36" />
        <SkeletonBlock class="mt-5 h-4 w-full" />
        <SkeletonBlock class="mt-3 h-4 w-3/4" />
      </article>
    </section>

    <section v-else class="mt-4 grid gap-4 xl:grid-cols-3">
      <button
        v-for="option in supportOptions"
        :key="option.type"
        class="min-h-[140px] rounded-[18px] border border-[#334155] bg-[#111827] px-8 py-5 text-left transition hover:border-cyan-400"
        :class="selectedType === option.type ? 'border-cyan-400' : ''"
        @click="selectedType = option.type"
      >
        <h2 class="text-[19px] font-bold text-slate-50">{{ option.title }}</h2>
        <p class="mt-4 text-[14px] font-medium text-slate-300">{{ option.description }}</p>
      </button>
    </section>

    <section v-if="!ready" class="mt-5 grid items-stretch gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-5">
        <SkeletonBlock class="h-5 w-32" />
        <div class="mt-4 grid gap-4 md:grid-cols-2">
          <div v-for="item in 4" :key="item" class="rounded-[10px] border border-[#334155] bg-[#111827] p-4">
            <SkeletonBlock class="h-3 w-24" />
            <SkeletonBlock class="mt-3 h-4 w-32" />
          </div>
        </div>
      </article>
      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-5">
        <SkeletonBlock class="h-5 w-40" />
        <div class="mt-4 space-y-3">
          <SkeletonBlock v-for="item in 3" :key="item" class="h-4 w-full" />
        </div>
      </article>
    </section>

    <section v-else class="mt-5 grid items-stretch gap-5 xl:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
      <SupportForm
        :initial-email="user?.email ?? ''"
        :loading="submitting"
        :selected-type="selectedType"
        :title="selectedOption.title"
        :placeholder="selectedOption.placeholder"
        @submit="handleSubmit"
      />
      <VersionInformationCard :info="versionInfo" />
    </section>
  </div>
</template>
