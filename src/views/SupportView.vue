<script setup lang="ts">
import { onMounted, ref } from 'vue'
import SkeletonBlock from '@/components/ui/SkeletonBlock.vue'

const ready = ref(false)
const isDesktopRuntime = Boolean(window.interviewMateDesktop?.isElectron)
const runtimeLabel = isDesktopRuntime ? 'Desktop' : 'Web'
const diagnostics = [
  ['Network', navigator.onLine ? 'Online' : 'Offline'],
  ['Desktop runtime', isDesktopRuntime ? 'Electron' : 'Browser'],
  ['Platform', window.interviewMateDesktop?.platform ?? navigator.platform],
]

onMounted(() => {
  window.requestAnimationFrame(() => {
    ready.value = true
  })
})
</script>

<template>
  <div class="im-prototype-page">
    <!-- <section>
      <h1 class="text-[40px] font-extrabold leading-none text-slate-50">Support</h1>
      <p class="mt-5 text-[14px] font-medium text-slate-300">Help center, diagnostics, and product feedback</p>
    </section>

    <section v-if="!ready" class="mt-9 grid gap-6 xl:grid-cols-3">
      <article v-for="item in 3" :key="item" class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <SkeletonBlock class="h-5 w-36" />
        <SkeletonBlock class="mt-5 h-4 w-full" />
        <SkeletonBlock class="mt-3 h-4 w-2/3" />
      </article>
    </section>

    <section v-else class="mt-9 grid gap-6 xl:grid-cols-3">
      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <h2 class="text-[19px] font-bold text-slate-50">Help Center</h2>
        <p class="mt-5 text-[14px] font-medium text-slate-300">Find setup guides for screen capture, audio, Invisible Mode, and Companion Window usage.</p>
      </article>
      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <h2 class="text-[19px] font-bold text-slate-50">Documentation</h2>
        <p class="mt-5 text-[14px] font-medium text-slate-300">Review feature behavior, privacy notes, and troubleshooting steps for meeting apps.</p>
      </article>
      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <h2 class="text-[19px] font-bold text-slate-50">FAQ</h2>
        <p class="mt-5 text-[14px] font-medium text-slate-300">Answers for common questions about credits, capture protection, and interview sessions.</p>
      </article>
    </section> -->

    <section v-if="!ready" class="mt-6 grid gap-6 xl:grid-cols-3">
      <article v-for="item in 3" :key="item" class="rounded-[18px] border border-[#334155] bg-[#111827] p-8">
        <SkeletonBlock class="h-5 w-36" />
        <SkeletonBlock class="mt-5 h-4 w-full" />
        <SkeletonBlock class="mt-3 h-4 w-3/4" />
      </article>
    </section>

    <section v-else class="mt-6 grid gap-6 xl:grid-cols-3">
      <button class="rounded-[18px] border border-[#334155] bg-[#111827] p-8 text-left transition hover:border-cyan-400">
        <h2 class="text-[19px] font-bold text-slate-50">Contact Support</h2>
        <p class="mt-5 text-[14px] font-medium text-slate-300">Send account, billing, or technical questions to the support team.</p>
      </button>
      <button class="rounded-[18px] border border-[#334155] bg-[#111827] p-8 text-left transition hover:border-cyan-400">
        <h2 class="text-[19px] font-bold text-slate-50">Report a Bug</h2>
        <p class="mt-5 text-[14px] font-medium text-slate-300">Share logs, screenshots, and steps to reproduce product issues.</p>
      </button>
      <button class="rounded-[18px] border border-[#334155] bg-[#111827] p-8 text-left transition hover:border-cyan-400">
        <h2 class="text-[19px] font-bold text-slate-50">Feature Request</h2>
        <p class="mt-5 text-[14px] font-medium text-slate-300">Suggest improvements for AI answers, screen capture, or workflow controls.</p>
      </button>
    </section>

    <section v-if="!ready" class="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <SkeletonBlock class="h-5 w-32" />
        <div class="mt-7 grid gap-4 md:grid-cols-2">
          <div v-for="item in 4" :key="item" class="rounded-[10px] border border-[#334155] bg-[#111827] p-4">
            <SkeletonBlock class="h-3 w-24" />
            <SkeletonBlock class="mt-3 h-4 w-32" />
          </div>
        </div>
      </article>
      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <SkeletonBlock class="h-5 w-40" />
        <div class="mt-7 space-y-4">
          <SkeletonBlock v-for="item in 3" :key="item" class="h-4 w-full" />
        </div>
      </article>
    </section>

    <section v-else class="mt-6 grid gap-6 xl:grid-cols-[1fr_420px]">
      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <h2 class="text-[19px] font-bold text-slate-50">Diagnostics</h2>
        <div class="mt-7 grid gap-4 md:grid-cols-2">
          <div
            v-for="[label, value] in diagnostics"
            :key="label"
            class="rounded-[10px] border border-[#334155] bg-[#111827] p-4"
          >
            <p class="text-[11px] font-bold uppercase text-slate-500">{{ label }}</p>
            <p class="mt-3 text-[14px] font-bold text-slate-200">{{ value }}</p>
          </div>
        </div>
      </article>

      <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-8">
        <h2 class="text-[19px] font-bold text-slate-50">Version Information</h2>
        <div class="mt-7 space-y-4 text-[14px] font-medium text-slate-300">
          <p class="flex justify-between"><span>App</span><span>Interview Mate AI</span></p>
          <p class="flex justify-between"><span>Runtime</span><span>{{ runtimeLabel }}</span></p>
        </div>
      </article>
    </section>
  </div>
</template>
