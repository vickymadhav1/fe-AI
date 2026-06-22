<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useSessionStore } from '@/stores/session.store'

const sessionStore = useSessionStore()
const { currentQuestion, answer, code, confidence, provider, screenStatus, lastCapture,screenshotPreviewUrl } = storeToRefs(sessionStore)
const activeTab = ref<'answer' | 'code' | 'screenshot'>('answer')
let removeResultListener: (() => void) | undefined
const companion = window.interviewMateDesktop?.floating

onMounted(async () => {
  const latest = await companion?.getLatest()
  if (latest) sessionStore.updateFloatingResult(latest)
  removeResultListener = companion?.onResult((nextResult) => {
    sessionStore.updateFloatingResult(nextResult)
  })
})

onBeforeUnmount(() => {
  removeResultListener?.()
})
</script>

<template>
  <main class="h-screen overflow-hidden rounded-lg border border-cyan-400/30 bg-slate-950/95 text-white shadow-2xl">
    <header class="border-b border-white/10 px-5 py-4" style="-webkit-app-region: drag">
      <p class="text-xs font-bold uppercase text-cyan-300">Interview Mate AI Companion</p>
      <p class="mt-1 text-sm font-semibold text-slate-100">
        {{ currentQuestion || 'Listening for the interviewer...' }}
      </p>
    </header>

    <div class="h-[calc(100%-73px)] space-y-5 overflow-y-auto p-5">
      <div class="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <div class="inline-flex rounded border border-white/10 bg-black/20 p-1">
          <button class="rounded px-3 py-1.5 text-xs font-semibold" :class="activeTab === 'answer' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300'" @click="activeTab = 'answer'">Answer</button>
          <button class="rounded px-3 py-1.5 text-xs font-semibold" :class="activeTab === 'code' ? 'bg-cyan-500 text-slate-950' : 'text-slate-300'" @click="activeTab = 'code'">Code</button>
        <button  class="rounded px-3 py-1.5 text-xs font-semibold"  :class="activeTab === 'screenshot' ? 'bg-cyan-500 text-slate-950': 'text-slate-300'"@click="activeTab = 'screenshot'">Screenshot </button>
        </div>
        <span class="inline-flex items-center gap-2 text-xs text-slate-300">
          <span class="h-2 w-2 rounded-full" :class="screenStatus === 'Active' ? 'bg-emerald-400' : 'bg-rose-400'"></span>
          {{ screenStatus }}
        </span>
      </div>

      <section v-if="activeTab === 'answer'">
        <p class="text-xs font-bold uppercase text-cyan-300">Answer</p>
        <p class="mt-2 whitespace-pre-line text-sm leading-6 text-slate-100">
          {{ answer || 'The next answer will appear here automatically.' }}
        </p>
      </section>

      <section v-else-if="code">
        <p class="text-xs font-bold uppercase text-cyan-300">
          Generated code
        </p>
        <pre class="mt-2 max-h-72 overflow-auto whitespace-pre rounded bg-black/40 p-3 font-mono text-xs leading-5">{{ code }}</pre>
      </section>

      <section v-else-if="activeTab === 'screenshot'">
        <img
  v-if="screenshotPreviewUrl"
  :src="screenshotPreviewUrl"
  alt="Latest Screenshot"
  class="w-full rounded border border-white/10"
/>

        <p v-else class="text-sm text-slate-400">
  No screenshot captured yet.
  <p class="text-xs break-all">
  {{ screenshotPreviewUrl }}
</p>
</p>
      </section>

      <p v-else class="text-sm text-slate-400">No generated code is needed for this answer.</p>
      <section class="border-t border-white/10 pt-4">
        <p class="text-xs font-bold uppercase text-slate-400">Confidence</p>
        <p class="mt-1 text-lg font-bold text-emerald-300">
          {{ Math.round(confidence * 100) }}%
        </p>
        <div class="mt-3 flex items-center justify-between text-xs text-slate-400">
          <span>Provider: {{ provider || 'Waiting' }}</span>
          <span v-if="lastCapture">Captured {{ new Date(lastCapture).toLocaleTimeString() }}</span>
        </div>
      </section>
    </div>
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
