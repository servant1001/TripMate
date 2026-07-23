<script setup lang="ts">
import TripTodoCard from '../components/TripTodoCard.vue'
import type { TodoItem, Trip } from '../types'

defineProps<{ trip: Trip; todos: TodoItem[]; canEdit: boolean; memberName: (id: string) => string }>()
const emit = defineEmits<{ add: []; toggle: [todo: TodoItem]; edit: [todo: TodoItem]; remove: [todo: TodoItem] }>()
</script>

<template>
  <section class="trip-todos-view" aria-label="旅行待辦"><TripTodoCard :trip="trip" :todos="todos" :can-edit-trip="canEdit" :member-name="memberName" @add="emit('add')" @toggle="emit('toggle', $event)" @edit="emit('edit', $event)" @remove="emit('remove', $event)" /></section>
</template>

<style scoped>.trip-todos-view{display:grid;grid-column:1/-1;min-width:0}</style>
