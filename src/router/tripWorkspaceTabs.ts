export type TripTab =
  | 'overview'
  | 'itinerary'
  | 'map'
  | 'expenses'
  | 'todos'
  | 'packing'
  | 'bookings'
  | 'favorites'
  | 'album'
  | 'shopping'
  | 'insurance'
  | 'payments'
  | 'members'

export const tripTabLabels: Record<TripTab, string> = {
  overview: '總覽',
  itinerary: '行程',
  map: '地圖',
  expenses: '開銷',
  todos: '待辦',
  packing: '行李',
  bookings: '預訂',
  favorites: '收藏',
  album: '相簿',
  shopping: '購物',
  insurance: '保險',
  payments: '支付與回饋',
  members: '旅伴與結算',
}

export const tripTabOptions: TripTab[] = [
  'overview',
  'itinerary',
  'expenses',
  'todos',
  'favorites',
  'shopping',
  'payments',
  'packing',
  'bookings',
  'insurance',
  'album',
  'map',
  'members',
]

export const tripTabRouteNames: Record<TripTab, string> = {
  overview: 'trip-overview',
  itinerary: 'trip-itinerary',
  map: 'trip-map',
  expenses: 'trip-expenses',
  todos: 'trip-todos',
  packing: 'trip-packing',
  bookings: 'trip-bookings',
  favorites: 'trip-favorites',
  album: 'trip-album',
  shopping: 'trip-shopping',
  insurance: 'trip-insurance',
  payments: 'trip-payments',
  members: 'trip-members',
}

export function tripTabFromRouteName(name: string | null | undefined): TripTab {
  const normalized = String(name || '')
  const match = (Object.entries(tripTabRouteNames) as [TripTab, string][])
    .find(([, routeName]) => routeName === normalized)
  return match?.[0] || 'overview'
}
