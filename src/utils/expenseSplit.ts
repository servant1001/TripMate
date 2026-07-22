import type { Expense, ExpenseKind, ExpenseSplitMode } from '../types'

type ExpenseLike = Pick<Expense, 'amount' | 'payerId' | 'payerShares' | 'kind' | 'participantIds' | 'splitMode' | 'shares' | 'ratios' | 'splitUnits'>

export function participantsForExpense(expense: Pick<ExpenseLike, 'kind' | 'payerId' | 'participantIds'>, fallback: string[] = []): string[] {
  if (expense.kind === 'personal') return expense.payerId ? [expense.payerId] : []
  return expense.participantIds.length ? expense.participantIds : fallback
}

export function payerSharesForExpense(expense: Pick<ExpenseLike, 'amount' | 'payerId' | 'payerShares'>): Record<string, number> {
  const stored = Object.entries(expense.payerShares || {}).reduce<Record<string, number>>((result, [memberId, amount]) => {
    const value = Number(amount) || 0
    if (value > 0) result[memberId] = value
    return result
  }, {})
  return Object.keys(stored).length ? stored : expense.payerId ? { [expense.payerId]: Number(expense.amount) || 0 } : {}
}

export function splitShareForMember(expense: ExpenseLike, memberId: string, fallbackParticipants: string[] = []): number {
  const participants = participantsForExpense(expense, fallbackParticipants)
  if (!participants.includes(memberId)) return 0
  if (expense.kind === 'personal') return Number(expense.amount) || 0
  if (expense.splitMode === 'custom') return Number(expense.shares?.[memberId]) || 0
  if (expense.splitMode === 'ratio') {
    const total = participants.reduce((sum, id) => sum + Math.max(0, Number(expense.ratios?.[id]) || 0), 0)
    return total > 0 ? (Number(expense.amount) || 0) * Math.max(0, Number(expense.ratios?.[memberId]) || 0) / total : 0
  }
  if (expense.splitMode === 'shares') {
    const total = participants.reduce((sum, id) => sum + Math.max(0, Number(expense.splitUnits?.[id]) || 0), 0)
    return total > 0 ? (Number(expense.amount) || 0) * Math.max(0, Number(expense.splitUnits?.[memberId]) || 0) / total : 0
  }
  return participants.length ? (Number(expense.amount) || 0) / participants.length : 0
}

export function splitModeLabel(mode: ExpenseSplitMode | undefined): string {
  if (mode === 'custom') return '自訂金額'
  if (mode === 'ratio') return '比例分攤'
  if (mode === 'shares') return '份數分攤'
  return '平均分攤'
}

export function expenseKindParticipants(kind: ExpenseKind, payerId: string, selected: string[], fallback: string[]): string[] {
  return kind === 'personal' ? (payerId ? [payerId] : []) : selected.length ? selected : fallback
}
