export type Role = 'owner' | 'editor' | 'viewer'
export type ExpenseKind = 'personal' | 'shared'
export type ExpenseSplitMode = 'equal' | 'custom'
export type TodoScope = 'shared' | 'personal'
export type ItineraryActivityKind = 'shared' | 'free' | 'personal' | 'group'

export interface Member { id: string; name: string; email: string; role: Role; personalBudget?: number }
export interface Trip { id: string; name: string; country: string; city: string; startDate: string; endDate: string; currency: string; budget: number; coverUrl?: string; inviteCode: string; ownerId: string; members: Member[] }
export interface ItineraryItem { id: string; tripId: string; date: string; time: string; endTime?: string; title: string; location: string; mapUrl?: string; imageUrl?: string; note?: string; favoriteId?: string; transportDestinationFavoriteId?: string; transportDestinationName?: string; transportDestinationLocation?: string; transportDestinationMapUrl?: string; type: string; activityKind?: ItineraryActivityKind; parentFreeActivityId?: string; itineraryGroupId?: string; groupDuration?: number; ownerId?: string; order?: number; completed: boolean }
export interface Expense { id: string; tripId: string; title: string; amount: number; payerId: string; kind: ExpenseKind; participantIds: string[]; splitMode?: ExpenseSplitMode; shares?: Record<string, number>; category: string; date: string }
export interface TodoItem { id: string; tripId: string; title: string; scope?: TodoScope; assigneeId?: string; dueDate?: string; url?: string; note?: string; completed: boolean; createdAt: number }
export interface PackingItem { id: string; tripId: string; name: string; category: string; quantity: number; assignedTo?: string; isShared: boolean; order?: number; completed: boolean; note?: string; createdBy: string; createdAt: number }
export type BookingType = 'flight' | 'hotel' | 'transport' | 'ticket' | 'restaurant' | 'other'
export interface Booking { id: string; tripId: string; type: BookingType; title: string; startDate: string; endDate?: string; location?: string; bookingNumber?: string; bookedBy?: string; contact?: string; website?: string; note?: string; createdBy: string; createdAt: number }
export type FavoriteType = 'attraction' | 'restaurant' | 'transport' | 'stay' | 'shop' | 'cafe' | 'alternative' | 'other'
export interface Favorite { id: string; tripId: string; name: string; type: FavoriteType; location?: string; mapUrl?: string; website?: string; imageUrl?: string; estimatedCost?: number; recommendedBy?: string; note?: string; order?: number; addedToItinerary: boolean; createdBy: string; createdAt: number; updatedBy?: string; updatedAt?: number }
export interface AlbumPhoto { id: string; tripId: string; imageUrl: string; caption?: string; tripDate?: string; itineraryItemId?: string; uploadedBy: string; createdAt: number }
export type ShoppingType = 'personal' | 'proxy' | 'shared' | 'gift'
export type ShoppingPriority = 'low' | 'medium' | 'high'
export type ShoppingStatus = 'wishlist' | 'planned' | 'purchased' | 'unavailable' | 'cancelled'
export interface ShoppingItem { id: string; tripId: string; name: string; description?: string; shoppingType: ShoppingType; category: string; priority: ShoppingPriority; quantity: number; unit?: string; estimatedUnitPrice?: number; estimatedTotalPrice?: number; actualUnitPrice?: number; actualTotalPrice?: number; currency: string; requestedBy?: string; assignedTo?: string; giftRecipient?: string; storeName?: string; storeBranch?: string; location?: string; address?: string; mapUrl?: string; website?: string; imageUrl?: string; note?: string; status: ShoppingStatus; plannedDate?: string; itineraryItemId?: string; itineraryItemIds?: string[]; participantIds?: string[]; purchasedBy?: string; purchasedAt?: number; expenseId?: string; createdBy: string; createdAt: number; updatedAt: number }
export interface Settlement { id: string; tripId: string; fromId: string; toId: string; amount: number; date: string; createdAt: number }
