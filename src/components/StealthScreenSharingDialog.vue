<script setup lang="ts">
defineProps<{
  remember: boolean
}>()

const emit = defineEmits<{
  choose: [enabled: boolean]
  'update:remember': [remember: boolean]
}>()

const updateRemember = (event: Event) => {
  emit('update:remember', (event.target as HTMLInputElement).checked)
}
</script>

<template>
  <div
    class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    @click.self="emit('choose', false)"
  >
    <div class="w-full max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
      <h3 class="text-lg font-bold">Screen Sharing</h3>
      <p class="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Will you be sharing your screen during this interview?
      </p>

      <label class="mt-5 flex items-center gap-3 text-sm font-semibold text-slate-700 dark:text-slate-200">
        <input :checked="remember" type="checkbox" class="h-4 w-4 accent-cyan-500" @change="updateRemember" />
        Remember my choice
      </label>

      <div class="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
        <button
          class="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          @click="emit('choose', false)"
        >
          No, Continue Normally
        </button>
        <button
          class="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
          @click="emit('choose', true)"
        >
          Yes, Enable Stealth Mode
        </button>
      </div>
    </div>
  </div>
</template>
