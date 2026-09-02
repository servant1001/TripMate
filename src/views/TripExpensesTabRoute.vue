<script setup lang="ts">
import TripExpensesView from './TripExpensesView.vue'
import { useTripWorkspaceContext } from '../composables/useTripWorkspaceContext'

const {
  current,
  currentExpenses,
  currentPaymentTools,
  currentRewardRules,
  currentPaymentTransactions,
  total,
  myPaid,
  myPaidInTrip,
  myBalance,
  myBalanceInTrip,
  activeMemberId,
  personalBudget,
  myExpense,
  accountingCurrency,
  accountingRate,
  accountingRateDate,
  expenseAmountInAccounting,
  toTripCurrencyAmount,
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
    :payment-tools="currentPaymentTools"
    :payment-rules="currentRewardRules"
    :payment-transactions="currentPaymentTransactions"
    :total="total"
    :my-paid="myPaid"
    :my-paid-in-trip="myPaidInTrip"
    :my-balance="myBalance"
    :my-balance-in-trip="myBalanceInTrip"
    :personal-budget-member-id="activeMemberId"
    :personal-budget="personalBudget"
    :personal-spent="myExpense"
    :accounting-currency="accountingCurrency"
    :accounting-rate="accountingRate"
    :accounting-rate-date="accountingRateDate"
    :expense-amount-in-accounting="expenseAmountInAccounting"
    :to-trip-currency-amount="toTripCurrencyAmount"
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
