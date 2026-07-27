<script setup lang="ts">
import TripItineraryView from './TripItineraryView.vue'
import { useTripWorkspaceContext } from '../composables/useTripWorkspaceContext'

const {
  current,
  currentItems,
  currentFavorites,
  currentPersonalItems,
  currentShoppingItems,
  favoriteItineraryRequestId,
  itineraryDays,
  canEditTrip,
  userId,
  itinerarySortingEnabled,
  formatItineraryDate,
  itineraryDuration,
  itineraryTimeWarning,
  mapsUrl,
  toggleItinerary,
  removeItem,
  clearFavoriteRequest,
  toggleItinerarySorting,
  sortItineraryItems,
  sortGroupItineraryItems,
  sortPersonalItineraryItems,
  moveItineraryItem,
} = useTripWorkspaceContext()
</script>

<template>
  <TripItineraryView
    :trip="current!"
    :items="currentItems"
    :favorites="currentFavorites"
    :user-id="userId"
    :favorite-request-id="favoriteItineraryRequestId"
    :days="itineraryDays"
    :personal-items="currentPersonalItems"
    :shopping-items="currentShoppingItems"
    :can-edit="canEditTrip"
    :sorting-enabled="itinerarySortingEnabled"
    :format-date="formatItineraryDate"
    :duration="itineraryDuration"
    :time-warning="itineraryTimeWarning"
    :maps-url="mapsUrl"
    @favorite-request-consumed="clearFavoriteRequest()"
    @toggle="toggleItinerary"
    @remove="removeItem"
    @toggle-sorting="toggleItinerarySorting"
    @sort="sortItineraryItems"
    @sort-group="sortGroupItineraryItems"
    @sort-personal="sortPersonalItineraryItems"
    @move="moveItineraryItem"
  />
</template>
