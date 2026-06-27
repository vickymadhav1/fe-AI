<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { TrashIcon } from '@heroicons/vue/24/outline'
import { RouterLink } from 'vue-router'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import { useSessionStore } from '@/stores/session.store'
import { useUiStore } from '@/stores/ui.store'
import type { InterviewSession } from '@/types'

const sessionStore = useSessionStore()
const uiStore = useUiStore()
const query = ref('')
const sessionPendingDeletion = ref<InterviewSession | null>(null)
const deletingSessionId = ref('')

onMounted(() => {
  void sessionStore.fetchSessions()
})

const filteredSessions = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const sessions = sessionStore.sessions
  if (!needle) return sessions
  return sessions
    .filter((session) =>
      [session.title, session.company, session.role].some((value) =>
        String(value ?? '').toLowerCase().includes(needle),
      ),
    )
})

const requestDelete = (session: InterviewSession) => {
  sessionPendingDeletion.value = session
}

const cancelDelete = () => {
  if (!deletingSessionId.value) sessionPendingDeletion.value = null
}

const confirmDelete = async () => {
  const session = sessionPendingDeletion.value
  if (!session || deletingSessionId.value) return

  deletingSessionId.value = session.id
  try {
    await sessionStore.deleteSession(session.id)
    sessionPendingDeletion.value = null
    uiStore.pushToast({
      type: 'success',
      title: 'Interview deleted',
      description: 'The interview and its saved analysis were removed.',
    })
  } catch {
    uiStore.pushToast({
      type: 'error',
      title: 'Could not delete interview',
      description: 'The interview remains available. Try again.',
    })
  } finally {
    deletingSessionId.value = ''
  }
}
</script>

