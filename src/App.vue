<script setup>
import { RouterView } from 'vue-router'
import { onBeforeUnmount, onMounted } from 'vue'
import ToastStack from '@/components/ui/ToastStack.vue'
import { useUiStore } from '@/stores/ui.store'
import { useAuthStore } from '@/stores/auth.store'

const uiStore = useUiStore()
const authStore = useAuthStore()
const handleInvalidAuth = () => authStore.logout()

onMounted(() => {
  uiStore.initializeTheme()
  uiStore.initializeStealthSettings()
  window.addEventListener('interview-mate-auth-invalid', handleInvalidAuth)
})

onBeforeUnmount(() => {
  window.removeEventListener('interview-mate-auth-invalid', handleInvalidAuth)
})
</script>

<template>
  <RouterView />
  <ToastStack />
</template>

<style scoped>
</style>
