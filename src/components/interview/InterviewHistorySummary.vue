<script setup lang="ts">
import { ClipboardDocumentListIcon } from '@heroicons/vue/24/outline'
import { RouterLink } from 'vue-router'

defineProps<{
  totalInterviews: number
  isLoading: boolean
}>()
</script>

<template>
  <div class="w-full sm:w-auto">
    <div
      v-if="isLoading"
      class="h-9 w-full rounded-full border border-[#334155] bg-[#111827] px-4 py-2 sm:w-[196px]"
      aria-label="Loading interview history"
    >
      <div class="h-full w-full animate-pulse rounded-full bg-white/10"></div>
    </div>

    <RouterLink
      v-else
      to="/history"
      title="View your previous interview sessions"
      class="inline-flex h-9 w-full items-center justify-center gap-2 rounded-full border border-[#334155] bg-[#111827] px-4 text-[13px] font-bold text-slate-300 transition hover:border-cyan-300/50 hover:text-slate-50 sm:w-auto"
    >
      <ClipboardDocumentListIcon class="h-4 w-4 shrink-0" />
      <span class="truncate">
        {{ totalInterviews > 0 ? `${totalInterviews} Past Interviews` : 'No Previous Interviews' }}
      </span>
      <span v-if="totalInterviews > 0" aria-hidden="true">-&gt;</span>
    </RouterLink>
  </div>
</template>
