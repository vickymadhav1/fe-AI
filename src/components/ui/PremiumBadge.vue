<script setup lang="ts">
defineProps<{
  tone?: 'cyan' | 'green' | 'violet' | 'amber' | 'slate'
}>()
</script>

<template>
  <span class="im-badge">
    <span
      class="h-2 w-2 rounded-full"
      :class="{
        'bg-cyan-300': tone === 'cyan' || !tone,
        'bg-emerald-400': tone === 'green',
        'bg-violet-400': tone === 'violet',
        'bg-amber-400': tone === 'amber',
        'bg-slate-400': tone === 'slate',
      }"
    ></span>
    <slot />
  </span>
</template>
