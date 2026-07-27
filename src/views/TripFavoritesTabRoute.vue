<script setup lang="ts">
import TripFavoritesView from './TripFavoritesView.vue'
import { useTripWorkspaceContext } from '../composables/useTripWorkspaceContext'

const {
  current,
  favoritesWithItineraryStatus,
  currentMember,
  actorName,
  canEditTrip,
  userId,
  memberName,
  addFavoriteToItinerary,
} = useTripWorkspaceContext()
</script>

<template>
  <TripFavoritesView
    :trip="current!"
    :favorites="favoritesWithItineraryStatus"
    :currency="current!.currency"
    :can-edit="canEditTrip"
    :user-id="userId"
    :actor-name="currentMember?.name || actorName"
    :member-name="memberName"
    @add-to-itinerary="addFavoriteToItinerary"
  />
</template>
