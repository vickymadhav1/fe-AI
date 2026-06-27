<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  title: string
  value: string | number
  icon: Component
  helper?: string
}>()
</script>

<template>
  <article class="im-proto-card-hover flex min-h-[132px] flex-col justify-between rounded-2xl border border-[#263249] bg-[#101827] p-6">
    <div class="flex items-start justify-between gap-3">
      <div class="flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-300/15 bg-cyan-300/10 text-cyan-200">
        <component :is="icon" class="h-[18px] w-[18px]" />
      </div>
      <p v-if="helper" class="rounded-full bg-white/[0.04] px-3 py-1 text-[11px] font-bold text-slate-400">
        {{ helper }}
      </p>
    </div>

    <div class="mt-4">
      <p class="text-[11px] font-bold uppercase leading-4 text-slate-500">{{ title }}</p>
      <p class="mt-1.5 text-[28px] font-extrabold leading-none text-slate-50">{{ value }}</p>
    </div>
  </article>
</template>
