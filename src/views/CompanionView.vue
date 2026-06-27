<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import hljs from 'highlight.js/lib/core'
import javascript from 'highlight.js/lib/languages/javascript'
import python from 'highlight.js/lib/languages/python'
import typescript from 'highlight.js/lib/languages/typescript'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'
import { useSessionStore } from '@/stores/session.store'

hljs.registerLanguage('javascript', javascript)
hljs.registerLanguage('typescript', typescript)
hljs.registerLanguage('python', python)

const sessionStore = useSessionStore()
const {
  answer,
  code,
  confidence,
  currentQuestion,
  formattedDuration,
  screenshotPreviewUrl,
} = storeToRefs(sessionStore)

const activeTab = ref<'answer' | 'screenshot'>('answer')
let removeResultListener: (() => void) | undefined
const companion = window.interviewMateDesktop?.floating

const compactConfidence = computed(() => `${Math.round((confidence.value || 0.8) * 100)}%`)
const answerText = computed(() => answer.value || (currentQuestion.value ? 'Generating answer...' : 'Listening for the next interview question...'))
const highlightedCode = computed(() => code.value ? hljs.highlightAuto(code.value).value : '')
const bulletPoints = computed(() =>
  answer.value
    .split(/\n+/)
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 4),
)

onMounted(async () => {
  const savedTab = window.localStorage.getItem('interview-mate-companion-tab')
  if (savedTab === 'answer' || savedTab === 'screenshot') {
    activeTab.value = savedTab
  }
  const latest = await companion?.getLatest()
  if (latest) {
    console.info('[CompanionSync] update received', {
      source: 'initial',
      question: latest.question,
      answerLength: latest.answer?.length ?? 0,
    })
    sessionStore.updateFloatingResult(latest)
  }
  removeResultListener = companion?.onResult((nextResult) => {
    const result = nextResult as {
      question?: string
      answer?: string
      provider?: string
    }
    console.info('[CompanionSync] update received', {
      source: 'ipc',
      question: result.question ?? '',
      answerLength: result.answer?.length ?? 0,
      provider: result.provider || 'pending',
    })
    sessionStore.updateFloatingResult(nextResult)
  })
})

onBeforeUnmount(() => {
  removeResultListener?.()
})

const setTab = (tab: 'answer' | 'screenshot') => {
  activeTab.value = tab
  window.localStorage.setItem('interview-mate-companion-tab', tab)
}

const copyCode = () => {
  window.interviewMateDesktop?.floating.copyCode()
}

const requestInterviewShutdown = async () => {
  const floating = window.interviewMateDesktop?.floating
  if (typeof floating?.requestShutdown === 'function') {
    await floating.requestShutdown()
    return
  }
  floating?.end()
}

watch(
  () => [currentQuestion.value, answer.value] as const,
  ([question, nextAnswer]) => {
    console.info('[CompanionSync] rendered', {
      question,
      answerLength: nextAnswer.length,
    })
  },
)
</script>

