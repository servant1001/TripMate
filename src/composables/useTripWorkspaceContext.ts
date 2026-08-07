import { inject, provide, type ComputedRef, type InjectionKey, type Ref } from 'vue'
import type {
  AlbumFolder,
  Expense,
  Favorite,
  InsuranceStatusSummary,
  ItineraryItem,
  PaymentTool,
  PaymentToolSummary,
  PaymentTransaction,
  RewardRule,
  Settlement,
  ShoppingItem,
  StoredValueBalance,
  TodoItem,
  Trip,
  PackingItem,
  Booking,
  AlbumPhoto,
  TravelInsurance,
} from '../types'

export type ItineraryDayGroup = { date: string; entries: ItineraryItem[] }
export type BalanceMember = Trip['members'][number] & { balance: number }
export type SettlementSuggestion = {
  fromId: string
  toId: string
  from: string
  to: string
  amount: number
}

export type TripWorkspaceContext = {
  current: ComputedRef<Trip | undefined>
  currentItems: ComputedRef<ItineraryItem[]>
  currentExpenses: ComputedRef<Expense[]>
  currentTodos: ComputedRef<TodoItem[]>
  currentPackingItems: ComputedRef<PackingItem[]>
  currentBookings: ComputedRef<Booking[]>
  currentFavorites: ComputedRef<Favorite[]>
  currentAlbumFolders: ComputedRef<AlbumFolder[]>
  currentAlbumPhotos: ComputedRef<AlbumPhoto[]>
  currentShoppingItems: ComputedRef<ShoppingItem[]>
  currentSettlements: ComputedRef<Settlement[]>
  currentInsurances: ComputedRef<TravelInsurance[]>
  currentInsuranceStatuses: ComputedRef<Record<string, InsuranceStatusSummary>>
  currentPaymentTools: ComputedRef<PaymentTool[]>
  currentRewardRules: ComputedRef<RewardRule[]>
  currentPaymentTransactions: ComputedRef<PaymentTransaction[]>
  currentStoredBalances: ComputedRef<StoredValueBalance[]>
  currentPaymentToolSummaries: ComputedRef<PaymentToolSummary[]>
  currentMember: ComputedRef<Trip['members'][number] | undefined>
  favoritesWithItineraryStatus: ComputedRef<(Favorite & { addedToItinerary: boolean })[]>
  itineraryDays: ComputedRef<ItineraryDayGroup[]>
  activeMemberId: ComputedRef<string | undefined>
  categoryBudgets: ComputedRef<Record<string, number>>
  budgetCategoryNames: ComputedRef<string[]>
  categoryBudgetSummary: ComputedRef<{ category: string; budget: number; spent: number }[]>
  dailyBudget: ComputedRef<number>
  dailyExpenseSummary: ComputedRef<{ date: string; spent: number }[]>
  personalBudget: ComputedRef<number>
  balances: ComputedRef<BalanceMember[]>
  settlementSuggestions: ComputedRef<SettlementSuggestion[]>
  total: ComputedRef<number>
  myPaid: ComputedRef<number>
  myPaidInTrip: ComputedRef<number>
  myBalance: ComputedRef<number>
  myBalanceInTrip: ComputedRef<number>
  myExpense: ComputedRef<number>
  accountingCurrency: string
  accountingRate: Ref<number>
  accountingRateDate: Ref<string>
  expenseAmountInAccounting: (expense: Expense) => number
  toTripCurrencyAmount: (amount: number) => number
  payerAmountInAccounting: (expense: Expense, memberId: string) => number
  canEditTrip: ComputedRef<boolean>
  canManageMembers: ComputedRef<boolean>
  canEditTripSettings: ComputedRef<boolean>
  favoriteItineraryRequestId: Ref<string>
  itinerarySortingEnabled: Ref<boolean>
  userId: ComputedRef<string>
  actorName: ComputedRef<string>
  memberManagerRequested: Ref<boolean>
  memberName: (memberId: string) => string
  formatTripDate: (date: string) => string
  mapsUrl: (location: string, mapUrl?: string) => string
  formatItineraryDate: (date: string) => string
  itineraryDuration: (entry: ItineraryItem) => string
  itineraryTimeWarning: (entries: ItineraryItem[], index: number) => string
  expensePayerLabel: (expense: Expense) => string
  expenseSplitLabel: (expense: Expense) => string
  expenseParticipantCount: (expense: Expense) => number
  expenseShare: (expense: Expense) => number
  toggleItinerary: (entry: ItineraryItem) => Promise<void>
  removeItem: (entry: ItineraryItem) => Promise<void>
  addFavoriteToItinerary: (favoriteItem: Favorite) => void
  clearFavoriteRequest: () => void
  toggleItinerarySorting: () => void
  sortItineraryItems: (payload: { date: string; oldIndex: number; newIndex: number }) => Promise<void>
  sortGroupItineraryItems: (payload: { groupId: string; oldIndex: number; newIndex: number }) => Promise<void>
  moveItineraryItem: (payload: {
    itemId: string
    from: string
    to: string
    oldIndex: number
    newIndex: number
  }) => Promise<void>
}

const tripWorkspaceContextKey: InjectionKey<TripWorkspaceContext> = Symbol('trip-workspace-context')

export function provideTripWorkspaceContext(context: TripWorkspaceContext) {
  provide(tripWorkspaceContextKey, context)
}

export function useTripWorkspaceContext() {
  const context = inject(tripWorkspaceContextKey)
  if (!context) throw new Error('TripWorkspaceContext 尚未提供。')
  return context
}
