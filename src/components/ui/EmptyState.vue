<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  icon: Component
  title: string
  description: string
}>()
</script>

<template>
  <div class="flex min-h-56 flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-900">
    <component :is="icon" class="h-10 w-10 text-slate-400" />
    <h3 class="mt-4 text-base font-semibold text-slate-950 dark:text-white">{{ title }}</h3>
    <p class="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">{{ description }}</p>
    <slot />
  </div>
</template>
