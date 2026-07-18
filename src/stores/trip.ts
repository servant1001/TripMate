import { defineStore } from 'pinia'
import type { Expense, ItineraryItem, Member, Trip } from '../types'
import { repository } from '../services/repository'

export const useTripStore = defineStore('trips', {
  state: () => ({ trips: [] as Trip[], itinerary: [] as ItineraryItem[], expenses: [] as Expense[], loading: false }),
  getters: { trip: (s) => (id: string) => s.trips.find((x) => x.id === id), items: (s) => (id: string) => s.itinerary.filter((x) => x.tripId === id), tripExpenses: (s) => (id: string) => s.expenses.filter((x) => x.tripId === id) },
  actions: {
    async load(userId?: string) { this.loading = true; try { Object.assign(this, await repository.getData(userId)) } finally { this.loading = false } },
    async createTrip(input: Omit<Trip, 'id' | 'inviteCode'>, userId?: string) { const trip = await repository.addTrip(input, userId); this.trips.push(trip); return trip },
    async updateTrip(trip: Trip) { await repository.updateTrip(trip); const index = this.trips.findIndex((item) => item.id === trip.id); if (index >= 0) this.trips.splice(index, 1, trip) },
    async deleteTrip(trip: Trip) { await repository.deleteTrip(trip); this.trips = this.trips.filter((item) => item.id !== trip.id); this.itinerary = this.itinerary.filter((item) => item.tripId !== trip.id); this.expenses = this.expenses.filter((item) => item.tripId !== trip.id) },
    async addMember(trip: Trip, member: Omit<Member, 'id'>) { const added = await repository.addMember(trip, member); trip.members.push(added) },
    async addItem(input: Omit<ItineraryItem, 'id' | 'completed'>) { const item = await repository.addItinerary(input); this.itinerary.push(item) },
    async updateItem(item: ItineraryItem) { await repository.updateItinerary(item); const index = this.itinerary.findIndex((entry) => entry.id === item.id); if (index >= 0) this.itinerary.splice(index, 1, item) },
    async reorderItems(items: ItineraryItem[]) { const previousOrders = new Map(this.itinerary.map((item) => [item.id, item.order])); items.forEach((item, order) => { item.order = order }); try { await repository.reorderItinerary(items) } catch (error) { this.itinerary.forEach((item) => { item.order = previousOrders.get(item.id) }); throw error } },
    async deleteItem(item: ItineraryItem) { await repository.deleteItinerary(item); this.itinerary = this.itinerary.filter((entry) => entry.id !== item.id) },
    async toggleItem(id: string) { const item = this.itinerary.find((x) => x.id === id); await repository.toggleItinerary(id, item); if (item) item.completed = !item.completed },
    async addExpense(input: Omit<Expense, 'id'>) { const expense = await repository.addExpense(input); this.expenses.push(expense) },
    async updateExpense(expense: Expense) { await repository.updateExpense(expense); const index = this.expenses.findIndex((item) => item.id === expense.id); if (index >= 0) this.expenses.splice(index, 1, expense) },
    async deleteExpense(expense: Expense) { await repository.deleteExpense(expense); this.expenses = this.expenses.filter((item) => item.id !== expense.id) },
  },
})
