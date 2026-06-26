<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { RouterLink } from 'vue-router'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import { useSessionStore } from '@/stores/session.store'

const sessionStore = useSessionStore()
const query = ref('')

onMounted(() => {
  void sessionStore.fetchSessions()
})

const filteredSessions = computed(() => {
  const needle = query.value.trim().toLowerCase()
  const sessions = sessionStore.sessions
  if (!needle) return sessions.slice(0, 3)
  return sessions
    .filter((session) =>
      [session.title, session.company, session.role].some((value) =>
        String(value ?? '').toLowerCase().includes(needle),
      ),
    )
    .slice(0, 3)
})

const fallback = [
  ['Senior Frontend Engineer', 'React performance, accessibility, state architecture', '94'],
  ['Distributed Systems Screen', 'Cache invalidation, rate limits, queues', '89'],
  ['Product Engineering Loop', 'Prioritization, execution, tradeoff narratives', '82'],
]
</script>

<template>
  <div class="im-prototype-page">
    <h1 class="text-[40px] font-extrabold leading-none text-slate-50">Interview History</h1>

    <section v-if="sessionStore.loading" class="mt-[46px] grid gap-5 xl:grid-cols-[560px_144px_168px_162px]">
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

    <section v-if="sessionStore.loading" class="mt-11 grid gap-8 xl:grid-cols-[0px_100%]">
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
          <article v-for="item in 4" :key="item" class="h-[134px] rounded-[14px] border border-[#334155] bg-[#111827] px-8 py-9">
            <div class="flex items-start justify-between gap-6">
              <div class="flex-1">
                <SkeletonBlock class="h-5 w-64" />
                <SkeletonBlock class="mt-5 h-4 w-96 max-w-full" />
              </div>
              <SkeletonBlock class="h-[34px] min-w-[150px] rounded-full" />
            </div>
          </article>
        </div>
      </main>
    </section>

    <section v-else class="mt-11 grid gap-8 xl:grid-cols-[100%]">
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

      <main class="h-[700px] rounded-[18px] border border-[#263347] bg-[#0e1422] p-9">
        <h2 class="text-[19px] font-bold text-slate-50">Interview cards</h2>
        <div class="im-scrollbar mt-9 max-h-[584px] space-y-[26px] overflow-y-auto pr-1">
          <RouterLink
            v-for="session in filteredSessions"
            :key="session.id"
            :to="`/sessions/${session.id}`"
            class="im-proto-card-hover block h-[134px] rounded-[14px] border border-[#334155] bg-[#111827] px-8 py-9"
          >
            <div class="flex items-start justify-between gap-6">
              <div>
                <h3 class="text-[19px] font-bold text-slate-50">{{ session.title || session.role || 'Senior Frontend Engineer' }}</h3>
                <p class="mt-5 text-[14px] font-medium text-slate-300">
                  {{ session.company || 'React performance, accessibility, state architecture' }}
                </p>
              </div>
              <span class="mt-[-4px] flex h-[34px] min-w-[150px] items-center justify-center rounded-full bg-teal-950 text-[11px] font-bold text-slate-300">
                {{ Math.max(82, Math.min(98, (session._count?.suggestions ?? 94))) }}% confidence
              </span>
            </div>
          </RouterLink>

          <article
            v-for="item in fallback.slice(0, Math.max(0, 3 - filteredSessions.length))"
            :key="item[0]"
            class="im-proto-card-hover h-[134px] rounded-[14px] border border-[#334155] bg-[#111827] px-8 py-9"
          >
            <div class="flex items-start justify-between gap-6">
              <div>
                <h3 class="text-[19px] font-bold text-slate-50">{{ item[0] }}</h3>
                <p class="mt-5 text-[14px] font-medium text-slate-300">{{ item[1] }}</p>
              </div>
              <span class="mt-[-4px] flex h-[34px] min-w-[150px] items-center justify-center rounded-full bg-teal-950 text-[11px] font-bold text-slate-300">
                {{ item[2] }}% confidence
              </span>
            </div>
          </article>

          <button class="flex h-[86px] w-full items-center rounded-[14px] border border-[#263347] bg-[#0b111d] px-8 text-[14px] font-medium text-slate-300 transition hover:border-cyan-300/50">
            Load more interview records
          </button>
        </div>
      </main>
    </section>
  </div>
</template>
