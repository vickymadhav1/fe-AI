<script setup lang="ts">
import { ChevronDownIcon } from '@heroicons/vue/24/outline'
import PremiumBadge from './PremiumBadge.vue'

defineProps<{
  name: string
}>()
</script>

<template>
  <button
    class="inline-flex h-10 items-center gap-3 rounded-full border border-white/10 bg-white/[0.04] px-3 text-[13px] font-bold text-slate-200 transition hover:border-amber-300/30 hover:bg-white/[0.06] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
    type="button"
  >
    <PremiumBadge />
    <span class="max-w-[180px] truncate">{{ name }}</span>
    <!-- <ChevronDownIcon class="h-4 w-4 text-slate-500" /> -->
  </button>
</template>
