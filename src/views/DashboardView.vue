<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { ChartBarIcon, ClipboardDocumentCheckIcon, PlayCircleIcon, PlusIcon, TrophyIcon } from '@heroicons/vue/24/outline'
import { useAuthStore } from '@/stores/auth.store'
import { useInterviewStore } from '@/stores/interview.store'
import { useSessionStore } from '@/stores/session.store'

const authStore = useAuthStore()
const interviewStore = useInterviewStore()
const sessionStore = useSessionStore()

onMounted(() => {
  if (!interviewStore.interviews.length) interviewStore.fetchInterviews()
  void sessionStore.fetchSessions()
})

const cards = computed(() => [
  {
    label: 'Active Sessions',
    value: sessionStore.sessions.filter((session) => session.status === 'active').length,
    icon: PlayCircleIcon,
  },
  { label: 'Mock Interviews', value: interviewStore.mockInterviews || 5, icon: PlayCircleIcon },
  { label: 'Success Rate', value: `${interviewStore.successRate}%`, icon: TrophyIcon },
  { label: 'Total Sessions', value: sessionStore.sessions.length, icon: ChartBarIcon },
])
</script>

<template>
  <div class="space-y-6">
    <section class="grid gap-6 xl:grid-cols-[1fr_340px]">
      <div class="rounded-lg bg-slate-950 p-8 text-white shadow-xl shadow-slate-900/10 dark:bg-slate-900">
        <p class="text-sm font-semibold uppercase tracking-wide text-cyan-300">Dashboard</p>
        <h2 class="mt-3 text-4xl font-bold">Hello {{ authStore.user?.name?.split(' ')[0] ?? 'Madhav' }}</h2>
        <p class="mt-3 max-w-2xl text-slate-300">Your next interview workspace is ready. Review upcoming sessions, create a new plan, or open the live assistant.</p>
        <div class="mt-8 flex flex-wrap gap-3">
          <RouterLink to="/interviews/create" class="inline-flex items-center gap-2 rounded-lg bg-cyan-500 px-4 py-3 text-sm font-semibold text-white hover:bg-cyan-400">
            <PlusIcon class="h-5 w-5" />
            Create Interview
          </RouterLink>
          <RouterLink to="/sessions/new" class="inline-flex items-center gap-2 rounded-lg bg-white/10 px-4 py-3 text-sm font-semibold text-white hover:bg-white/15">
            <ClipboardDocumentCheckIcon class="h-5 w-5" />
            Start Live Session
          </RouterLink>
        </div>
      </div>

      <div class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <p class="text-sm text-slate-500 dark:text-slate-400">Credits remaining</p>
        <div class="mt-4 flex items-end justify-between">
          <p class="text-5xl font-bold">{{ authStore.credits?.remaining ?? 18 }}</p>
          <p class="text-sm text-slate-500 dark:text-slate-400">of {{ authStore.credits?.monthlyLimit ?? 30 }}</p>
        </div>
        <div class="mt-6 h-3 rounded-full bg-slate-100 dark:bg-slate-800">
          <div class="h-3 rounded-full bg-cyan-500" :style="{ width: `${((authStore.credits?.remaining ?? 18) / (authStore.credits?.monthlyLimit ?? 30)) * 100}%` }"></div>
        </div>
      </div>
    </section>

    <section class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div class="mb-5 flex items-center justify-between">
        <h3 class="text-lg font-semibold">Recent live sessions</h3>
        <RouterLink to="/history" class="text-sm font-semibold text-cyan-600 dark:text-cyan-400">View history</RouterLink>
      </div>
      <div v-if="sessionStore.sessions.length" class="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        <RouterLink v-for="session in sessionStore.sessions.slice(0, 6)" :key="session.id" :to="`/sessions/${session.id}`" class="border-l-2 border-cyan-500 px-4 py-2">
          <p class="font-semibold">{{ session.title || 'Interview session' }}</p>
          <p class="mt-1 text-sm text-slate-500">{{ session.company || 'No company' }} · {{ session.role || 'General role' }}</p>
          <p class="mt-2 text-xs uppercase text-slate-400">{{ session.status }}</p>
        </RouterLink>
      </div>
      <p v-else class="text-sm text-slate-500">No live sessions yet.</p>
    </section>

    <section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      <div v-for="card in cards" :key="card.label" class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <component :is="card.icon" class="h-7 w-7 text-cyan-500" />
        <p class="mt-5 text-sm text-slate-500 dark:text-slate-400">{{ card.label }}</p>
        <p class="mt-2 text-3xl font-bold">{{ card.value }}</p>
      </div>
    </section>

  </div>
</template>
