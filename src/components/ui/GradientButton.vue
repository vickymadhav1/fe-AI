<script setup lang="ts">
defineProps<{
  variant?: 'primary' | 'ghost'
  disabled?: boolean
}>()
</script>

<template>
  <button class="im-button" :class="{ 'im-button-primary': variant === 'primary' }" :disabled="disabled">
    <slot />
  </button>
</template>
