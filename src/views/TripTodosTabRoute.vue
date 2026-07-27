<script setup lang="ts">
import TripTodosView from './TripTodosView.vue'
import { useTripWorkspaceContext } from '../composables/useTripWorkspaceContext'

const { current, currentTodos, canEditTrip, userId, memberName } = useTripWorkspaceContext()
</script>

<template>
  <TripTodosView :trip="current!" :todos="currentTodos" :can-edit="canEditTrip" :user-id="userId" :member-name="memberName" />
</template>
