import type { Expense, ItineraryItem, Settlement, Trip } from '../types'
import { database, firebaseEnabled } from './firebase'
import { get, ref, set, update } from 'firebase/database'

const key = 'tripmate-data-v1'
type Data = { trips: Trip[]; itinerary: ItineraryItem[]; expenses: Expense[]; settlements: Settlement[] }
const seed: Data = { trips: [], itinerary: [], expenses: [], settlements: [] }
const read = (): Data => ({ ...seed, ...(JSON.parse(localStorage.getItem(key) || JSON.stringify(seed)) as Partial<Data>) })
const write = (data: Data) => localStorage.setItem(key, JSON.stringify(data))
const id = () => crypto.randomUUID()

export const repository = {
  async getData(userId?: string) {
    const db = database; if (!firebaseEnabled || !db || !userId) return read()
    const tripIndex = (await get(ref(db, `userTrips/${userId}`))).val() as Record<string, boolean> | null
    const ids = Object.keys(tripIndex || {})
    const tripRows = await Promise.all(ids.map(async (tripId) => {
      const [tripSnapshot, membersSnapshot, itinerarySnapshot, expensesSnapshot, settlementsSnapshot] = await Promise.all([
        get(ref(db, `trips/${tripId}`)), get(ref(db, `tripMembers/${tripId}`)),
        get(ref(db, `itineraryItems/${tripId}`)), get(ref(db, `expenses/${tripId}`)), get(ref(db, `settlements/${tripId}`)),
      ])
      const trip = tripSnapshot.val() as Omit<Trip, 'members'> | null
      if (!trip) return null
      return { trip: { ...trip, id: tripId, members: Object.entries(membersSnapshot.val() || {}).map(([id, value]) => ({ id, ...(value as Omit<Trip['members'][number], 'id'>) })) }, itinerary: Object.entries(itinerarySnapshot.val() || {}).map(([id, value]) => ({ id, ...(value as Omit<ItineraryItem, 'id'>) })), expenses: Object.entries(expensesSnapshot.val() || {}).map(([id, value]) => ({ id, ...(value as Omit<Expense, 'id'>) })), settlements: Object.entries(settlementsSnapshot.val() || {}).map(([id, value]) => ({ id, ...(value as Omit<Settlement, 'id'>) })) }
    }))
    return tripRows.filter((row): row is NonNullable<typeof row> => Boolean(row)).reduce<Data>((data, row) => ({ trips: [...data.trips, row.trip], itinerary: [...data.itinerary, ...row.itinerary], expenses: [...data.expenses, ...row.expenses], settlements: [...data.settlements, ...row.settlements] }), seed)
  },
  async addTrip(input: Omit<Trip, 'id' | 'inviteCode'>, userId?: string) {
    const trip = { ...input, id: id(), inviteCode: Math.random().toString(36).slice(2, 8).toUpperCase() }
    const db = database; if (firebaseEnabled && db && userId) { const { members, ...tripData } = trip; const updates: Record<string, unknown> = { [`trips/${trip.id}`]: tripData, [`tripInvites/${trip.inviteCode}`]: { tripId: trip.id, createdBy: userId, role: 'editor', enabled: true, usedCount: 0, maxUses: 20, createdAt: Date.now() }, [`userTrips/${userId}/${trip.id}`]: true }; members.forEach((member) => { updates[`tripMembers/${trip.id}/${member.id}`] = { name: member.name, email: member.email, role: member.role }; updates[`userTrips/${member.id}/${trip.id}`] = true }); await update(ref(db), updates); return trip }
    const d = read(); d.trips.push(trip); write(d); return trip
  },
  async updateTrip(trip: Trip) { const db = database; if (firebaseEnabled && db) { const { members, id: tripId, ...data } = trip; await set(ref(db, `trips/${tripId}`), data); await set(ref(db, `tripMembers/${tripId}`), Object.fromEntries(members.map(({ id, ...member }) => [id, member]))); return } const d = read(); d.trips = d.trips.map((x) => x.id === trip.id ? trip : x); write(d) },
  async deleteTrip(trip: Trip) { const db = database; if (firebaseEnabled && db) { const updates: Record<string, null> = { [`trips/${trip.id}`]: null, [`tripMembers/${trip.id}`]: null, [`itineraryItems/${trip.id}`]: null, [`expenses/${trip.id}`]: null, [`settlements/${trip.id}`]: null, [`tripInvites/${trip.inviteCode}`]: null }; trip.members.forEach((member) => { updates[`userTrips/${member.id}/${trip.id}`] = null }); await update(ref(db), updates); return } const d = read(); d.trips = d.trips.filter((x) => x.id !== trip.id); d.itinerary = d.itinerary.filter((x) => x.tripId !== trip.id); d.expenses = d.expenses.filter((x) => x.tripId !== trip.id); d.settlements = d.settlements.filter((x) => x.tripId !== trip.id); write(d) },
  async addMember(trip: Trip, member: Omit<Trip['members'][number], 'id'>) {
    const db = database; if (firebaseEnabled && db) { const emailKey = member.email.toLowerCase().replace(/[.#$\[\]/]/g, '_'); const memberId = (await get(ref(db, `emailIndex/${emailKey}`))).val() as string | null; if (!memberId) throw new Error('這位旅伴尚未登入 TripMate，請請對方先完成登入後再邀請。'); await update(ref(db), { [`tripMembers/${trip.id}/${memberId}`]: member, [`userTrips/${memberId}/${trip.id}`]: true }); return { id: memberId, ...member } }
    const result = { id: id(), ...member }; trip.members.push(result); await this.updateTrip(trip); return result
  },
  async addItinerary(input: Omit<ItineraryItem, 'id' | 'completed'>) { const item = { ...input, id: id(), completed: false }; const db = database; if (firebaseEnabled && db) { const { id: itemId, ...data } = item; await set(ref(db, `itineraryItems/${item.tripId}/${itemId}`), data); return item } const d = read(); d.itinerary.push(item); write(d); return item },
  async updateItinerary(item: ItineraryItem) { const db = database; if (firebaseEnabled && db) { const { id: itemId, tripId, ...data } = item; await set(ref(db, `itineraryItems/${tripId}/${itemId}`), data); return } const d = read(); d.itinerary = d.itinerary.map((entry) => entry.id === item.id ? item : entry); write(d) },
  async reorderItinerary(items: ItineraryItem[]) { if (!items.length) return; const db = database; if (firebaseEnabled && db) { const updates: Record<string, number> = {}; items.forEach((item, order) => { updates[`itineraryItems/${item.tripId}/${item.id}/order`] = order }); await update(ref(db), updates); return } const orders = new Map(items.map((item, order) => [item.id, order])); const d = read(); d.itinerary = d.itinerary.map((item) => orders.has(item.id) ? { ...item, order: orders.get(item.id) } : item); write(d) },
  async deleteItinerary(item: ItineraryItem) { const db = database; if (firebaseEnabled && db) { await set(ref(db, `itineraryItems/${item.tripId}/${item.id}`), null); return } const d = read(); d.itinerary = d.itinerary.filter((entry) => entry.id !== item.id); write(d) },
  async toggleItinerary(itemId: string, item?: ItineraryItem) { const db = database; if (firebaseEnabled && db && item) { await update(ref(db, `itineraryItems/${item.tripId}/${itemId}`), { completed: !item.completed }); return } const d = read(); const target = d.itinerary.find((x) => x.id === itemId); if (target) target.completed = !target.completed; write(d) },
  async addExpense(input: Omit<Expense, 'id'>) { const expense = { ...input, id: id() }; const db = database; if (firebaseEnabled && db) { const { id: expenseId, ...data } = expense; await set(ref(db, `expenses/${expense.tripId}/${expenseId}`), data); return expense } const d = read(); d.expenses.push(expense); write(d); return expense },
  async updateExpense(expense: Expense) { const db = database; if (firebaseEnabled && db) { const { id: expenseId, tripId, ...data } = expense; await set(ref(db, `expenses/${tripId}/${expenseId}`), data); return } const d = read(); d.expenses = d.expenses.map((item) => item.id === expense.id ? expense : item); write(d) },
  async deleteExpense(expense: Expense) { const db = database; if (firebaseEnabled && db) { await set(ref(db, `expenses/${expense.tripId}/${expense.id}`), null); return } const d = read(); d.expenses = d.expenses.filter((item) => item.id !== expense.id); write(d) },
  async addSettlement(input: Omit<Settlement, 'id'>) { const settlement = { ...input, id: id() }; const db = database; if (firebaseEnabled && db) { const { id: settlementId, ...data } = settlement; await set(ref(db, `settlements/${settlement.tripId}/${settlementId}`), data); return settlement } const d = read(); d.settlements.push(settlement); write(d); return settlement },
  async deleteSettlement(settlement: Settlement) { const db = database; if (firebaseEnabled && db) { await set(ref(db, `settlements/${settlement.tripId}/${settlement.id}`), null); return } const d = read(); d.settlements = d.settlements.filter((item) => item.id !== settlement.id); write(d) },
}
