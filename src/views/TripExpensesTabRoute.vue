<script setup lang="ts">
import TripExpensesView from './TripExpensesView.vue'
import { useTripWorkspaceContext } from '../composables/useTripWorkspaceContext'

const {
  current,
  currentExpenses,
  total,
  myPaid,
  myBalance,
  activeMemberId,
  personalBudget,
  myExpense,
  categoryBudgets,
  budgetCategoryNames,
  categoryBudgetSummary,
  dailyBudget,
  dailyExpenseSummary,
  canEditTrip,
  canEditTripSettings,
  userId,
  expensePayerLabel,
  expenseSplitLabel,
  expenseParticipantCount,
  expenseShare,
} = useTripWorkspaceContext()
</script>

<template>
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
</template>
