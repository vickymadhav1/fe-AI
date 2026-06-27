<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import { useSessionStore } from '@/stores/session.store'

const sessionStore = useSessionStore()
const {
  activeMeetingApp,
  answer,
  code,
  confidence,
  currentQuestion,
  isScreenSharing,
  lastCapture,
  provider,
  screenStatus,
  screenshotPreviewUrl,
  voiceStatus,
} = storeToRefs(sessionStore)

const activeTab = ref<'answer' | 'code' | 'screenshot'>('answer')
const alwaysOnTop = ref(true)
let removeResultListener: (() => void) | undefined
const companion = window.interviewMateDesktop?.floating

const canShowCode = computed(() => Boolean(code.value?.trim()))
const meetingLabel = computed(() => activeMeetingApp.value || 'Teams')
const captureLabel = computed(() => (isScreenSharing.value || screenStatus.value === 'Active' ? 'Capturing' : 'Idle'))
const compactConfidence = computed(() => `${Math.round((confidence.value || 0.8) * 100)}%`)

onMounted(async () => {
  const savedTab = window.localStorage.getItem('interview-mate-companion-tab')
  if (savedTab === 'answer' || savedTab === 'code' || savedTab === 'screenshot') {
    activeTab.value = savedTab
  }
  const windowState = await companion?.getWindowState()
  if (windowState) {
    alwaysOnTop.value = windowState.alwaysOnTop
  }
  const latest = await companion?.getLatest()
  if (latest) sessionStore.updateFloatingResult(latest)
  removeResultListener = companion?.onResult((nextResult) => {
    sessionStore.updateFloatingResult(nextResult)
  })
})

onBeforeUnmount(() => {
  removeResultListener?.()
})

const setTab = (tab: 'answer' | 'code' | 'screenshot') => {
  activeTab.value = tab
  window.localStorage.setItem('interview-mate-companion-tab', tab)
}

const toggleAlwaysOnTop = async () => {
  const next = await companion?.setAlwaysOnTop(!alwaysOnTop.value)
  if (next) alwaysOnTop.value = next.alwaysOnTop
}
</script>

