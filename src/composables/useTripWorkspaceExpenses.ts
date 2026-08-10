import { computed, ref, watch, type ComputedRef } from 'vue'
import type { Expense, Settlement, Trip } from '../types'
import { getLatestExchangeRate } from '../services/exchangeRates'
import { participantsForExpense, payerSharesForExpense, splitModeLabel, splitShareForMember } from '../utils/expenseSplit'

export function useTripWorkspaceExpenses({
  trip,
  expenses,
  settlements,
  activeMemberId,
}: {
  trip: ComputedRef<Trip | undefined>
  expenses: ComputedRef<Expense[]>
  settlements: ComputedRef<Settlement[]>
  activeMemberId: ComputedRef<string | undefined>
}) {
  const accountingCurrency = 'TWD'
  const accountingRate = ref(trip.value?.currency?.toUpperCase() === accountingCurrency ? 1 : 0)
  const accountingRateDate = ref('')
  const historicalAccountingRates = ref<Record<string, number>>({})
  let historicalRateRequest = 0

  async function refreshAccountingRate() {
    const tripCurrency = trip.value?.currency?.trim().toUpperCase()
    if (!tripCurrency || tripCurrency === accountingCurrency) {
      accountingRate.value = 1
      accountingRateDate.value = ''
      return
    }
    try {
      const quote = await getLatestExchangeRate(tripCurrency, accountingCurrency)
      accountingRate.value = quote.rate
      accountingRateDate.value = quote.date
    } catch {
      accountingRate.value = 0
      accountingRateDate.value = ''
    }
  }

  watch(() => trip.value?.currency, () => { void refreshAccountingRate() }, { immediate: true })

  async function refreshHistoricalAccountingRates() {
    const tripCurrency = trip.value?.currency?.trim().toUpperCase()
    if (!tripCurrency || tripCurrency === accountingCurrency) return
    const requestId = ++historicalRateRequest
    const candidates = expenses.value.filter((expense) => {
      const hasTwdSource = expense.sourceCurrency?.trim().toUpperCase() === accountingCurrency && Number(expense.sourceAmount) > 0
      return !hasTwdSource && !(Number(expense.accountingRate) > 0) && !(Number(historicalAccountingRates.value[expense.id]) > 0)
    })
    await Promise.all(candidates.map(async (expense) => {
      try {
        let quote
        try {
          quote = await getLatestExchangeRate(tripCurrency, accountingCurrency, expense.date ? { date: expense.date } : undefined)
        } catch {
          quote = await getLatestExchangeRate(tripCurrency, accountingCurrency)
        }
        if (requestId !== historicalRateRequest) return
        historicalAccountingRates.value = { ...historicalAccountingRates.value, [expense.id]: quote.rate }
      } catch {
        // 保留旅行層級匯率作為無法取得歷史資料時的最後備援。
      }
    }))
  }

  watch([() => trip.value?.currency, expenses], () => { void refreshHistoricalAccountingRates() }, { immediate: true })

  function expenseAmountInAccounting(expense: Expense) {
    const sourceCurrency = expense.sourceCurrency?.trim().toUpperCase()
    if (sourceCurrency === accountingCurrency && Number(expense.sourceAmount) > 0) {
      return Number(expense.sourceAmount)
    }
    const storedRate = Number(expense.accountingRate) || Number(historicalAccountingRates.value[expense.id]) || 0
    return Number(expense.amount || 0) * (storedRate > 0 ? storedRate : accountingRate.value || 0)
  }

  function expenseScale(expense: Expense) {
    const storedAmount = Number(expense.amount) || 0
    return storedAmount > 0 ? expenseAmountInAccounting(expense) / storedAmount : 0
  }

  function payerSharesInAccounting(expense: Expense) {
    const scale = expenseScale(expense)
    return Object.fromEntries(
      Object.entries(payerSharesForExpense(expense)).map(([memberId, amount]) => [memberId, amount * scale]),
    )
  }
  function payerAmountInAccounting(expense: Expense, memberId: string) {
    return payerSharesInAccounting(expense)[memberId] || 0
  }
  function expenseParticipants(expense: Pick<Expense, 'kind' | 'payerId' | 'participantIds'>) {
    return participantsForExpense(expense, trip.value?.members.map((member) => member.id) || [])
  }

  function expenseParticipantCount(expense: Expense) {
    return expenseParticipants(expense).length
  }

  function expensePayerName(payerId: string) {
    return trip.value?.members.find((member) => member.id === payerId)?.name || '未知成員'
  }

  function expensePayerLabel(expense: Expense) {
    const payers = payerSharesForExpense(expense)
    const names = Object.keys(payers).map(expensePayerName)
    return names.length > 1
      ? `${names.join('、')} 共同支付`
      : `${names[0] || expensePayerName(expense.payerId)} 支付`
  }

  function expenseShare(expense: Expense) {
    return expenseShareForMember(expense, expenseParticipants(expense)[0] || '')
  }

  function expenseShareForMember(expense: Expense, memberId: string) {
    return splitShareForMember(expense, memberId, trip.value?.members.map((member) => member.id) || []) * expenseScale(expense)
  }

  function expenseSplitLabel(expense: Expense) {
    return expense.kind === 'personal' ? '個人支出' : splitModeLabel(expense.splitMode)
  }

  const total = computed(() => expenses.value.reduce((sum, expense) => sum + expenseAmountInAccounting(expense), 0))
  const baseBudgetCategories = ['餐飲', '交通', '住宿', '購物', '伴手禮', '景點', '其他']
  const balances = computed(() => {
    const currentTrip = trip.value
    if (!currentTrip) return []
    const paid = Object.fromEntries(currentTrip.members.map((member) => [member.id, 0]))
    const owed = Object.fromEntries(currentTrip.members.map((member) => [member.id, 0]))
    expenses.value.forEach((expense) => {
      Object.entries(payerSharesInAccounting(expense)).forEach(([memberId, amount]) => {
        paid[memberId] = (paid[memberId] || 0) + amount
      })
      expenseParticipants(expense).forEach((id) => {
        owed[id] = (owed[id] || 0) + expenseShareForMember(expense, id)
      })
    })
    settlements.value.forEach((settlement) => {
      const amount = settlement.amount * (accountingRate.value || 0)
      paid[settlement.fromId] = (paid[settlement.fromId] || 0) + amount
      paid[settlement.toId] = (paid[settlement.toId] || 0) - amount
    })
    return currentTrip.members.map((member) => ({
      ...member,
      balance: paid[member.id] - owed[member.id],
    }))
  })

  const settlementSuggestions = computed(() => {
    const creditors = balances.value
      .filter((member) => member.balance > 0.01)
      .map((member) => ({ ...member, remaining: member.balance }))
    const debtors = balances.value
      .filter((member) => member.balance < -0.01)
      .map((member) => ({ ...member, remaining: -member.balance }))
    const suggestions: { fromId: string; toId: string; from: string; to: string; amount: number }[] = []
    let creditorIndex = 0
    debtors.forEach((debtor) => {
      while (debtor.remaining > 0.01 && creditors[creditorIndex]) {
        const creditor = creditors[creditorIndex]
        const amount = Math.min(debtor.remaining, creditor.remaining)
        suggestions.push({
          fromId: debtor.id,
          toId: creditor.id,
          from: debtor.name,
          to: creditor.name,
          amount,
        })
        debtor.remaining -= amount
        creditor.remaining -= amount
        if (creditor.remaining <= 0.01) creditorIndex += 1
      }
    })
    return suggestions
  })

  const myPaid = computed(() =>
    activeMemberId.value
      ? expenses.value.reduce(
          (sum, expense) => sum + (payerSharesInAccounting(expense)[activeMemberId.value!] || 0),
          0,
        )
      : 0,
  )
  const myPaidInTrip = computed(() =>
    activeMemberId.value
      ? expenses.value.reduce(
          (sum, expense) => sum + (payerSharesForExpense(expense)[activeMemberId.value!] || 0),
          0,
        )
      : 0,
  )
  const myBalanceInTrip = computed(() => {
    if (!activeMemberId.value) return 0
    const memberIds = trip.value?.members.map((member) => member.id) || []
    const memberId = activeMemberId.value
    const paid = expenses.value.reduce(
      (sum, expense) => sum + (payerSharesForExpense(expense)[memberId] || 0),
      0,
    )
    const owed = expenses.value.reduce(
      (sum, expense) => sum + splitShareForMember(expense, memberId, memberIds),
      0,
    )
    const settlementsPaid = settlements.value.reduce(
      (sum, settlement) => sum + (settlement.fromId === memberId ? settlement.amount : 0),
      0,
    )
    const settlementsReceived = settlements.value.reduce(
      (sum, settlement) => sum + (settlement.toId === memberId ? settlement.amount : 0),
      0,
    )
    return paid - owed + settlementsPaid - settlementsReceived
  })
  const myBalance = computed(() =>
    activeMemberId.value
      ? balances.value.find((member) => member.id === activeMemberId.value)?.balance || 0
      : 0,
  )
  const myExpense = computed(() =>
    activeMemberId.value
      ? expenses.value.reduce(
          (sum, expense) => sum + expenseShareForMember(expense, activeMemberId.value!),
          0,
        )
      : 0,
  )

  return {
    accountingCurrency,
    accountingRate,
    accountingRateDate,
    expenseAmountInAccounting,
    toTripCurrencyAmount: (amount: number) => amount / (accountingRate.value || 1),
    payerAmountInAccounting,
    baseBudgetCategories,
    total,
    balances,
    settlementSuggestions,
    myPaid,
    myPaidInTrip,
    myBalance,
    myBalanceInTrip,
    myExpense,
    expensePayerLabel,
    expenseSplitLabel,
    expenseParticipantCount,
    expenseShare,
    expenseShareForMember,
  }
}
