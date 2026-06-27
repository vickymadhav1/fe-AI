<script setup lang="ts">
import { SparklesIcon } from '@heroicons/vue/24/outline'
import type { Component } from 'vue'

defineProps<{
  title: string
  description: string
  icon: Component
  metricLabel?: string
  metricValue?: string | number
}>()
</script>

<template>
  <section
    class="benefits-banner relative mt-4 flex min-h-[100px] w-full overflow-hidden rounded-[24px] border border-blue-400/35 bg-[linear-gradient(110deg,#0a1224_0%,#101f52_50%,#15337d_100%)] px-5 py-4 shadow-[0_0_30px_rgba(37,99,235,0.16)] sm:flex-row sm:items-center sm:px-8"
  >
    <div class="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_78%_28%,rgba(56,189,248,0.22),transparent_28%),linear-gradient(90deg,rgba(2,6,23,0.52),transparent_64%)]"></div>
    <div class="relative z-10 flex w-full flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
      <div class="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-blue-300/10 bg-blue-500/20 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
        <component :is="icon" class="h-8 w-8 text-sky-300" />
      </div>

      <div class="min-w-0 flex-1">
        <h2 class="text-[24px] font-extrabold leading-none text-slate-50 sm:text-[26px]">
          {{ title }}
        </h2>
        <p class="mt-3 max-w-[980px] text-[14px] font-semibold leading-5 text-slate-300 sm:text-[15px]">
          {{ description }}
        </p>
      </div>

      <div
        v-if="metricLabel && metricValue !== undefined"
        class="shrink-0 rounded-[14px] border border-sky-300/20 bg-slate-950/28 px-5 py-3 text-left sm:min-w-[172px] sm:text-right"
      >
        <p class="text-[10px] font-bold uppercase tracking-[0.08em] text-sky-200/70">
          {{ metricLabel }}
        </p>
        <p class="mt-1 text-[21px] font-extrabold leading-none text-slate-50">
          {{ metricValue }}
        </p>
      </div>
    </div>

    <div class="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 text-sky-300/50 xl:block">
      <slot name="decoration">
        <div class="relative h-20 w-24">
          <SparklesIcon class="absolute right-5 top-6 h-12 w-12 text-sky-300 drop-shadow-[0_0_18px_rgba(56,189,248,0.45)]" />
          <SparklesIcon class="absolute right-0 top-2 h-4 w-4 text-blue-400" />
          <SparklesIcon class="absolute bottom-2 right-2 h-3.5 w-3.5 text-blue-400" />
          <SparklesIcon class="absolute left-2 top-8 h-3.5 w-3.5 text-blue-500" />
        </div>
      </slot>
    </div>
  </section>
</template>
