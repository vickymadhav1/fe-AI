<script setup lang="ts">
import type { Component } from 'vue'
import KPICard from './KPICard.vue'

export interface DashboardKpi {
  id: string
  title: string
  value: string | number
  icon: Component
  helper?: string
}

defineProps<{
  items: DashboardKpi[]
}>()
</script>

<template>
  <section class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
    <KPICard
      v-for="item in items"
      :key="item.id"
      :title="item.title"
      :value="item.value"
      :icon="item.icon"
      :helper="item.helper"
    />
  </section>
</template>
