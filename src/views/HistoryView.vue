<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { EyeIcon, TrashIcon } from '@heroicons/vue/24/outline'
import EmptyState from '@/components/ui/EmptyState.vue'
import { useSessionStore } from '@/stores/session.store'
import { useUiStore } from '@/stores/ui.store'

const sessionStore = useSessionStore()
const uiStore = useUiStore()

onMounted(() => void sessionStore.fetchSessions())

const remove = async (id: string) => {
  await sessionStore.deleteSession(id)
  uiStore.pushToast({ type: 'info', title: 'Session deleted' })
}
</script>

<template>
  <section class="rounded-lg border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
    <div class="flex items-center justify-between border-b border-slate-200 p-6 dark:border-slate-800">
      <div><h2 class="text-2xl font-bold">Session History</h2><p class="mt-2 text-sm text-slate-500">Review previous interview sessions and activity.</p></div>
      <RouterLink to="/sessions/new" class="rounded-lg bg-cyan-600 px-4 py-2.5 text-sm font-semibold text-white">New session</RouterLink>
    </div>
    <EmptyState v-if="!sessionStore.sessions.length && !sessionStore.loading" :icon="TrashIcon" title="No sessions yet" description="Start a live session to build your interview history." class="m-6" />
    <div v-else class="overflow-x-auto">
      <table class="min-w-full divide-y divide-slate-200 dark:divide-slate-800">
        <thead class="bg-slate-50 dark:bg-slate-950"><tr>
          <th class="px-6 py-4 text-left text-xs font-semibold uppercase text-slate-500">Session</th>
          <th class="px-6 py-4 text-left text-xs font-semibold uppercase text-slate-500">Company / Role</th>
          <th class="px-6 py-4 text-left text-xs font-semibold uppercase text-slate-500">Started</th>
          <th class="px-6 py-4 text-left text-xs font-semibold uppercase text-slate-500">Activity</th>
          <th class="px-6 py-4 text-left text-xs font-semibold uppercase text-slate-500">Status</th>
          <th class="px-6 py-4"></th>
        </tr></thead>
        <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
          <tr v-for="session in sessionStore.sessions" :key="session.id">
            <td class="px-6 py-4 font-semibold">{{ session.title || 'Interview session' }}</td>
            <td class="px-6 py-4 text-sm text-slate-500">{{ session.company || '—' }} · {{ session.role || '—' }}</td>
            <td class="px-6 py-4 text-sm">{{ new Date(session.startedAt).toLocaleString() }}</td>
            <td class="px-6 py-4 text-sm">{{ session._count?.transcripts ?? 0 }} transcripts · {{ session._count?.suggestions ?? 0 }} suggestions</td>
            <td class="px-6 py-4"><span class="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize dark:bg-slate-800">{{ session.status }}</span></td>
            <td class="px-6 py-4"><div class="flex justify-end gap-2">
              <RouterLink :to="`/sessions/${session.id}`" class="rounded-lg border border-slate-300 p-2 dark:border-slate-700"><EyeIcon class="h-5 w-5" /></RouterLink>
              <button class="rounded-lg border border-rose-200 p-2 text-rose-700 dark:border-rose-900" @click="remove(session.id)"><TrashIcon class="h-5 w-5" /></button>
            </div></td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>
