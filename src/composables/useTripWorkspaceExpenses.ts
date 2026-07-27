import { computed, type ComputedRef } from 'vue'
import type { Expense, Settlement, Trip } from '../types'
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
    return splitShareForMember(expense, memberId, trip.value?.members.map((member) => member.id) || [])
  }

  function expenseSplitLabel(expense: Expense) {
    return expense.kind === 'personal' ? '個人支出' : splitModeLabel(expense.splitMode)
  }

  const total = computed(() => expenses.value.reduce((sum, expense) => sum + expense.amount, 0))
  const baseBudgetCategories = ['餐飲', '交通', '住宿', '購物', '景點', '其他']
  const balances = computed(() => {
    const currentTrip = trip.value
    if (!currentTrip) return []
    const paid = Object.fromEntries(currentTrip.members.map((member) => [member.id, 0]))
    const owed = Object.fromEntries(currentTrip.members.map((member) => [member.id, 0]))
    expenses.value.forEach((expense) => {
      Object.entries(payerSharesForExpense(expense)).forEach(([memberId, amount]) => {
        paid[memberId] = (paid[memberId] || 0) + amount
      })
      expenseParticipants(expense).forEach((id) => {
        owed[id] = (owed[id] || 0) + expenseShareForMember(expense, id)
      })
    })
    settlements.value.forEach((settlement) => {
      paid[settlement.fromId] = (paid[settlement.fromId] || 0) + settlement.amount
      paid[settlement.toId] = (paid[settlement.toId] || 0) - settlement.amount
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
          (sum, expense) => sum + (payerSharesForExpense(expense)[activeMemberId.value!] || 0),
          0,
        )
      : 0,
  )
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
    baseBudgetCategories,
    total,
    balances,
    settlementSuggestions,
    myPaid,
    myBalance,
    myExpense,
    expensePayerLabel,
    expenseSplitLabel,
    expenseParticipantCount,
    expenseShare,
    expenseShareForMember,
  }
}
