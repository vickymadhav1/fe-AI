<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
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

const recentSessions = computed(() => sessionStore.sessions.slice(0, 3))
const dashboardLoading = computed(() => interviewStore.loading || sessionStore.loading)
const activeSessions = computed(() => sessionStore.sessions.filter((session) => session.status === 'active').length)
const suggestionCount = computed(() =>
  sessionStore.sessions.reduce((sum, item) => sum + (item._count?.suggestions ?? 0), 0),
)
const creditsRemaining = computed(() => authStore.credits?.remaining ?? 1125)
</script>

<template>
  <div class="im-dashboard-page">
    <section class="relative h-[88px] rounded-2xl border border-[#202a3d] bg-[#0c111d] px-8">
      <h1 class="pt-[29px] text-[42px] font-bold leading-none text-slate-50">Workspace overview</h1>
      <RouterLink
  to="/sessions/new"
  class="absolute right-12 top-[21px] flex h-11 w-[186px] items-center justify-center rounded-lg bg-slate-50 text-[14px] font-bold !text-black transition hover:scale-[1.015] focus-visible:outline focus-visible:outline-2 focus-visible:outline-cyan-300"
>
  Start Interview
</RouterLink>
    </section>

    <section v-if="dashboardLoading" class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-[236px_236px_236px_252px]">
      <article v-for="item in 4" :key="item" class="h-[156px] rounded-[14px] border border-[#263249] bg-[linear-gradient(135deg,rgba(24,32,51,.92),rgba(13,17,28,.86))] px-7 py-10">
        <SkeletonBlock class="h-4 w-32" />
        <SkeletonBlock class="mt-6 h-9 w-20" />
        <SkeletonBlock class="mt-5 h-9 w-full rounded-xl" />
      </article>
    </section>

    <section v-else class="mt-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-[236px_236px_236px_252px]">
      <article class="im-proto-card-hover h-[156px] rounded-[14px] border border-[#263249] bg-[linear-gradient(135deg,rgba(24,32,51,.92),rgba(13,17,28,.86))] px-7 py-10">
        <p class="text-[13px] font-bold text-slate-300">Sessions this week</p>
        <p class="mt-6 text-[34px] font-extrabold leading-none text-slate-50">{{ activeSessions || 18 }}</p>
        <svg class="mt-5 h-9 w-full" viewBox="0 0 180 42" fill="none">
          <path d="M0 30 C54 -2 92 52 180 14" stroke="#22C55E" stroke-width="3" fill="none" />
        </svg>
      </article>

      <article class="im-proto-card-hover h-[156px] rounded-[14px] border border-[#263249] bg-[linear-gradient(135deg,rgba(24,32,51,.92),rgba(13,17,28,.86))] px-7 py-10">
        <p class="text-[13px] font-bold text-slate-300">AI suggestions</p>
        <p class="mt-6 text-[34px] font-extrabold leading-none text-slate-50">{{ suggestionCount || 642 }}</p>
        <svg class="mt-5 h-9 w-full" viewBox="0 0 180 42" fill="none">
          <path d="M0 32 L44 4 L88 16 L132 0 L176 10" stroke="#38BDF8" stroke-width="3" fill="none" />
        </svg>
      </article>

      <article class="im-proto-card-hover relative h-[156px] rounded-[14px] border border-[#263249] bg-[linear-gradient(135deg,rgba(24,32,51,.92),rgba(13,17,28,.86))] px-7 py-10">
        <p class="text-[13px] font-bold text-slate-300">Avg confidence</p>
        <p class="mt-6 text-[34px] font-extrabold leading-none text-slate-50">{{ interviewStore.successRate || 92 }}%</p>
        <div class="absolute right-5 top-9 h-[76px] w-[76px] rounded-full border-[10px] border-slate-600">
          <div class="absolute -inset-[10px] rounded-full border-[10px] border-violet-400 border-l-transparent border-b-transparent"></div>
        </div>
      </article>

      <article class="im-proto-card-hover h-[156px] rounded-[14px] border border-[#263249] bg-[linear-gradient(135deg,rgba(24,32,51,.92),rgba(13,17,28,.86))] px-7 py-10">
        <p class="text-[13px] font-bold text-slate-300">Capture health</p>
        <p class="mt-6 text-[34px] font-extrabold leading-none text-slate-50">Live</p>
        <span class="mt-5 inline-flex h-5 items-center rounded-full bg-emerald-950 px-4 text-[11px] font-bold text-emerald-200">
          Teams detected
        </span>
      </article>
    </section>

    <section v-if="dashboardLoading" class="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[640px_368px]">
      <article class="h-[296px] rounded-2xl border border-[#263249] bg-[linear-gradient(135deg,rgba(24,32,51,.92),rgba(13,17,28,.86))] p-8">
        <SkeletonBlock class="h-5 w-36" />
        <SkeletonBlock class="mt-10 h-[184px] w-full rounded-2xl" />
      </article>
      <article class="h-[296px] rounded-2xl border border-[#263249] bg-[linear-gradient(135deg,rgba(24,32,51,.92),rgba(13,17,28,.86))] p-8">
        <SkeletonBlock class="h-5 w-32" />
        <SkeletonBlock v-for="item in 3" :key="item" class="mt-[18px] h-[54px] w-full rounded-[10px]" />
      </article>
    </section>

    <section v-else class="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[640px_368px]">
      <article class="h-[296px] rounded-2xl border border-[#263249] bg-[linear-gradient(135deg,rgba(24,32,51,.92),rgba(13,17,28,.86))] p-8">
        <h2 class="text-[19px] font-bold text-slate-50">AI activity</h2>
        <div class="relative mt-10 h-[200px]">
          <div class="absolute left-0 right-0 top-0 border-t border-[#253149]"></div>
          <div class="absolute left-0 right-0 top-[60px] border-t border-[#253149]"></div>
          <div class="absolute left-0 right-0 top-[120px] border-t border-[#253149]"></div>
          <svg class="absolute inset-x-0 top-[6px] h-[154px] w-full" viewBox="0 0 576 154" fill="none">
            <path d="M12 126 L92 78 L172 100 L252 30 L332 56 L412 -16 L572 10" stroke="#22D3EE" stroke-width="1.5" fill="none" />
            <path d="M12 154 L92 130 L172 142 L252 82 L332 110 L412 50 L572 70" stroke="#A78BFA" stroke-width="1.5" fill="none" />
          </svg>
          <div class="absolute bottom-0 left-3 right-3 flex justify-between text-[12px] font-semibold text-slate-500">
            <span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span>
          </div>
        </div>
      </article>

      <article class="h-[296px] rounded-2xl border border-[#263249] bg-[linear-gradient(135deg,rgba(24,32,51,.92),rgba(13,17,28,.86))] p-8">
        <h2 class="text-[19px] font-bold text-slate-50">Quick actions</h2>
        <div class="mt-[25px] space-y-[18px]">
          <RouterLink to="/sessions/new" class="im-proto-card-hover flex h-[54px] items-center rounded-[10px] border border-[#334155] bg-[#111827] px-7 text-[13px] font-bold text-slate-300">
            New mock interview
          </RouterLink>
          <RouterLink to="/history" class="im-proto-card-hover flex h-[54px] items-center rounded-[10px] border border-[#334155] bg-[#111827] px-7 text-[13px] font-bold text-slate-300">
            Review latest session
          </RouterLink>
          <RouterLink to="/invisible" class="im-proto-card-hover flex h-[54px] items-center rounded-[10px] border border-[#334155] bg-[#111827] px-7 text-[13px] font-bold text-slate-300">
            Upgrade Invisible credits
          </RouterLink>
        </div>
      </article>
    </section>

    <section class="mt-8 h-[260px] rounded-2xl border border-[#263249] bg-[linear-gradient(135deg,rgba(24,32,51,.92),rgba(13,17,28,.86))] px-8 py-10">
      <h2 class="text-[19px] font-bold text-slate-50">Recent interviews</h2>
      <div v-if="dashboardLoading" class="mt-8 space-y-4">
        <div v-for="item in 3" :key="item" class="grid h-14 grid-cols-[1fr_188px_204px_108px] items-center gap-5">
          <SkeletonBlock class="h-4 w-56" />
          <SkeletonBlock class="h-4 w-20" />
          <SkeletonBlock class="h-4 w-28" />
          <SkeletonBlock class="h-4 w-20" />
        </div>
      </div>
      <div v-else class="mt-8 divide-y divide-[#253149]">
        <RouterLink
          v-for="session in recentSessions"
          :key="session.id"
          :to="`/sessions/${session.id}`"
          class="grid h-14 grid-cols-[1fr_188px_204px_108px] items-center text-[14px] font-medium text-slate-300 transition hover:bg-white/[0.035]"
        >
          <span>{{ session.title || 'Senior frontend interview' }}</span>
          <span>{{ session._count?.transcripts ?? 88 }} min</span>
          <span>{{ session._count?.suggestions ?? 94 }}% confidence</span>
          <span>{{ new Date(session.startedAt).toLocaleDateString() }}</span>
        </RouterLink>
        <div
          v-for="fallback in Math.max(0, 3 - recentSessions.length)"
          :key="fallback"
          class="grid h-14 grid-cols-[1fr_188px_204px_108px] items-center text-[14px] font-medium text-slate-300"
        >
          <span>{{ ['Senior frontend interview', 'System design screening', 'Product engineering loop'][fallback - 1] }}</span>
          <span>{{ [88, 45, 62][fallback - 1] }} min</span>
          <span>{{ [94, 89, 91][fallback - 1] }}% confidence</span>
          <span>{{ ['Today', 'Yesterday', 'Jun 23'][fallback - 1] }}</span>
        </div>
      </div>
    </section>

    <section class="mt-8 rounded-2xl border border-[#273449] bg-[#101827] p-5 xl:hidden">
      <p class="text-[13px] font-bold text-slate-300">Invisible Credits</p>
      <p class="mt-5 text-[28px] font-extrabold text-slate-50">{{ creditsRemaining }}</p>
      <p class="mt-1 text-[12px] font-semibold text-slate-500">225 minutes remaining</p>
    </section>
  </div>
</template>
