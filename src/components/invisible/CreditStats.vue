<script setup lang="ts">
defineProps<{
  remainingCredits: number
  totalCredits: number
  creditsUsed: number
  creditsPerMinute: number
}>()
</script>

<template>
  <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-6">
    <h2 class="text-[19px] font-bold text-slate-50">Credit wallet</h2>
    <div class="mt-8 grid gap-4 sm:grid-cols-3">
      <div>
        <p class="text-[11px] font-bold uppercase text-slate-500">Remaining Credits</p>
        <p class="mt-3 text-[34px] font-extrabold text-slate-50">{{ remainingCredits }}</p>
      </div>
      <div>
        <p class="text-[11px] font-bold uppercase text-slate-500">Remaining Minutes</p>
        <p class="mt-3 text-[34px] font-extrabold text-slate-50">{{ Math.floor(remainingCredits / Math.max(1, creditsPerMinute)) }}</p>
      </div>
      <div>
        <p class="text-[11px] font-bold uppercase text-slate-500">Usage Rate</p>
        <p class="mt-3 text-[18px] font-bold text-slate-200">{{ creditsPerMinute }} credits / active minute</p>
      </div>
    </div>
    <div class="mt-7 h-[18px] overflow-hidden rounded-full bg-slate-800">
      <div
        class="h-full rounded-full bg-[linear-gradient(90deg,#38bdf8,#8b5cf6_50%,#22c55e)]"
        :style="{ width: `${Math.min(100, (remainingCredits / Math.max(1, totalCredits)) * 100)}%` }"
      ></div>
    </div>
    <p class="mt-4 text-[13px] font-medium text-slate-500">{{ creditsUsed }} credits used</p>
  </article>
</template>