<template>
  <div class="im-prototype-page">
    <section v-if="sessionStore.loading && !sessionStore.sessions.length" class="mt-[46px] grid gap-5 xl:grid-cols-[560px_144px_168px_162px]">
      <SkeletonBlock class="h-[54px] rounded-xl" />
      <SkeletonBlock class="h-[54px] rounded-xl" />
      <SkeletonBlock class="h-[54px] rounded-xl" />
      <SkeletonBlock class="h-[54px] rounded-xl" />
    </section>

    <!-- <section v-else class="mt-[46px] grid gap-5 xl:grid-cols-[560px_144px_168px_162px]">
      <label class="flex h-[54px] items-center rounded-xl border border-[#263347] bg-[#0e1422] px-10">
        <input
          v-model="query"
          class="w-full bg-transparent text-[14px] font-medium text-slate-200 placeholder:text-slate-500 focus:outline-none"
          placeholder="Search interviews, roles, companies, or questions"
        />
      </label>
      <button class="h-[54px] rounded-xl border border-[#334155] bg-[#111827] text-[14px] font-medium text-slate-300 transition hover:border-cyan-300/50">All roles</button>
      <button class="h-[54px] rounded-xl border border-[#334155] bg-[#111827] text-[14px] font-medium text-slate-300 transition hover:border-cyan-300/50">Last 30 days</button>
      <button class="h-[54px] rounded-xl border border-[#334155] bg-[#111827] text-[14px] font-medium text-slate-300 transition hover:border-cyan-300/50">Confidence</button>
    </section> -->

    <section v-if="sessionStore.loading && !sessionStore.sessions.length" class="mt-11 grid gap-8 xl:grid-cols-[0px_100%]">
      <aside class="h-[700px] rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <SkeletonBlock class="h-5 w-24" />
        <div class="relative mt-[50px] h-[520px]">
          <SkeletonBlock class="absolute left-6 top-0 h-full w-px rounded-none" />
          <div v-for="item in 4" :key="item" class="mt-10 flex items-start gap-14">
            <SkeletonBlock class="h-[18px] w-[18px] rounded-full" />
            <div class="flex-1">
              <SkeletonBlock class="h-4 w-24" />
              <SkeletonBlock class="mt-4 h-3 w-36" />
            </div>
          </div>
        </div>
      </aside>
      <main class="h-[700px] rounded-[18px] border border-[#263347] bg-[#0e1422] p-9">
        <SkeletonBlock class="h-5 w-36" />
        <div class="mt-9 space-y-[26px]">
          <article v-for="item in 4" :key="item" class="h-[96px] rounded-[12px] border border-[#334155] bg-[#111827] px-5 py-5">
            <div class="flex items-start justify-between gap-6">
              <div class="flex-1">
                <SkeletonBlock class="h-5 w-64" />
                <SkeletonBlock class="mt-3 h-4 w-96 max-w-full" />
              </div>
              <SkeletonBlock class="h-[34px] min-w-[150px] rounded-full" />
            </div>
          </article>
        </div>
      </main>
    </section>

    <section v-else class="mt-8 grid gap-8 xl:grid-cols-[100%]">
      <!-- <aside class="h-[700px] rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <h2 class="text-[19px] font-bold text-slate-50">Timeline</h2>
        <div class="relative mt-[50px] h-[520px]">
          <div class="absolute left-6 top-0 h-full border-l border-[#263347]"></div>
          <div
            v-for="(item, index) in [
              ['Today', 'Frontend architecture', 'bg-cyan-400'],
              ['Yesterday', 'System design', 'bg-violet-500'],
              ['Jun 21', 'Behavioral round', 'bg-emerald-500'],
              ['Jun 18', 'Coding screen', 'bg-amber-500'],
            ]"
            :key="item[0]"
            class="absolute left-0"
            :style="{ top: `${index * 124}px` }"
          >
            <span class="absolute left-[15px] top-[-1px] h-[18px] w-[18px] rounded-full" :class="item[2]"></span>
            <p class="ml-[86px] text-[14px] font-medium text-slate-300">{{ item[0] }}</p>
            <p class="ml-[86px] mt-4 text-[13px] font-medium text-slate-500">{{ item[1] }}</p>
          </div>
        </div>
      </aside> -->

      <main class="h-[700px] rounded-[18px] border border-[#263347] bg-[#0e1422] p-7">
        <!-- <h2 class="text-[19px] font-bold text-slate-50">Interview cards</h2> -->
        <div class="im-scrollbar max-h-[610px] space-y-3 overflow-y-auto pr-1">
          <article
            v-for="session in filteredSessions"
            :key="session.id"
            class="im-proto-card-hover flex min-h-[96px] items-center mt-3 gap-3 rounded-[12px] border border-[#334155] bg-[#111827] px-5 py-4"
          >
            <RouterLink
              :to="`/sessions/${session.id}`"
              class="grid min-w-0 flex-1 items-center gap-4 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300 sm:grid-cols-[minmax(0,1fr)_140px_110px]"
            >
              <div class="min-w-0">
                <h3 class="truncate text-[16px] font-bold text-slate-50">Interview Title: {{ session.title || session.role || 'Untitled interview' }}</h3>
                <p class="mt-2 truncate text-[12px] font-medium text-slate-400">
                  Company: {{ session.company || 'No company provided' }}
                </p>
              </div>
              <span class="flex h-7 items-center justify-center rounded-full bg-teal-950 px-3 text-[10px] font-bold text-slate-300">
                {{ session._count?.suggestions ?? session.suggestions?.length ?? 0 }} suggestions
              </span>
              <span class="text-right text-[11px] font-semibold text-slate-500">
                {{ new Date(session.startedAt).toLocaleDateString() }}
              </span>
            </RouterLink>
            <button
              type="button"
              class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-rose-400/15 text-rose-300 transition hover:border-rose-300/40 hover:bg-rose-500/10 disabled:opacity-40"
              :disabled="deletingSessionId === session.id"
              :aria-label="`Delete ${session.title || session.role || 'interview'}`"
              title="Delete interview"
              @click="requestDelete(session)"
            >
              <TrashIcon class="h-4 w-4" />
            </button>
          </article>

          <div v-if="!filteredSessions.length" class="flex h-[180px] items-center justify-center rounded-[14px] border border-dashed border-[#334155] text-[14px] text-slate-400">
            No interview records found.
          </div>
        </div>
      </main>
    </section>

    <div
      v-if="sessionPendingDeletion"
      class="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-interview-title"
      @click.self="cancelDelete"
    >
      <div class="w-full max-w-md rounded-2xl border border-[#334155] bg-[#0e1422] p-6 shadow-2xl shadow-black/50">
        <h2 id="delete-interview-title" class="text-[18px] font-bold text-slate-50">Delete interview?</h2>
        <p class="mt-3 text-[13px] leading-6 text-slate-400">
          This permanently deletes
          <span class="font-semibold text-slate-200">{{ sessionPendingDeletion.title || sessionPendingDeletion.role || 'this interview' }}</span>
          and its transcript, suggestions, and screen analysis.
        </p>
        <div class="mt-6 flex justify-end gap-3">
          <button type="button" class="im-button" :disabled="Boolean(deletingSessionId)" @click="cancelDelete">
            Cancel
          </button>
          <button
            type="button"
            class="im-button border-rose-400/25 bg-rose-500/20 text-rose-100 hover:bg-rose-500/30 disabled:opacity-50"
            :disabled="Boolean(deletingSessionId)"
            @click="confirmDelete"
          >
            {{ deletingSessionId ? 'Deleting...' : 'Delete Interview' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
