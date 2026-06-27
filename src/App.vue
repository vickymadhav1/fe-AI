<script setup>
import { RouterView } from 'vue-router'
import { onMounted } from 'vue'
import ToastStack from '@/components/ui/ToastStack.vue'
import { useUiStore } from '@/stores/ui.store'

const uiStore = useUiStore()

onMounted(() => {
  uiStore.initializeTheme()
  uiStore.initializeStealthSettings()
})
</script>

<template>
  <RouterView />
  <ToastStack />
</template>

<style scoped>
</style>
