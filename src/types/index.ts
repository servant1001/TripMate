export type Role = 'owner' | 'editor' | 'viewer'
export type ExpenseKind = 'personal' | 'shared'
export type ExpenseSplitMode = 'equal' | 'custom'
export type TodoScope = 'shared' | 'personal'

export interface Member { id: string; name: string; email: string; role: Role; personalBudget?: number }
export interface Trip { id: string; name: string; country: string; city: string; startDate: string; endDate: string; currency: string; budget: number; coverUrl?: string; inviteCode: string; ownerId: string; members: Member[] }
export interface ItineraryItem { id: string; tripId: string; date: string; time: string; endTime?: string; title: string; location: string; type: string; order?: number; completed: boolean }
export interface Expense { id: string; tripId: string; title: string; amount: number; payerId: string; kind: ExpenseKind; participantIds: string[]; splitMode?: ExpenseSplitMode; shares?: Record<string, number>; category: string; date: string }
export interface TodoItem { id: string; tripId: string; title: string; scope?: TodoScope; assigneeId?: string; dueDate?: string; completed: boolean; createdAt: number }
export interface PackingItem { id: string; tripId: string; name: string; category: string; quantity: number; assignedTo?: string; isShared: boolean; completed: boolean; note?: string; createdBy: string; createdAt: number }
export type BookingType = 'flight' | 'hotel' | 'transport' | 'ticket' | 'restaurant' | 'other'
export interface Booking { id: string; tripId: string; type: BookingType; title: string; startDate: string; endDate?: string; location?: string; bookingNumber?: string; bookedBy?: string; contact?: string; website?: string; note?: string; createdBy: string; createdAt: number }
export type FavoriteType = 'attraction' | 'restaurant' | 'shop' | 'cafe' | 'stay' | 'alternative' | 'other'
export interface Favorite { id: string; tripId: string; name: string; type: FavoriteType; location?: string; website?: string; imageUrl?: string; estimatedCost?: number; recommendedBy?: string; note?: string; addedToItinerary: boolean; createdBy: string; createdAt: number }
export interface Settlement { id: string; tripId: string; fromId: string; toId: string; amount: number; date: string; createdAt: number }
