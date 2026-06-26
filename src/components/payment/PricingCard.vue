<script setup lang="ts">
import type { InvisiblePlan } from '@/types'

defineProps<{
  plan: InvisiblePlan
  featured?: boolean
  busy?: boolean
}>()

defineEmits<{
  purchase: [planId: string]
}>()
</script>

<template>
  <article
    class="im-proto-card-hover rounded-2xl border bg-[#111827] p-7"
    :class="featured ? 'border-cyan-400' : 'border-[#334155]'"
  >
    <h3 class="text-[19px] font-bold text-slate-50">{{ plan.name }}</h3>
    <p class="mt-9 text-[32px] font-extrabold leading-none text-slate-50">INR {{ plan.amount }}</p>
    <p class="mt-6 text-[14px] font-medium text-slate-300">{{ plan.totalCredits }} credits</p>
    <p class="mt-7 text-[13px] font-medium text-slate-500">{{ Math.round(plan.totalCredits / plan.creditsPerMinute) }} active minutes</p>
    <button
      class="mt-8 h-[42px] w-full rounded-lg text-[13px] font-extrabold disabled:opacity-60"
      :class="featured ? 'bg-cyan-400 text-cyan-950' : 'bg-slate-50 text-slate-900'"
      :disabled="busy"
      @click="$emit('purchase', plan.id)"
    >
      Upgrade
    </button>
  </article>
</template>

