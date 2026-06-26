<script setup lang="ts">
defineProps<{
  active: boolean
  protectionStatus: string
  meetingApp: string
  activeWindowTitle: string
}>()
</script>

<template>
  <article class="rounded-[18px] border border-[#263347] bg-[#0e1422] p-6">
    <h2 class="text-[19px] font-bold text-slate-50">Protection status</h2>
    <div class="mt-8 space-y-5 text-[14px] font-medium text-slate-300">
      <p class="flex items-center justify-between">
        Main window protected
        <span class="h-[18px] w-[18px] rounded-full" :class="active ? 'bg-emerald-500' : 'bg-slate-600'"></span>
      </p>
      <p class="flex items-center justify-between">
        Companion window protected
        <span class="h-[18px] w-[18px] rounded-full" :class="active ? 'bg-emerald-500' : 'bg-slate-600'"></span>
      </p>
      <p class="flex items-center justify-between">
        Meeting detection
        <span class="text-right text-cyan-300">{{ meetingApp || 'Pending' }}</span>
      </p>
      <p class="text-[13px] text-slate-500">{{ activeWindowTitle || protectionStatus || 'No active meeting window detected yet.' }}</p>
    </div>
  </article>
</template>

