<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { ArrowPathIcon, BellAlertIcon, CpuChipIcon, UserCircleIcon } from '@heroicons/vue/24/outline'
import { api } from '@/services/api'
import { useAuthStore } from '@/stores/auth.store'
import { useUiStore } from '@/stores/ui.store'
import type { AiProviderHealth, AiProviderStatus } from '@/types'

const authStore = useAuthStore()
const uiStore = useUiStore()
const notifications = ref(true)
const providers = ref<AiProviderHealth[]>([])
const loadingProviders = ref(false)

const statusLabel: Record<AiProviderStatus, string> = {
  healthy: 'Healthy',
  invalid_key: 'Invalid key',
  rate_limited: 'Rate limited',
  offline: 'Offline',
  disabled: 'Disabled',
}

const statusColor: Record<AiProviderStatus, string> = {
  healthy: 'bg-emerald-500',
  invalid_key: 'bg-rose-500',
  rate_limited: 'bg-amber-500',
  offline: 'bg-rose-500',
  disabled: 'bg-slate-400',
}

const loadProviderHealth = async (refresh = false) => {
  loadingProviders.value = true
  try {
    providers.value = await api.getAiProviderHealth(refresh)
  } finally {
    loadingProviders.value = false
  }
}

onMounted(() => void loadProviderHealth())
</script>

<template>
  <div class="space-y-6">
    <section class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div class="flex items-center gap-3">
        <UserCircleIcon class="h-7 w-7 text-cyan-500" />
        <h2 class="text-xl font-bold">Profile</h2>
      </div>
      <div class="mt-6 grid gap-5 md:grid-cols-2">
        <label class="space-y-2">
          <span class="text-sm font-medium">Name</span>
          <input :value="authStore.user?.name ?? ''" readonly class="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950" />
        </label>
        <label class="space-y-2">
          <span class="text-sm font-medium">Email</span>
          <input :value="authStore.user?.email ?? ''" readonly class="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-950" />
        </label>
      </div>
    </section>

    <section class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <CpuChipIcon class="h-7 w-7 text-cyan-500" />
          <div>
            <h2 class="text-xl font-bold">AI Provider Health</h2>
            <p class="text-sm text-slate-500 dark:text-slate-400">Requests automatically move to the next healthy provider.</p>
          </div>
        </div>
        <button class="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold disabled:opacity-60 dark:border-slate-700" :disabled="loadingProviders" @click="loadProviderHealth(true)">
          <ArrowPathIcon class="h-4 w-4" :class="loadingProviders ? 'animate-spin' : ''" />
          Refresh
        </button>
      </div>

      <div class="mt-6 overflow-x-auto">
        <table class="w-full min-w-[720px] text-left text-sm">
          <thead class="border-b border-slate-200 text-xs uppercase text-slate-500 dark:border-slate-800">
            <tr><th class="py-3">Provider</th><th>Status</th><th>Requests</th><th>Success</th><th>Failures</th><th>Last checked</th></tr>
          </thead>
          <tbody class="divide-y divide-slate-200 dark:divide-slate-800">
            <tr v-for="item in providers" :key="item.name">
              <td class="py-4 font-semibold capitalize">{{ item.name }}</td>
              <td><span class="inline-flex items-center gap-2"><span class="h-2.5 w-2.5 rounded-full" :class="statusColor[item.status]"></span>{{ statusLabel[item.status] }}</span></td>
              <td>{{ item.requestCount }}</td><td>{{ item.successCount }}</td><td>{{ item.failureCount }}</td>
              <td class="text-slate-500">{{ item.lastCheckedAt ? new Date(item.lastCheckedAt).toLocaleTimeString() : 'Not checked' }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div class="grid gap-6 md:grid-cols-2">
      <section class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 class="text-xl font-bold">Theme</h2>
        <div class="mt-5 inline-flex rounded-lg border border-slate-200 p-1 dark:border-slate-700">
          <button class="rounded-md px-4 py-2 text-sm font-semibold" :class="uiStore.theme === 'light' ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'text-slate-500'" @click="uiStore.setTheme('light')">Light</button>
          <button class="rounded-md px-4 py-2 text-sm font-semibold" :class="uiStore.theme === 'dark' ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950' : 'text-slate-500'" @click="uiStore.setTheme('dark')">Dark</button>
        </div>
      </section>
      <section class="rounded-lg border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <div class="flex items-center gap-3"><BellAlertIcon class="h-7 w-7 text-cyan-500" /><h2 class="text-xl font-bold">Notifications</h2></div>
        <label class="mt-5 flex items-center justify-between gap-4"><span class="font-semibold">Interview reminders</span><input v-model="notifications" type="checkbox" class="h-5 w-5 accent-cyan-500" /></label>
      </section>
    </div>
  </div>
</template>
