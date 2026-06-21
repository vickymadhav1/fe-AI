<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowPathIcon } from '@heroicons/vue/24/outline'
import { useInterviewStore } from '@/stores/interview.store'
import { useUiStore } from '@/stores/ui.store'
import type { InterviewType } from '@/types'

const router = useRouter()
const interviewStore = useInterviewStore()
const uiStore = useUiStore()

const form = reactive({
  company: '',
  role: '',
  date: '',
  time: '',
  duration: 45,
  type: 'Technical' as InterviewType,
  meetingLink: '',
  resumeName: '',
  jobDescriptionName: '',
  jobDescription: '',
})

const errors = ref<Record<string, string>>({})

const setFileName = (event: Event, field: 'resumeName' | 'jobDescriptionName') => {
  const input = event.target as HTMLInputElement
  form[field] = input.files?.[0]?.name ?? ''
}

const validate = () => {
  const nextErrors: Record<string, string> = {}
  if (!form.company.trim()) nextErrors.company = 'Company name is required.'
  if (!form.role.trim()) nextErrors.role = 'Role is required.'
  if (!form.date) nextErrors.date = 'Interview date is required.'
  if (!form.time) nextErrors.time = 'Interview time is required.'
  if (!form.meetingLink.trim()) nextErrors.meetingLink = 'Meeting link is required.'
  if (!form.resumeName) nextErrors.resumeName = 'Resume upload is required.'
  if (!form.jobDescriptionName && !form.jobDescription.trim()) {
    nextErrors.jobDescription = 'Upload or paste a job description.'
  }
  errors.value = nextErrors
  return Object.keys(nextErrors).length === 0
}

const submit = async () => {
  if (!validate()) return

  const interview = await interviewStore.createInterview({ ...form })
  uiStore.pushToast({ type: 'success', title: 'Interview created', description: `${interview.company} session is ready.` })
  await router.push(`/interviews/${interview.id}`)
}
</script>

<template>
  <form class="mx-auto max-w-5xl space-y-6" @submit.prevent="submit">
    <section class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div class="mb-6">
        <h2 class="text-2xl font-bold">Create Interview</h2>
        <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">Add the session context the assistant will use later.</p>
      </div>

      <div class="grid gap-5 md:grid-cols-2">
        <label class="space-y-2">
          <span class="text-sm font-medium">Company Name</span>
          <input v-model="form.company" class="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950" />
          <span v-if="errors.company" class="text-sm text-rose-600">{{ errors.company }}</span>
        </label>

        <label class="space-y-2">
          <span class="text-sm font-medium">Role</span>
          <input v-model="form.role" class="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950" />
          <span v-if="errors.role" class="text-sm text-rose-600">{{ errors.role }}</span>
        </label>

        <label class="space-y-2">
          <span class="text-sm font-medium">Interview Date</span>
          <input v-model="form.date" type="date" class="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950" />
          <span v-if="errors.date" class="text-sm text-rose-600">{{ errors.date }}</span>
        </label>

        <label class="space-y-2">
          <span class="text-sm font-medium">Interview Time</span>
          <input v-model="form.time" type="time" class="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950" />
          <span v-if="errors.time" class="text-sm text-rose-600">{{ errors.time }}</span>
        </label>

        <label class="space-y-2">
          <span class="text-sm font-medium">Duration</span>
          <select v-model.number="form.duration" class="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950">
            <option :value="30">30 minutes</option>
            <option :value="45">45 minutes</option>
            <option :value="60">60 minutes</option>
            <option :value="90">90 minutes</option>
          </select>
        </label>

        <label class="space-y-2">
          <span class="text-sm font-medium">Interview Type</span>
          <select v-model="form.type" class="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950">
            <option>Technical</option>
            <option>HR</option>
            <option>Managerial</option>
            <option>System Design</option>
            <option>Mock</option>
          </select>
        </label>
      </div>

      <label class="mt-5 block space-y-2">
        <span class="text-sm font-medium">Meeting Link</span>
        <input v-model="form.meetingLink" class="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950" placeholder="https://meet.google.com/..." />
        <span v-if="errors.meetingLink" class="text-sm text-rose-600">{{ errors.meetingLink }}</span>
      </label>
    </section>

    <section class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <h3 class="text-lg font-semibold">Interview Assets</h3>
      <div class="mt-5 grid gap-5 md:grid-cols-2">
        <label class="space-y-2">
          <span class="text-sm font-medium">Resume Upload</span>
          <input type="file" class="w-full rounded-lg border border-dashed border-slate-300 p-4 text-sm dark:border-slate-700" @change="setFileName($event, 'resumeName')" />
          <span v-if="errors.resumeName" class="text-sm text-rose-600">{{ errors.resumeName }}</span>
        </label>

        <label class="space-y-2">
          <span class="text-sm font-medium">Job Description Upload</span>
          <input type="file" class="w-full rounded-lg border border-dashed border-slate-300 p-4 text-sm dark:border-slate-700" @change="setFileName($event, 'jobDescriptionName')" />
        </label>
      </div>

      <label class="mt-5 block space-y-2">
        <span class="text-sm font-medium">Job Description</span>
        <textarea v-model="form.jobDescription" rows="6" class="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none focus:border-cyan-500 dark:border-slate-700 dark:bg-slate-950" />
        <span v-if="errors.jobDescription" class="text-sm text-rose-600">{{ errors.jobDescription }}</span>
      </label>
    </section>

    <div class="flex justify-end">
      <button class="inline-flex items-center gap-2 rounded-lg bg-slate-950 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-white dark:text-slate-950" :disabled="interviewStore.creating">
        <ArrowPathIcon v-if="interviewStore.creating" class="h-5 w-5 animate-spin" />
        {{ interviewStore.creating ? 'Creating...' : 'Create Interview Session' }}
      </button>
    </div>
  </form>
</template>
