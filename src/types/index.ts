export type Role = 'owner' | 'editor' | 'viewer'
export type ExpenseKind = 'personal' | 'shared'

export interface Member { id: string; name: string; email: string; role: Role }
export interface Trip { id: string; name: string; country: string; city: string; startDate: string; endDate: string; currency: string; budget: number; coverUrl?: string; inviteCode: string; ownerId: string; members: Member[] }
export interface ItineraryItem { id: string; tripId: string; date: string; time: string; title: string; location: string; type: string; completed: boolean }
export interface Expense { id: string; tripId: string; title: string; amount: number; payerId: string; kind: ExpenseKind; participantIds: string[]; category: string; date: string }
