<script setup lang="ts">
import TripAlbumView from './TripAlbumView.vue'
import { useTripWorkspaceContext } from '../composables/useTripWorkspaceContext'

const { current, currentAlbumPhotos, currentItems, canEditTrip, userId, memberName, formatTripDate } = useTripWorkspaceContext()
</script>

<template>
  <TripAlbumView :trip="current!" :photos="currentAlbumPhotos" :items="currentItems" :can-edit="canEditTrip" :user-id="userId" :member-name="memberName" :format-date="formatTripDate" />
</template>