<template>
  <main class="relative h-screen w-screen overflow-hidden bg-transparent p-0 text-slate-50">
    <div class="pointer-events-none absolute left-4 top-2 h-40 w-40 rounded-full bg-cyan-400/15 blur-3xl"></div>
    <div class="pointer-events-none absolute right-8 top-6 h-56 w-56 rounded-full bg-violet-500/10 blur-3xl"></div>

    <section class="flex h-full min-h-[320px] w-full min-w-[700px] flex-col rounded-[20px] border border-white/15 bg-[linear-gradient(115deg,rgba(23,32,51,.76),rgba(11,18,32,.70)_50%,rgba(5,7,11,.78))] p-3 shadow-[0_22px_56px_rgba(0,0,0,.46),0_0_40px_rgba(56,189,248,.08)] backdrop-blur-2xl">
      <header class="flex h-[34px] shrink-0 items-center justify-between rounded-[14px] border border-white/10 bg-[#050a13]/35 px-3" style="-webkit-app-region: drag">
        <div class="flex items-center gap-2">
          <span class="inline-flex h-[22px] items-center gap-2 rounded-full border border-white/10 bg-white/[.055] px-3 text-[10px] font-extrabold text-slate-300">
            <span class="h-[7px] w-[7px] rounded-full bg-cyan-300"></span>
            {{ meetingLabel }}
          </span>
          <span class="inline-flex h-[22px] items-center gap-2 rounded-full border border-white/10 bg-white/[.055] px-3 text-[10px] font-extrabold text-slate-300">
            <span class="h-[7px] w-[7px] rounded-full bg-emerald-400"></span>
            Connected
          </span>
          <span class="inline-flex h-[22px] items-center gap-2 rounded-full border border-white/10 bg-white/[.055] px-3 text-[10px] font-extrabold text-slate-300">
            <span class="h-[7px] w-[7px] rounded-full" :class="captureLabel === 'Capturing' ? 'bg-emerald-400' : 'bg-slate-500'"></span>
            {{ captureLabel }}
          </span>
          <span class="inline-flex h-[22px] items-center gap-2 rounded-full border border-white/10 bg-white/[.055] px-3 text-[10px] font-extrabold text-slate-300">
            <span class="h-[7px] w-[7px] rounded-full bg-violet-300"></span>
            {{ voiceStatus === 'streaming' ? 'Processing' : 'Idle' }}
          </span>
        </div>
        <div class="flex items-center gap-1.5" style="-webkit-app-region: no-drag">
          <button class="h-[22px] rounded-lg border border-white/10 bg-white/[.06] px-2 text-[10px] font-extrabold text-slate-300">Pin</button>
          <button class="h-[22px] rounded-lg border border-white/10 bg-white/[.06] px-2 text-[10px] font-extrabold text-slate-300" @click="toggleAlwaysOnTop">
            {{ alwaysOnTop ? 'Top' : 'Free' }}
          </button>
          <button class="h-[22px] w-6 rounded-lg border border-white/10 bg-white/[.06] text-slate-300">-</button>
          <button class="h-[22px] w-6 rounded-lg border border-white/10 bg-white/[.06] text-slate-300">x</button>
        </div>
      </header>

      <div class="mt-2 flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-[linear-gradient(135deg,rgba(28,38,59,.56),rgba(10,16,32,.46))] p-3">
        <div class="flex h-8 items-center rounded-xl border border-white/10 bg-white/[.045] px-1.5">
          <button
            class="h-5 rounded-[9px] px-6 text-[10px] font-extrabold transition"
            :class="activeTab === 'answer' ? 'border border-cyan-200/20 bg-cyan-200/15 text-slate-100' : 'text-slate-400'"
            @click="setTab('answer')"
          >
            Answer
          </button>
          <button
            v-if="canShowCode"
            class="ml-4 h-5 rounded-[9px] px-4 text-[11px] font-bold transition"
            :class="activeTab === 'code' ? 'border border-cyan-200/20 bg-cyan-200/15 text-slate-100' : 'text-slate-400'"
            @click="setTab('code')"
          >
            Code
          </button>
          <button
            class="ml-4 h-5 rounded-[9px] px-4 text-[11px] font-bold transition"
            :class="activeTab === 'screenshot' ? 'border border-cyan-200/20 bg-cyan-200/15 text-slate-100' : 'text-slate-400'"
            @click="setTab('screenshot')"
          >
            Screenshot
          </button>
          <span class="ml-auto min-w-[180px] truncate pr-4 text-[11px] font-medium text-slate-500">
            <span v-if="currentQuestion">{{ currentQuestion }}</span>
            <SkeletonBlock v-else class="h-3 w-full" />
          </span>
        </div>

        <div class="im-scrollbar mt-2 min-h-0 flex-1 overflow-y-auto">
          <section v-if="activeTab === 'answer'" class="grid min-h-full gap-3 lg:grid-cols-[minmax(420px,1.6fr)_minmax(220px,.8fr)]">
            <article class="rounded-[13px] border border-white/10 bg-white/[.05] p-4">
              <div class="flex items-center justify-between">
                <h2 class="text-[13px] font-extrabold text-slate-50">AI Answer</h2>
                <div class="flex gap-1">
                  <button class="h-[22px] rounded-lg border border-white/10 bg-white/[.06] px-2 text-[10px] font-extrabold">Copy</button>
                  <button class="h-[22px] rounded-lg border border-white/10 bg-white/[.06] px-2 text-[10px] font-extrabold">Redo</button>
                </div>
              </div>
              <p v-if="answer" class="mt-5 whitespace-pre-line text-[12.5px] font-medium leading-[21px] text-[#d7e0ea]">
                {{ answer }}
              </p>
              <div v-else class="mt-5 space-y-3">
                <SkeletonBlock class="h-4 w-[70%]" />
                <SkeletonBlock class="h-3 w-[92%]" />
                <SkeletonBlock class="h-3 w-[86%]" />
                <SkeletonBlock class="h-3 w-[72%]" />
                <SkeletonBlock class="mt-5 h-16 w-full rounded-xl" />
              </div>
              <div class="mt-6 flex flex-wrap items-center gap-2">
                <template v-if="answer">
                  <span class="rounded-full bg-teal-950/70 px-4 py-1 text-[10px] font-extrabold text-slate-300">clarity</span>
                  <span class="rounded-full bg-blue-950/70 px-4 py-1 text-[10px] font-extrabold text-slate-300">latency</span>
                  <span class="rounded-full bg-violet-950/70 px-4 py-1 text-[10px] font-extrabold text-slate-300">tradeoffs</span>
                </template>
                <template v-else>
                  <SkeletonBlock class="h-5 w-16 rounded-full" />
                  <SkeletonBlock class="h-5 w-20 rounded-full" />
                  <SkeletonBlock class="h-5 w-24 rounded-full" />
                </template>
                <span class="ml-auto text-[10px] font-extrabold text-slate-400">{{ compactConfidence }}</span>
              </div>
            </article>

            <div class="space-y-2">
              <article class="rounded-[13px] border border-white/10 bg-white/[.05] p-3">
                <h3 class="text-[13px] font-extrabold text-slate-50">Bullet summary</h3>
                <template v-if="answer">
                  <p class="mt-3 text-[11px] font-bold text-slate-400">Ask for constraints before choosing.</p>
                  <p class="mt-2 text-[11px] font-bold text-slate-400">Mention tradeoffs, freshness, and cost.</p>
                </template>
                <template v-else>
                  <SkeletonBlock class="mt-3 h-3 w-full" />
                  <SkeletonBlock class="mt-2 h-3 w-4/5" />
                  <SkeletonBlock class="mt-2 h-3 w-3/5" />
                </template>
              </article>
              <article class="rounded-[13px] border border-white/10 bg-slate-950/70 p-3">
                <h3 class="text-[13px] font-extrabold text-slate-50">Code preview</h3>
                <pre v-if="code" class="mt-3 overflow-hidden text-[11px] font-semibold leading-[21px] text-cyan-200">{{ code }}</pre>
                <div v-else class="mt-3 space-y-2">
                  <SkeletonBlock class="h-3 w-11/12" />
                  <SkeletonBlock class="h-3 w-8/12" />
                  <SkeletonBlock class="h-3 w-10/12" />
                </div>
              </article>
            </div>
          </section>

          <section v-else-if="activeTab === 'code'" class="h-full rounded-[13px] border border-white/10 bg-slate-950/80 p-4">
            <pre v-if="code" class="im-scrollbar h-full overflow-auto whitespace-pre-wrap text-[11px] font-semibold leading-[21px] text-cyan-200">{{ code }}</pre>
            <div v-else class="space-y-3">
              <SkeletonBlock class="h-4 w-64" />
              <SkeletonBlock v-for="item in 10" :key="item" class="h-3 w-full" />
              <SkeletonBlock class="h-12 w-3/4 rounded-xl" />
            </div>
          </section>

          <section v-else class="grid h-full grid-cols-[minmax(360px,1fr)_220px] gap-3">
            <div class="overflow-hidden rounded-[13px] border border-white/10 bg-slate-950/70">
              <img v-if="screenshotPreviewUrl" :src="screenshotPreviewUrl" alt="Latest captured screenshot" class="h-full w-full object-contain" />
              <div v-else class="h-full bg-[linear-gradient(135deg,#0f172a,#1e293b,#020617)] p-5">
                <SkeletonBlock class="h-full min-h-[220px] w-full rounded-[13px]" />
              </div>
            </div>
            <div class="rounded-[13px] border border-white/10 bg-white/[.05] p-3 text-[11px] font-bold text-slate-400">
              <p class="text-[13px] font-extrabold text-slate-50">Screenshot</p>
              <p class="mt-4">Source: {{ meetingLabel }}</p>
              <p class="mt-3">Captured: {{ lastCapture ? new Date(lastCapture).toLocaleTimeString() : 'Pending' }}</p>
              <p class="mt-3">Status: {{ screenStatus }}</p>
            </div>
          </section>
        </div>

        <footer class="mt-2 flex h-[26px] items-center rounded-full border border-white/10 bg-[#050a13]/35 px-6 text-[10px] font-extrabold text-slate-300">
          <button>Copy</button>
          <button class="ml-10">Refresh</button>
          <span class="ml-16 inline-flex items-center gap-2"><span class="h-2 w-2 rounded-full bg-emerald-400"></span>Invisible Mode</span>
          <span class="ml-auto">Provider {{ provider || 'idle' }}</span>
          <button class="ml-8">Settings</button>
        </footer>
      </div>
    </section>
  </main>
</template>

<style scoped>
:global(html),
:global(body),
:global(#app) {
  height: 100%;
  margin: 0;
  background: transparent !important;
  overflow: hidden;
}
</style>
