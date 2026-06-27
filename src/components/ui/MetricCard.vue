<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  hint?: string
}>()
</script>

<template>
  <article class="im-card p-5">
    <p class="im-caption">{{ label }}</p>
    <p class="mt-4 text-3xl font-black text-slate-50">{{ value }}</p>
    <p v-if="hint" class="mt-2 text-xs font-semibold text-slate-500">{{ hint }}</p>
    <slot />
  </article>
</template>
