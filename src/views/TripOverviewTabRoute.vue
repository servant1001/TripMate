<script setup lang="ts">
import TripItineraryView from './TripItineraryView.vue'
import TripExpensesView from './TripExpensesView.vue'
import TripMembersView from './TripMembersView.vue'
import { useTripWorkspaceContext } from '../composables/useTripWorkspaceContext'

const {
  current,
  currentItems,
  currentFavorites,
  currentPersonalItems,
  currentShoppingItems,
  currentExpenses,
  currentSettlements,
  favoriteItineraryRequestId,
  itineraryDays,
  activeMemberId,
  categoryBudgets,
  budgetCategoryNames,
  categoryBudgetSummary,
  dailyBudget,
  dailyExpenseSummary,
  personalBudget,
  balances,
  settlementSuggestions,
  total,
  myPaid,
  myBalance,
  myExpense,
  canEditTrip,
  canManageMembers,
  canEditTripSettings,
  userId,
  memberManagerRequested,
  itinerarySortingEnabled,
  formatItineraryDate,
  itineraryDuration,
  itineraryTimeWarning,
  mapsUrl,
  expensePayerLabel,
  expenseSplitLabel,
  expenseParticipantCount,
  expenseShare,
  toggleItinerary,
  removeItem,
  clearFavoriteRequest,
  toggleItinerarySorting,
  sortItineraryItems,
  sortGroupItineraryItems,
  sortPersonalItineraryItems,
  moveItineraryItem,
  memberName,
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

  <TripExpensesView
    :trip="current!"
    :expenses="currentExpenses"
    :total="total"
    :my-paid="myPaid"
    :my-balance="myBalance"
    :personal-budget-member-id="activeMemberId"
    :personal-budget="personalBudget"
    :personal-spent="myExpense"
    :category-budget-values="categoryBudgets"
    :category-budget-options="budgetCategoryNames"
    :category-budgets="categoryBudgetSummary"
    :daily-budget="dailyBudget"
    :daily-expenses="dailyExpenseSummary"
    :can-set-personal-budget="Boolean(activeMemberId)"
    :can-manage-category-budgets="canEditTripSettings"
    :can-edit="canEditTrip"
    :user-id="userId"
    :payer-label="expensePayerLabel"
    :split-label="expenseSplitLabel"
    :participant-count="expenseParticipantCount"
    :share="expenseShare"
  />

  <TripMembersView
    v-model:open-manager="memberManagerRequested"
    :trip="current!"
    :balances="balances"
    :suggestions="settlementSuggestions"
    :settlements="currentSettlements"
    :expenses="currentExpenses"
    :can-manage="canManageMembers"
    :can-edit="canEditTrip"
    :member-name="memberName"
  />
</template>
