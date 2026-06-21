<script setup lang="ts">
import { CheckCircleIcon, ExclamationCircleIcon, InformationCircleIcon, XMarkIcon } from '@heroicons/vue/24/outline'
import { computed } from 'vue'
import { useUiStore } from '@/stores/ui.store'

const uiStore = useUiStore()

const iconMap = {
  success: CheckCircleIcon,
  error: ExclamationCircleIcon,
  info: InformationCircleIcon,
}

const toneMap = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900/70 dark:bg-emerald-950 dark:text-emerald-100',
  error: 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950 dark:text-rose-100',
  info: 'border-sky-200 bg-sky-50 text-sky-900 dark:border-sky-900/70 dark:bg-sky-950 dark:text-sky-100',
}

const toasts = computed(() => uiStore.toasts)
</script>

<template>
  <div class="fixed right-5 top-5 z-50 flex w-[min(420px,calc(100vw-2rem))] flex-col gap-3">
    <div
      v-for="toast in toasts"
      :key="toast.id"
      class="flex items-start gap-3 rounded-lg border p-4 shadow-xl shadow-slate-900/10"
      :class="toneMap[toast.type]"
    >
      <component :is="iconMap[toast.type]" class="mt-0.5 h-5 w-5 shrink-0" />
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold">{{ toast.title }}</p>
        <p v-if="toast.description" class="mt-1 text-sm opacity-80">{{ toast.description }}</p>
      </div>
      <button class="rounded p-1 opacity-70 hover:opacity-100" @click="uiStore.dismissToast(toast.id)">
        <XMarkIcon class="h-4 w-4" />
      </button>
    </div>
  </div>
</template>
