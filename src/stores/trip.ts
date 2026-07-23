import { defineStore } from "pinia";
import type {
  AlbumPhoto,
  Booking,
  Expense,
  Favorite,
  ItineraryItem,
  Member,
  PackingItem,
  Settlement,
  ShoppingItem,
  TodoItem,
  TravelInsurance,
  InsuranceStatusSummary,
  PaymentTool,
  PaymentToolSummary,
  PaymentTransaction,
  RewardRule,
  StoredValueBalance,
  Trip,
} from "../types";
import { repository } from "../services/repository";

export const useTripStore = defineStore("trips", {
  state: () => ({
    trips: [] as Trip[],
    itinerary: [] as ItineraryItem[],
    expenses: [] as Expense[],
    settlements: [] as Settlement[],
    todos: [] as TodoItem[],
    packingItems: [] as PackingItem[],
    bookings: [] as Booking[],
    favorites: [] as Favorite[],
    albumPhotos: [] as AlbumPhoto[],
    shoppingItems: [] as ShoppingItem[],
    categoryBudgets: {} as Record<string, Record<string, number>>,
    dailyBudgets: {} as Record<string, number>,
    insurances: [] as TravelInsurance[],
    insuranceStatuses: {} as Record<string, Record<string, InsuranceStatusSummary>>,
    paymentTools: [] as PaymentTool[], paymentToolSummaries: [] as PaymentToolSummary[], rewardRules: [] as RewardRule[], paymentTransactions: [] as PaymentTransaction[], storedValueBalances: [] as StoredValueBalance[],
    loading: false,
  }),
  getters: {
    trip: (s) => (id: string) => s.trips.find((x) => x.id === id),
    items: (s) => (id: string) => s.itinerary.filter((x) => x.tripId === id),
    tripExpenses: (s) => (id: string) =>
      s.expenses.filter((x) => x.tripId === id),
    tripSettlements: (s) => (id: string) =>
      s.settlements.filter((x) => x.tripId === id),
    tripTodos: (s) => (id: string) => s.todos.filter((x) => x.tripId === id),
    tripPackingItems: (s) => (id: string) =>
      s.packingItems.filter((x) => x.tripId === id),
    tripBookings: (s) => (id: string) =>
      s.bookings.filter((x) => x.tripId === id),
    tripFavorites: (s) => (id: string) =>
      s.favorites.filter((x) => x.tripId === id),
    tripAlbumPhotos: (s) => (id: string) =>
      s.albumPhotos.filter((x) => x.tripId === id),
    tripShoppingItems: (s) => (id: string) =>
      s.shoppingItems.filter((x) => x.tripId === id),
    tripCategoryBudgets: (s) => (id: string) => s.categoryBudgets[id] || {},
    tripDailyBudget: (s) => (id: string) => s.dailyBudgets[id] || 0,
    tripInsurances: (s) => (id: string) => s.insurances.filter((item) => item.tripId === id),
    tripInsuranceStatuses: (s) => (id: string) => s.insuranceStatuses[id] || {},
    tripPaymentTools: (s) => (id: string) => s.paymentTools.filter((item) => item.tripId === id),
    tripPaymentToolSummaries: (s) => (id: string) => s.paymentToolSummaries.filter((item) => item.tripId === id),
    tripRewardRules: (s) => (id: string) => s.rewardRules.filter((item) => item.tripId === id),
    tripPaymentTransactions: (s) => (id: string) => s.paymentTransactions.filter((item) => item.tripId === id),
    tripStoredValueBalances: (s) => (id: string) => s.storedValueBalances.filter((item) => item.tripId === id),
  },
  actions: {
    async load(userId?: string) {
      this.loading = true;
      try {
        const data = await repository.getData(userId);
        if (userId)
          data.itinerary.push(
            ...(await repository.getPrivateItinerary(
              data.trips.map((trip) => trip.id),
              userId,
            )),
          );
        Object.assign(this, data);
      } finally {
        this.loading = false;
      }
    },
    async createTrip(input: Omit<Trip, "id" | "inviteCode">, userId?: string) {
      const trip = await repository.addTrip(input, userId);
      this.trips.push(trip);
      return trip;
    },
    async updateTrip(trip: Trip) {
      await repository.updateTrip(trip);
      const index = this.trips.findIndex((item) => item.id === trip.id);
      if (index >= 0) this.trips.splice(index, 1, trip);
    },
    async deleteTrip(trip: Trip) {
      await repository.deleteTrip(trip);
      this.trips = this.trips.filter((item) => item.id !== trip.id);
      this.itinerary = this.itinerary.filter((item) => item.tripId !== trip.id);
      this.expenses = this.expenses.filter((item) => item.tripId !== trip.id);
      this.settlements = this.settlements.filter(
        (item) => item.tripId !== trip.id,
      );
      this.todos = this.todos.filter((item) => item.tripId !== trip.id);
      this.packingItems = this.packingItems.filter(
        (item) => item.tripId !== trip.id,
      );
      this.bookings = this.bookings.filter((item) => item.tripId !== trip.id);
      this.favorites = this.favorites.filter((item) => item.tripId !== trip.id);
      this.albumPhotos = this.albumPhotos.filter(
        (item) => item.tripId !== trip.id,
      );
      this.shoppingItems = this.shoppingItems.filter(
        (item) => item.tripId !== trip.id,
      );
      delete this.categoryBudgets[trip.id];
      delete this.dailyBudgets[trip.id];
      this.insurances = this.insurances.filter((item) => item.tripId !== trip.id);
      delete this.insuranceStatuses[trip.id];
      this.paymentTools = this.paymentTools.filter((item) => item.tripId !== trip.id); this.rewardRules = this.rewardRules.filter((item) => item.tripId !== trip.id); this.paymentTransactions = this.paymentTransactions.filter((item) => item.tripId !== trip.id); this.storedValueBalances = this.storedValueBalances.filter((item) => item.tripId !== trip.id);
    },
    async addMember(trip: Trip, member: Omit<Member, "id">) {
      const added = await repository.addMember(trip, member);
      trip.members.push(added);
    },
    async removeMember(trip: Trip, memberId: string) {
      await repository.removeMember(trip, memberId);
      const index = trip.members.findIndex((member) => member.id === memberId);
      if (index >= 0) trip.members.splice(index, 1);
    },
    async updatePersonalBudget(
      tripId: string,
      memberId: string,
      personalBudget: number,
    ) {
      const trip = this.trip(tripId);
      if (!trip) return;
      await repository.updatePersonalBudget(trip, memberId, personalBudget);
      const member = trip.members.find((entry) => entry.id === memberId);
      if (member)
        member.personalBudget = Math.max(0, Number(personalBudget) || 0);
    },
    async updateCategoryBudgets(
      tripId: string,
      categoryBudgets: Record<string, number>,
    ) {
      const trip = this.trip(tripId);
      if (!trip) return;
      await repository.updateCategoryBudgets(trip, categoryBudgets);
      this.categoryBudgets[tripId] = Object.fromEntries(
        Object.entries(categoryBudgets)
          .map(([category, amount]) => [
            category,
            Math.max(0, Number(amount) || 0),
          ])
          .filter(([, amount]) => Number(amount) > 0),
      );
    },
    async updateDailyBudget(tripId: string, dailyBudget: number) {
      const trip = this.trip(tripId);
      if (!trip) return;
      const budget = Math.max(0, Number(dailyBudget) || 0);
      await repository.updateDailyBudget(trip, budget);
      this.dailyBudgets[tripId] = budget;
    },
    async addTodo(input: Omit<TodoItem, "id" | "completed" | "createdAt">) {
      const todo = await repository.addTodo(input);
      this.todos.push(todo);
    },
    async updateTodo(todo: TodoItem) {
      await repository.updateTodo(todo);
      const index = this.todos.findIndex((item) => item.id === todo.id);
      if (index >= 0) this.todos.splice(index, 1, todo);
    },
    async toggleTodo(todo: TodoItem) {
      await repository.toggleTodo(todo);
      todo.completed = !todo.completed;
    },
    async deleteTodo(todo: TodoItem) {
      await repository.deleteTodo(todo);
      this.todos = this.todos.filter((item) => item.id !== todo.id);
    },
    async addPackingItem(
      input: Omit<PackingItem, "id" | "completed" | "createdAt">,
    ) {
      const item = await repository.addPackingItem(input);
      this.packingItems.push(item);
    },
    async updatePackingItem(item: PackingItem) {
      await repository.updatePackingItem(item);
      const index = this.packingItems.findIndex(
        (entry) => entry.id === item.id,
      );
      if (index >= 0) this.packingItems.splice(index, 1, item);
    },
    async reorderPackingItems(items: PackingItem[]) {
      const previousOrders = new Map(
        this.packingItems.map((item) => [item.id, item.order]),
      );
      items.forEach((item, order) => {
        item.order = order;
      });
      try {
        await repository.reorderPackingItems(items);
      } catch (error) {
        this.packingItems.forEach((item) => {
          item.order = previousOrders.get(item.id);
        });
        throw error;
      }
    },
    async togglePackingItem(item: PackingItem) {
      await repository.togglePackingItem(item);
      item.completed = !item.completed;
    },
    async deletePackingItem(item: PackingItem) {
      await repository.deletePackingItem(item);
      this.packingItems = this.packingItems.filter(
        (entry) => entry.id !== item.id,
      );
    },
    async addBooking(input: Omit<Booking, "id" | "createdAt">) {
      const booking = await repository.addBooking(input);
      this.bookings.push(booking);
    },
    async updateBooking(booking: Booking) {
      await repository.updateBooking(booking);
      const index = this.bookings.findIndex((entry) => entry.id === booking.id);
      if (index >= 0) this.bookings.splice(index, 1, booking);
    },
    async deleteBooking(booking: Booking) {
      await repository.deleteBooking(booking);
      this.bookings = this.bookings.filter((entry) => entry.id !== booking.id);
    },
    async addFavorite(
      input: Omit<Favorite, "id" | "createdAt" | "addedToItinerary">,
    ) {
      const favorite = await repository.addFavorite(input);
      this.favorites.push(favorite);
    },
    async updateFavorite(favorite: Favorite) {
      await repository.updateFavorite(favorite);
      const index = this.favorites.findIndex(
        (entry) => entry.id === favorite.id,
      );
      if (index >= 0) this.favorites.splice(index, 1, favorite);
    },
    async reorderFavorites(favorites: Favorite[]) {
      const previousOrders = new Map(
        this.favorites.map((favorite) => [favorite.id, favorite.order]),
      );
      favorites.forEach((favorite, order) => {
        favorite.order = order;
      });
      try {
        await repository.reorderFavorites(favorites);
      } catch (error) {
        this.favorites.forEach((favorite) => {
          favorite.order = previousOrders.get(favorite.id);
        });
        throw error;
      }
    },
    async deleteFavorite(favorite: Favorite) {
      await repository.deleteFavorite(favorite);
      this.favorites = this.favorites.filter(
        (entry) => entry.id !== favorite.id,
      );
    },
    async addAlbumPhoto(input: Omit<AlbumPhoto, "id" | "createdAt">) {
      const photo = await repository.addAlbumPhoto(input);
      this.albumPhotos.push(photo);
    },
    async updateAlbumPhoto(photo: AlbumPhoto) {
      await repository.updateAlbumPhoto(photo);
      const index = this.albumPhotos.findIndex(
        (entry) => entry.id === photo.id,
      );
      if (index >= 0) this.albumPhotos.splice(index, 1, photo);
    },
    async deleteAlbumPhoto(photo: AlbumPhoto) {
      await repository.deleteAlbumPhoto(photo);
      this.albumPhotos = this.albumPhotos.filter(
        (entry) => entry.id !== photo.id,
      );
    },
    async addShoppingItem(
      input: Omit<ShoppingItem, "id" | "createdAt" | "updatedAt">,
    ) {
      const item = await repository.addShoppingItem(input);
      this.shoppingItems.push(item);
      return item;
    },
    async updateShoppingItem(item: ShoppingItem) {
      const updated = await repository.updateShoppingItem(item);
      const index = this.shoppingItems.findIndex(
        (entry) => entry.id === item.id,
      );
      if (index >= 0) this.shoppingItems.splice(index, 1, updated);
      return updated;
    },
    async deleteShoppingItem(item: ShoppingItem) {
      await repository.deleteShoppingItem(item);
      this.shoppingItems = this.shoppingItems.filter(
        (entry) => entry.id !== item.id,
      );
    },
    async addItem(input: Omit<ItineraryItem, "id" | "completed">) {
      const item = await repository.addItinerary(input);
      this.itinerary.push(item);
      return item;
    },
    async updateItem(item: ItineraryItem) {
      await repository.updateItinerary(item);
      const index = this.itinerary.findIndex((entry) => entry.id === item.id);
      if (index >= 0) this.itinerary.splice(index, 1, item);
    },
    async moveItem(item: ItineraryItem, previous: ItineraryItem) {
      await repository.moveItinerary(item, previous);
      const index = this.itinerary.findIndex((entry) => entry.id === item.id);
      if (index >= 0) this.itinerary.splice(index, 1, item);
    },
    async reorderItems(items: ItineraryItem[]) {
      const previousOrders = new Map(
        this.itinerary.map((item) => [item.id, item.order]),
      );
      items.forEach((item, order) => {
        item.order = order;
      });
      try {
        await repository.reorderItinerary(items);
      } catch (error) {
        this.itinerary.forEach((item) => {
          item.order = previousOrders.get(item.id);
        });
        throw error;
      }
    },
    async deleteItem(item: ItineraryItem) {
      await repository.deleteItinerary(item);
      this.itinerary = this.itinerary.filter((entry) => entry.id !== item.id);
    },
    async toggleItem(id: string) {
      const item = this.itinerary.find((x) => x.id === id);
      await repository.toggleItinerary(id, item);
      if (item) item.completed = !item.completed;
    },
    async addExpense(input: Omit<Expense, "id">) {
      const expense = await repository.addExpense(input);
      this.expenses.push(expense);
      return expense;
    },
    async updateExpense(expense: Expense) {
      await repository.updateExpense(expense);
      const index = this.expenses.findIndex((item) => item.id === expense.id);
      if (index >= 0) this.expenses.splice(index, 1, expense);
    },
    async deleteExpense(expense: Expense) {
      await repository.deleteExpense(expense);
      this.expenses = this.expenses.filter((item) => item.id !== expense.id);
    },
    async addSettlement(input: Omit<Settlement, "id">) {
      const settlement = await repository.addSettlement(input);
      this.settlements.push(settlement);
    },
    async deleteSettlement(settlement: Settlement) {
      await repository.deleteSettlement(settlement);
      this.settlements = this.settlements.filter(
        (item) => item.id !== settlement.id,
      );
    },
    async saveInsurance(input: Omit<TravelInsurance, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<TravelInsurance, 'createdAt'>>, statusSummary?: Pick<InsuranceStatusSummary, 'status' | 'coverageStatus'>) {
      const saved = await repository.saveInsurance(input, statusSummary);
      const index = this.insurances.findIndex((item) => item.tripId === saved.tripId && item.userId === saved.userId);
      if (index >= 0) this.insurances.splice(index, 1, saved); else this.insurances.push(saved);
      const status = statusSummary?.status || (saved.status === 'active' ? 'covered' : saved.status === 'cancelled' ? 'cancelled' : saved.status === 'expired' ? 'expired' : 'draft');
      this.insuranceStatuses[saved.tripId] = { ...(this.insuranceStatuses[saved.tripId] || {}), [saved.userId]: { userId: saved.userId, status, coverageStatus: statusSummary?.coverageStatus, providerName: saved.visibility === 'private' ? undefined : saved.providerName, visibility: saved.visibility, updatedAt: saved.updatedAt } };
      return saved;
    },
    async deleteInsurance(insurance: TravelInsurance) {
      await repository.deleteInsurance(insurance);
      this.insurances = this.insurances.filter((item) => !(item.tripId === insurance.tripId && item.userId === insurance.userId));
      if (this.insuranceStatuses[insurance.tripId]) delete this.insuranceStatuses[insurance.tripId][insurance.userId];
    },
    async savePaymentTool(input: Omit<PaymentTool, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<PaymentTool, 'id' | 'createdAt'>>) { const tool = await repository.savePaymentTool(input); const index = this.paymentTools.findIndex((item) => item.id === tool.id); if (index >= 0) this.paymentTools.splice(index, 1, tool); else this.paymentTools.push(tool); return tool },
    async deletePaymentTool(tool: PaymentTool) { await repository.deletePaymentTool(tool); this.paymentTools = this.paymentTools.filter((item) => item.id !== tool.id); this.rewardRules = this.rewardRules.filter((item) => item.paymentToolId !== tool.id); this.storedValueBalances = this.storedValueBalances.filter((item) => item.paymentToolId !== tool.id) },
    async saveRewardRule(input: Omit<RewardRule, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<RewardRule, 'id' | 'createdAt'>>) { const rule = await repository.saveRewardRule(input); const index = this.rewardRules.findIndex((item) => item.id === rule.id); if (index >= 0) this.rewardRules.splice(index, 1, rule); else this.rewardRules.push(rule); return rule },
    async deleteRewardRule(rule: RewardRule) { await repository.deleteRewardRule(rule); this.rewardRules = this.rewardRules.filter((item) => item.id !== rule.id) },
    async savePaymentTransaction(input: Omit<PaymentTransaction, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<PaymentTransaction, 'id' | 'createdAt'>>) { const transaction = await repository.savePaymentTransaction(input); const index = this.paymentTransactions.findIndex((item) => item.id === transaction.id); if (index >= 0) this.paymentTransactions.splice(index, 1, transaction); else this.paymentTransactions.push(transaction); return transaction },
    async deletePaymentTransaction(transaction: PaymentTransaction) { await repository.deletePaymentTransaction(transaction); this.paymentTransactions = this.paymentTransactions.filter((item) => item.id !== transaction.id) },
    async saveStoredValueBalance(balance: StoredValueBalance) { await repository.saveStoredValueBalance(balance); const index = this.storedValueBalances.findIndex((item) => item.tripId === balance.tripId && item.paymentToolId === balance.paymentToolId); if (index >= 0) this.storedValueBalances.splice(index, 1, balance); else this.storedValueBalances.push(balance) },
  },
});
