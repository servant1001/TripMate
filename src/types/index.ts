export type Role = 'owner' | 'editor' | 'viewer'
export type ExpenseKind = 'personal' | 'shared'
export type ExpenseSplitMode = 'equal' | 'custom'

export interface Member { id: string; name: string; email: string; role: Role }
export interface Trip { id: string; name: string; country: string; city: string; startDate: string; endDate: string; currency: string; budget: number; coverUrl?: string; inviteCode: string; ownerId: string; members: Member[] }
export interface ItineraryItem { id: string; tripId: string; date: string; time: string; endTime?: string; title: string; location: string; type: string; order?: number; completed: boolean }
export interface Expense { id: string; tripId: string; title: string; amount: number; payerId: string; kind: ExpenseKind; participantIds: string[]; splitMode?: ExpenseSplitMode; shares?: Record<string, number>; category: string; date: string }
