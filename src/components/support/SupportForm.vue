<script setup lang="ts">
import { computed, reactive, watch } from 'vue'
import type { SupportRequest, SupportRequestType } from '@/services/supportService'

const props = defineProps<{
  loading?: boolean
  initialEmail?: string
  selectedType: SupportRequestType
  title: string
  placeholder: string
}>()

const emit = defineEmits<{
  submit: [request: SupportRequest]
}>()

const form = reactive({
  email: props.initialEmail ?? '',
  message: '',
})

const touched = reactive({
  email: false,
  message: false,
})

watch(
  () => props.initialEmail,
  (email) => {
    if (!form.email && email) form.email = email
  },
)

const emailValid = computed(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
const errors = computed(() => ({
  email: form.email.trim() && emailValid.value ? '' : 'A valid email is required.',
  message: form.message.trim() ? '' : 'Message is required.',
}))
const valid = computed(() => emailValid.value && Boolean(form.message.trim()))

const markAllTouched = () => {
  touched.email = true
  touched.message = true
}

const submit = () => {
  markAllTouched()
  if (!valid.value || props.loading) return
  emit('submit', {
    type: props.selectedType,
    email: form.email,
    message: form.message,
  })
}
</script>

<template>
  <article class="h-full rounded-[18px] border border-[#263347] bg-[#0e1422] p-5">
    <div>
      <h2 class="text-[19px] font-bold text-slate-50">{{ title }}</h2>
    </div>
    <form class="mt-4 space-y-4" @submit.prevent="submit">
      <label class="block">
        <span class="text-[12px] font-bold uppercase text-slate-500">Email</span>
        <input
          v-model="form.email"
          class="mt-2 h-11 w-full rounded-[10px] border border-[#334155] bg-[#111827] px-4 text-[14px] font-medium text-slate-100 outline-none transition focus:border-cyan-400"
          type="email"
          autocomplete="email"
          @blur="touched.email = true"
        />
        <p v-if="touched.email && errors.email" class="mt-2 text-[12px] font-semibold text-rose-400">
          {{ errors.email }}
        </p>
      </label>

      <label class="block">
        <span class="text-[12px] font-bold uppercase text-slate-500">Message</span>
        <textarea
          v-model="form.message"
          class="mt-2 min-h-[150px] max-h-[220px] w-full resize-y rounded-[10px] border border-[#334155] bg-[#111827] px-4 py-3 text-[14px] font-medium text-slate-100 outline-none transition focus:border-cyan-400"
          :placeholder="placeholder"
          @blur="touched.message = true"
        ></textarea>
        <p v-if="touched.message && errors.message" class="mt-2 text-[12px] font-semibold text-rose-400">
          {{ errors.message }}
        </p>
      </label>

      <div class="flex justify-start">
        <button
          class="h-12 min-w-[220px] rounded-[10px] bg-slate-50 px-6 text-[14px] font-extrabold text-slate-950 transition hover:scale-[1.01] disabled:cursor-not-allowed disabled:opacity-50"
          type="submit"
          :disabled="!valid || loading"
        >
          {{ loading ? 'Submitting...' : 'Submit' }}
        </button>
      </div>
    </form>
  </article>
</template>
