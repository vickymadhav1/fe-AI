<script setup lang="ts">
defineProps<{
  as?: string
  padded?: boolean
}>()
</script>

<template>
  <component :is="as ?? 'section'" class="im-card" :class="padded === false ? '' : 'p-5'">
    <slot />
  </component>
</template>
