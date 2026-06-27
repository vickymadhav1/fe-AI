<script setup lang="ts">
import {
  ArrowRightStartOnRectangleIcon,
  BellIcon,
  UserCircleIcon,
} from '@heroicons/vue/24/outline'
import PremiumBadge from './PremiumBadge.vue'

defineProps<{
  name: string
  initials: string
}>()

defineEmits<{
  notifications: []
  logout: []
}>()
</script>

<template>
  <footer class="mt-auto border-t border-white/10 pt-4">
    <div class="flex min-h-[70px] items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.035] px-4 py-3">
      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-800 text-[14px] font-extrabold text-slate-100">
        <span v-if="initials">{{ initials }}</span>
        <UserCircleIcon v-else class="h-6 w-6" />
      </div>
       <button
        class="mt-1 flex h-10 w-full items-center gap-3 rounded-lg px-3 text-left text-[13px] font-bold text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-300"
        type="button"
        @click="$emit('logout')"
      >
        Logout
      </button>
    </div>
  </footer>
</template>