<template>
  <main class="h-screen w-screen overflow-hidden bg-transparent p-0 companion-surface">
    <section class="flex h-full min-h-[320px] w-full min-w-[700px] flex-col rounded-2xl border border-white/10 bg-[rgba(11,17,32,0.72)] p-3 shadow-[0_22px_56px_rgba(0,0,0,.42)] backdrop-blur-[26px]">
      <header class="companion-titlebar flex h-10 shrink-0 items-center justify-between rounded-xl border border-white/10 bg-[rgba(17,24,39,.55)] px-3 backdrop-blur-2xl">
        <div class="min-w-0 flex-1 truncate text-[12px] font-extrabold companion-primary">
          Interview Mate AI
        </div>
        <div class="mx-3 shrink-0 whitespace-nowrap text-[11px] font-extrabold companion-secondary">
          Duration <span class="font-mono tabular-nums companion-primary">{{ formattedDuration }}</span>
        </div>
        <div class="companion-no-drag ml-4 flex shrink-0 items-center gap-1.5">
          <button
            class="h-7 rounded-lg border border-rose-300/20 bg-rose-500/10 px-3 text-[11px] font-extrabold text-rose-100 transition hover:bg-rose-500/20"
            title="End interview and close Companion"
            @click="requestInterviewShutdown"
          >
            Close
          </button>
        </div>
      </header>

      <div class="companion-no-drag mt-3 flex shrink-0 items-center gap-1.5 rounded-xl border border-white/10 bg-[rgba(17,24,39,.42)] p-1">
        <button
          class="h-7 rounded-lg px-4 text-[11px] font-extrabold transition companion-secondary"
          :class="activeTab === 'answer' ? 'border border-white/10 bg-white/15 companion-primary' : ''"
          @click="setTab('answer')"
        >
          Answer
        </button>
        <button
          class="h-7 rounded-lg px-4 text-[11px] font-extrabold transition companion-secondary"
          :class="activeTab === 'screenshot' ? 'border border-white/10 bg-white/15 companion-primary' : ''"
          @click="setTab('screenshot')"
        >
          Screenshot
        </button>
      </div>

      <div class="companion-no-drag mt-3 min-h-0 flex-1">
        <section v-if="activeTab === 'answer'" class="answer-layout">
          <article class="glass-panel theory-panel im-scrollbar p-4">
            <h2 class="text-[13px] font-extrabold companion-primary">Theory</h2>
            <div class="mt-4">
              <p class="text-[11px] font-extrabold uppercase companion-muted">Question</p>
              <p class="mt-2 whitespace-pre-line text-[13px] font-bold leading-5 companion-primary">
                {{ currentQuestion || 'Listening for interviewer audio...' }}
              </p>
            </div>
            <div class="mt-4">
              <p class="text-[11px] font-extrabold uppercase companion-muted">Explanation</p>
              <p class="mt-2 whitespace-pre-line text-[12.5px] font-medium leading-[21px] companion-secondary">
                {{ answerText }}
              </p>
            </div>
            <div class="mt-4">
              <p class="text-[11px] font-extrabold uppercase companion-muted">Bullet Points</p>
              <ul v-if="bulletPoints.length" class="mt-2 space-y-2 text-[12px] font-semibold leading-5 companion-secondary">
                <li v-for="point in bulletPoints" :key="point">&bull; {{ point }}</li>
              </ul>
              <SkeletonBlock v-else class="mt-2 h-14 w-full rounded-xl" />
            </div>
            <p class="mt-4 text-[11px] font-extrabold companion-muted">
              Confidence <span class="companion-primary">{{ compactConfidence }}</span>
            </p>
          </article>

          <article class="glass-panel code-panel flex flex-col p-4">
            <div class="flex shrink-0 items-center justify-between gap-3">
              <h2 class="text-[13px] font-extrabold companion-primary">Code</h2>
              <button
                v-if="code"
                class="h-7 rounded-lg border border-white/10 bg-white/[.06] px-3 text-[11px] font-extrabold companion-secondary transition hover:bg-white/[.1]"
                @click="copyCode"
              >
                Copy
              </button>
            </div>
            <pre v-if="code" class="im-scrollbar mt-4 min-h-0 flex-1 overflow-auto rounded-xl border border-white/10 bg-slate-950/70 p-4 text-[11px] font-semibold leading-[21px] text-cyan-100"><code v-html="highlightedCode"></code></pre>
            <div v-else class="mt-4 space-y-3">
              <SkeletonBlock class="h-4 w-2/3" />
              <SkeletonBlock v-for="item in 8" :key="item" class="h-3 w-full" />
            </div>
          </article>
        </section>

        <section v-else class="glass-panel flex h-full items-center justify-center overflow-hidden p-3">
          <img
            v-if="screenshotPreviewUrl"
            :src="screenshotPreviewUrl"
            alt="Latest OCR screenshot"
            class="h-full w-full object-contain"
          />
          <SkeletonBlock v-else class="h-full min-h-[220px] w-full rounded-xl" />
        </section>
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

.companion-surface {
  color: #fff;
  text-shadow: 0 1px 3px rgb(0 0 0 / 0.35);
}

.companion-titlebar {
  -webkit-app-region: drag;
  app-region: drag;
  user-select: none;
}

.companion-no-drag,
.companion-no-drag * {
  -webkit-app-region: no-drag;
  app-region: no-drag;
}

.glass-panel {
  border: 1px solid rgb(255 255 255 / 0.08);
  border-radius: 16px;
  background: rgb(17 24 39 / 0.55);
  backdrop-filter: blur(24px);
}

.answer-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 12px;
  width: 100%;
  height: 100%;
  min-height: 0;
}

.theory-panel,
.code-panel {
  min-width: 0;
  min-height: 0;
  overflow: auto;
}

.companion-primary {
  color: #fff;
}

.companion-secondary {
  color: #d1d5db;
}

.companion-muted {
  color: #9ca3af;
}

@media (prefers-color-scheme: light) {
  .companion-surface {
    color: #111827;
    text-shadow: 0 1px 2px rgb(255 255 255 / 0.45);
  }

  .companion-surface > section {
    background: rgb(255 255 255 / 0.72);
  }

  .glass-panel {
    border-color: rgb(17 24 39 / 0.1);
    background: rgb(255 255 255 / 0.62);
  }

  .companion-primary {
    color: #111827;
  }

  .companion-secondary {
    color: #374151;
  }

  .companion-muted {
    color: #4b5563;
  }
}
</style>
