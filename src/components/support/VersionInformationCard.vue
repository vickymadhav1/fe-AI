<script setup lang="ts">
import type { SupportDiagnostics } from '@/services/supportService'

defineProps<{
  info: SupportDiagnostics
}>()
</script>

<template>
  <article class="h-full rounded-[18px] border border-[#263347] bg-[#0e1422] p-5">
    <h2 class="text-[19px] font-bold text-slate-50">Version Information</h2>
    <div class="mt-4 space-y-3 text-[14px] font-medium text-slate-300">
      <p v-for="(value, label) in info" :key="label" class="flex justify-between gap-4 border-b border-white/5 pb-3 last:border-b-0 last:pb-0">
        <span>{{ label }}</span>
        <span class="text-right text-slate-50">{{ value }}</span>
      </p>
    </div>
  </article>
</template>
