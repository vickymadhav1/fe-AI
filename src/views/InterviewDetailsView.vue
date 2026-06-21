<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import { PencilSquareIcon, PlayIcon, TrashIcon } from '@heroicons/vue/24/outline'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useInterviewStore } from '@/stores/interview.store'
import { useUiStore } from '@/stores/ui.store'

const route = useRoute()
const router = useRouter()
const interviewStore = useInterviewStore()
const uiStore = useUiStore()

onMounted(() => {
  if (!interviewStore.interviews.length) interviewStore.fetchInterviews()
})

const interview = computed(() => interviewStore.findById(String(route.params.id)))

const remove = async () => {
  if (!interview.value) return
  interviewStore.deleteInterview(interview.value.id)
  uiStore.pushToast({ type: 'info', title: 'Interview deleted' })
  await router.push('/history')
}
</script>

<template>
  <EmptyState
    v-if="!interview"
    :icon="TrashIcon"
    title="Interview not found"
    description="The selected interview is unavailable or was deleted."
  />

  <div v-else class="space-y-6">
    <section class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div class="flex flex-wrap items-start justify-between gap-5">
        <div>
          <span class="rounded-full bg-cyan-100 px-3 py-1 text-xs font-semibold text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">{{ interview.status }}</span>
          <h2 class="mt-4 text-3xl font-bold">{{ interview.company }}</h2>
          <p class="mt-2 text-lg text-slate-500 dark:text-slate-400">{{ interview.role }}</p>
        </div>
        <div class="flex flex-wrap gap-3">
          <button class="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold dark:border-slate-700">
            <PencilSquareIcon class="h-5 w-5" />
            Edit
          </button>
          <button class="inline-flex items-center gap-2 rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 dark:border-rose-900 dark:text-rose-300" @click="remove">
            <TrashIcon class="h-5 w-5" />
            Delete
          </button>
          <RouterLink :to="`/assistant/${interview.id}`" class="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-950">
            <PlayIcon class="h-5 w-5" />
            Start Interview
          </RouterLink>
        </div>
      </div>
    </section>

    <section class="grid gap-6 lg:grid-cols-3">
      <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <p class="text-sm text-slate-500 dark:text-slate-400">Date</p>
        <p class="mt-2 text-lg font-semibold">{{ interview.date }}</p>
      </div>
      <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <p class="text-sm text-slate-500 dark:text-slate-400">Time</p>
        <p class="mt-2 text-lg font-semibold">{{ interview.time }}</p>
      </div>
      <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <p class="text-sm text-slate-500 dark:text-slate-400">Duration</p>
        <p class="mt-2 text-lg font-semibold">{{ interview.duration }} minutes</p>
      </div>
    </section>

    <section class="grid gap-6 lg:grid-cols-2">
      <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h3 class="font-semibold">Uploaded Resume</h3>
        <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">{{ interview.resumeName || 'No file uploaded' }}</p>
      </div>
      <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h3 class="font-semibold">Uploaded Job Description</h3>
        <p class="mt-3 text-sm text-slate-500 dark:text-slate-400">{{ interview.jobDescriptionName || 'Pasted manually' }}</p>
      </div>
    </section>

    <section class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h3 class="font-semibold">Job Description Notes</h3>
      <p class="mt-3 whitespace-pre-line text-sm leading-6 text-slate-600 dark:text-slate-300">{{ interview.jobDescription }}</p>
    </section>
  </div>
</template>
