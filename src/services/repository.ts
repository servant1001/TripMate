import type {
  AlbumPhoto,
  Booking,
  Expense,
  Favorite,
  ItineraryItem,
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
import { database, firebaseEnabled } from "./firebase";
import { get, ref, set, update } from "firebase/database";

const key = "tripmate-data-v1";
type Data = {
  trips: Trip[];
  itinerary: ItineraryItem[];
  expenses: Expense[];
  settlements: Settlement[];
  todos: TodoItem[];
  packingItems: PackingItem[];
  bookings: Booking[];
  favorites: Favorite[];
  albumPhotos: AlbumPhoto[];
  shoppingItems: ShoppingItem[];
  categoryBudgets: Record<string, Record<string, number>>;
  dailyBudgets: Record<string, number>;
  insurances: TravelInsurance[];
  insuranceStatuses: Record<string, Record<string, InsuranceStatusSummary>>;
  paymentTools: PaymentTool[];
  paymentToolSummaries: PaymentToolSummary[];
  rewardRules: RewardRule[];
  paymentTransactions: PaymentTransaction[];
  storedValueBalances: StoredValueBalance[];
};
const seed: Data = {
  trips: [],
  itinerary: [],
  expenses: [],
  settlements: [],
  todos: [],
  packingItems: [],
  bookings: [],
  favorites: [],
  albumPhotos: [],
  shoppingItems: [],
  categoryBudgets: {},
  dailyBudgets: {},
  insurances: [],
  insuranceStatuses: {},
  paymentTools: [], paymentToolSummaries: [], rewardRules: [], paymentTransactions: [], storedValueBalances: [],
};
const read = (): Data => ({
  ...seed,
  ...(JSON.parse(
    localStorage.getItem(key) || JSON.stringify(seed),
  ) as Partial<Data>),
});
const write = (data: Data) => localStorage.setItem(key, JSON.stringify(data));
const id = () => crypto.randomUUID();
const withoutUndefined = (data: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined),
  );

export const repository = {
  async getData(userId?: string) {
    const db = database;
    if (!firebaseEnabled || !db || !userId) return read();
    const tripIndex = (
      await get(ref(db, `userTrips/${userId}`))
    ).val() as Record<string, boolean> | null;
    const ids = Object.keys(tripIndex || {});
    const tripRows = await Promise.all(
      ids.map(async (tripId) => {
        const [
          tripSnapshot,
          membersSnapshot,
          itinerarySnapshot,
          expensesSnapshot,
          settlementsSnapshot,
          todosSnapshot,
          packingSnapshot,
          bookingsSnapshot,
          favoritesSnapshot,
          albumSnapshot,
          shoppingSnapshot,
          personalBudgetSnapshot,
          categoryBudgetsSnapshot,
          dailyBudgetSnapshot,
          insuranceSnapshot,
          insuranceStatusSnapshot,
          paymentToolsSnapshot, paymentSummariesSnapshot, rewardRulesSnapshot, paymentTransactionsSnapshot, storedValueSnapshot,
        ] = await Promise.all([
          get(ref(db, `trips/${tripId}`)),
          get(ref(db, `tripMembers/${tripId}`)),
          get(ref(db, `itineraryItems/${tripId}`)),
          get(ref(db, `expenses/${tripId}`)),
          get(ref(db, `settlements/${tripId}`)),
          get(ref(db, `todos/${tripId}`)),
          get(ref(db, `packingItems/${tripId}`)),
          get(ref(db, `bookings/${tripId}`)),
          get(ref(db, `favorites/${tripId}`)),
          get(ref(db, `albums/${tripId}`)),
          get(ref(db, `shoppingItems/${tripId}`)),
          get(ref(db, `tripMemberBudgets/${tripId}/${userId}`)),
          get(ref(db, `budgets/${tripId}/categories`)),
          get(ref(db, `budgets/${tripId}/daily`)),
          get(ref(db, `travelInsurances/${tripId}/${userId}`)),
          get(ref(db, `insuranceStatuses/${tripId}`)),
          get(ref(db, `paymentTools/${tripId}/${userId}`)), get(ref(db, `paymentToolSummaries/${tripId}`)), get(ref(db, `rewardRules/${tripId}/${userId}`)), get(ref(db, `paymentTransactions/${tripId}/${userId}`)), get(ref(db, `storedValueBalances/${tripId}/${userId}`)),
        ]);
        const trip = tripSnapshot.val() as Omit<Trip, "members"> | null;
        if (!trip) return null;
        const personalBudget = Number(personalBudgetSnapshot.val()) || 0;
        // Child records are keyed below their trip in Realtime Database.  Older records
        // were saved without a duplicated tripId field, so recover it from that path
        // while loading instead of filtering those records out in the store.
        return {
          trip: {
            ...trip,
            id: tripId,
            members: Object.entries(membersSnapshot.val() || {}).map(
              ([id, value]) => ({
                id,
                ...(value as Omit<Trip["members"][number], "id">),
                personalBudget: id === userId ? personalBudget : 0,
              }),
            ),
          },
          itinerary: Object.entries(itinerarySnapshot.val() || {}).map(
            ([id, value]) => ({
              id,
              ...(value as Omit<ItineraryItem, "id">),
              tripId,
            }),
          ),
          expenses: Object.entries(expensesSnapshot.val() || {}).map(
            ([id, value]) => ({
              id,
              ...(value as Omit<Expense, "id">),
              tripId,
            }),
          ),
          settlements: Object.entries(settlementsSnapshot.val() || {}).map(
            ([id, value]) => ({
              id,
              ...(value as Omit<Settlement, "id">),
              tripId,
            }),
          ),
          todos: Object.entries(todosSnapshot.val() || {}).map(
            ([id, value]) => ({
              id,
              scope: (value as TodoItem).scope || "shared",
              ...(value as Omit<TodoItem, "id" | "tripId">),
              tripId,
            }),
          ),
          packingItems: Object.entries(packingSnapshot.val() || {}).map(
            ([id, value]) => ({
              id,
              ...(value as Omit<PackingItem, "id" | "tripId">),
              tripId,
            }),
          ),
          bookings: Object.entries(bookingsSnapshot.val() || {}).map(
            ([id, value]) => ({
              id,
              ...(value as Omit<Booking, "id" | "tripId">),
              tripId,
            }),
          ),
          favorites: Object.entries(favoritesSnapshot.val() || {}).map(
            ([id, value]) => ({
              id,
              ...(value as Omit<Favorite, "id" | "tripId">),
              tripId,
              addedToItinerary: Boolean((value as Favorite).addedToItinerary),
            }),
          ),
          albumPhotos: Object.entries(albumSnapshot.val() || {}).map(
            ([id, value]) => ({
              id,
              ...(value as Omit<AlbumPhoto, "id" | "tripId">),
              tripId,
            }),
          ),
          shoppingItems: Object.entries(shoppingSnapshot.val() || {}).map(
            ([id, value]) => ({
              id,
              ...(value as Omit<ShoppingItem, "id" | "tripId">),
              tripId,
            }),
          ),
          categoryBudgets: {
            [tripId]: Object.fromEntries(
              Object.entries(categoryBudgetsSnapshot.val() || {}).map(
                ([category, amount]) => [
                  category,
                  Math.max(0, Number(amount) || 0),
                ],
              ),
            ),
          },
          dailyBudgets: { [tripId]: Math.max(0, Number(dailyBudgetSnapshot.val()) || 0) },
          insurances: insuranceSnapshot.val() ? [{ id: userId, userId, ...(insuranceSnapshot.val() as Omit<TravelInsurance, 'id' | 'tripId' | 'userId'>), tripId }] : [],
          insuranceStatuses: { [tripId]: Object.fromEntries(Object.entries(insuranceStatusSnapshot.val() || {}).map(([statusUserId, value]) => [statusUserId, { userId: statusUserId, ...(value as Omit<InsuranceStatusSummary, 'userId'>) }])) },
          paymentTools: Object.entries(paymentToolsSnapshot.val() || {}).map(([id, value]) => ({ id, ...(value as Omit<PaymentTool, 'id' | 'tripId'>), tripId })),
          paymentToolSummaries: Object.entries(paymentSummariesSnapshot.val() || {}).map(([id, value]) => ({ id, ...(value as Omit<PaymentToolSummary, 'id' | 'tripId'>), tripId })),
          rewardRules: Object.entries(rewardRulesSnapshot.val() || {}).map(([id, value]) => ({ id, ...(value as Omit<RewardRule, 'id' | 'tripId'>), tripId })),
          paymentTransactions: Object.entries(paymentTransactionsSnapshot.val() || {}).map(([id, value]) => ({ id, ...(value as Omit<PaymentTransaction, 'id' | 'tripId'>), tripId })),
          storedValueBalances: Object.entries(storedValueSnapshot.val() || {}).map(([paymentToolId, value]) => ({ paymentToolId, ...(value as Omit<StoredValueBalance, 'tripId' | 'paymentToolId'>), tripId })),
        };
      }),
    );
    return tripRows
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .reduce<Data>(
        (data, row) => ({
          trips: [...data.trips, row.trip],
          itinerary: [...data.itinerary, ...row.itinerary],
          expenses: [...data.expenses, ...row.expenses],
          settlements: [...data.settlements, ...row.settlements],
          todos: [...data.todos, ...row.todos],
          packingItems: [...data.packingItems, ...row.packingItems],
          bookings: [...data.bookings, ...row.bookings],
          favorites: [...data.favorites, ...row.favorites],
          albumPhotos: [...data.albumPhotos, ...row.albumPhotos],
          shoppingItems: [...data.shoppingItems, ...row.shoppingItems],
          categoryBudgets: { ...data.categoryBudgets, ...row.categoryBudgets },
          dailyBudgets: { ...data.dailyBudgets, ...row.dailyBudgets },
          insurances: [...data.insurances, ...row.insurances],
          insuranceStatuses: { ...data.insuranceStatuses, ...row.insuranceStatuses },
          paymentTools: [...data.paymentTools, ...row.paymentTools], paymentToolSummaries: [...data.paymentToolSummaries, ...row.paymentToolSummaries], rewardRules: [...data.rewardRules, ...row.rewardRules], paymentTransactions: [...data.paymentTransactions, ...row.paymentTransactions], storedValueBalances: [...data.storedValueBalances, ...row.storedValueBalances],
        }),
        seed,
      );
  },
  async getPrivateItinerary(tripIds: string[], userId: string) {
    const db = database;
    if (!firebaseEnabled || !db || !userId) return [];
    const rows = await Promise.all(
      tripIds.map(async (tripId) => {
        const snapshot = await get(
          ref(db, `privateItineraryItems/${tripId}/${userId}`),
        );
        return Object.entries(snapshot.val() || {}).map(([id, value]) => ({
          id,
          ...(value as Omit<ItineraryItem, "id" | "tripId">),
          tripId,
          activityKind: "personal" as const,
          ownerId: userId,
        }));
      }),
    );
    return rows.flat();
  },
  async addTrip(input: Omit<Trip, "id" | "inviteCode">, userId?: string) {
    const trip = {
      ...input,
      id: id(),
      inviteCode: Math.random().toString(36).slice(2, 8).toUpperCase(),
    };
    const db = database;
    if (firebaseEnabled && db && userId) {
      const { members, ...tripData } = trip;
      const updates: Record<string, unknown> = {
        [`trips/${trip.id}`]: tripData,
        [`tripInvites/${trip.inviteCode}`]: {
          tripId: trip.id,
          createdBy: userId,
          role: "editor",
          enabled: true,
          usedCount: 0,
          maxUses: 20,
          createdAt: Date.now(),
        },
        [`userTrips/${userId}/${trip.id}`]: true,
      };
      members.forEach((member) => {
        updates[`tripMembers/${trip.id}/${member.id}`] = {
          name: member.name,
          email: member.email,
          role: member.role,
        };
        updates[`userTrips/${member.id}/${trip.id}`] = true;
      });
      await update(ref(db), updates);
      return trip;
    }
    const d = read();
    d.trips.push(trip);
    write(d);
    return trip;
  },
  async updateTrip(trip: Trip) {
    const db = database;
    if (firebaseEnabled && db) {
      const { members, id: tripId, ...data } = trip;
      await set(ref(db, `trips/${tripId}`), data);
      await set(
        ref(db, `tripMembers/${tripId}`),
        Object.fromEntries(
          members.map(({ id, personalBudget: _personalBudget, ...member }) => [
            id,
            member,
          ]),
        ),
      );
      return;
    }
    const d = read();
    d.trips = d.trips.map((x) => (x.id === trip.id ? trip : x));
    write(d);
  },
  async deleteTrip(trip: Trip) {
    const db = database;
    if (firebaseEnabled && db) {
      const updates: Record<string, null> = {
        [`trips/${trip.id}`]: null,
        [`tripMembers/${trip.id}`]: null,
        [`tripMemberBudgets/${trip.id}`]: null,
        [`budgets/${trip.id}`]: null,
        [`itineraryItems/${trip.id}`]: null,
        [`privateItineraryItems/${trip.id}`]: null,
        [`expenses/${trip.id}`]: null,
        [`settlements/${trip.id}`]: null,
        [`todos/${trip.id}`]: null,
        [`packingItems/${trip.id}`]: null,
        [`bookings/${trip.id}`]: null,
        [`favorites/${trip.id}`]: null,
        [`albums/${trip.id}`]: null,
        [`shoppingItems/${trip.id}`]: null,
        [`travelInsurances/${trip.id}`]: null,
        [`insuranceStatuses/${trip.id}`]: null,
        [`paymentTools/${trip.id}`]: null, [`rewardRules/${trip.id}`]: null, [`paymentTransactions/${trip.id}`]: null, [`storedValueBalances/${trip.id}`]: null,
        [`tripInvites/${trip.inviteCode}`]: null,
      };
      trip.members.forEach((member) => {
        updates[`userTrips/${member.id}/${trip.id}`] = null;
      });
      await update(ref(db), updates);
      return;
    }
    const d = read();
    d.trips = d.trips.filter((x) => x.id !== trip.id);
    d.itinerary = d.itinerary.filter((x) => x.tripId !== trip.id);
    d.expenses = d.expenses.filter((x) => x.tripId !== trip.id);
    d.settlements = d.settlements.filter((x) => x.tripId !== trip.id);
    d.todos = d.todos.filter((x) => x.tripId !== trip.id);
    d.packingItems = d.packingItems.filter((x) => x.tripId !== trip.id);
    d.bookings = d.bookings.filter((x) => x.tripId !== trip.id);
    d.favorites = d.favorites.filter((x) => x.tripId !== trip.id);
    d.albumPhotos = d.albumPhotos.filter((x) => x.tripId !== trip.id);
    d.shoppingItems = d.shoppingItems.filter((x) => x.tripId !== trip.id);
    d.insurances = d.insurances.filter((x) => x.tripId !== trip.id);
    delete d.insuranceStatuses[trip.id];
    d.paymentTools = d.paymentTools.filter((item) => item.tripId !== trip.id); d.rewardRules = d.rewardRules.filter((item) => item.tripId !== trip.id); d.paymentTransactions = d.paymentTransactions.filter((item) => item.tripId !== trip.id); d.storedValueBalances = d.storedValueBalances.filter((item) => item.tripId !== trip.id);
    delete d.categoryBudgets[trip.id];
    write(d);
  },
  async addMember(trip: Trip, member: Omit<Trip["members"][number], "id">) {
    const db = database;
    if (firebaseEnabled && db) {
      const emailKey = member.email.toLowerCase().replace(/[.#$\[\]/]/g, "_");
      const memberId = (await get(ref(db, `emailIndex/${emailKey}`))).val() as
        | string
        | null;
      if (!memberId)
        throw new Error(
          "這位旅伴尚未登入 TripMate，請請對方先完成登入後再邀請。",
        );
      await update(ref(db), {
        [`tripMembers/${trip.id}/${memberId}`]: member,
        [`userTrips/${memberId}/${trip.id}`]: true,
      });
      return { id: memberId, ...member };
    }
    const result = { id: id(), ...member };
    trip.members.push(result);
    await this.updateTrip(trip);
    return result;
  },
  async removeMember(trip: Trip, memberId: string) {
    const db = database;
    if (firebaseEnabled && db) {
      await update(ref(db), {
        [`tripMembers/${trip.id}/${memberId}`]: null,
        [`userTrips/${memberId}/${trip.id}`]: null,
        [`tripMemberBudgets/${trip.id}/${memberId}`]: null,
      });
      return;
    }
    const d = read();
    const storedTrip = d.trips.find((entry) => entry.id === trip.id);
    if (storedTrip)
      storedTrip.members = storedTrip.members.filter(
        (member) => member.id !== memberId,
      );
    write(d);
  },
  async updatePersonalBudget(
    trip: Trip,
    memberId: string,
    personalBudget: number,
  ) {
    const budget = Math.max(0, Number(personalBudget) || 0);
    const db = database;
    if (firebaseEnabled && db) {
      await set(ref(db, `tripMemberBudgets/${trip.id}/${memberId}`), budget);
      return;
    }
    const d = read();
    const storedTrip = d.trips.find((entry) => entry.id === trip.id);
    const storedMember = storedTrip?.members.find(
      (entry) => entry.id === memberId,
    );
    if (storedMember) storedMember.personalBudget = budget;
    write(d);
  },
  async updateCategoryBudgets(
    trip: Trip,
    categoryBudgets: Record<string, number>,
  ) {
    const budgets = Object.fromEntries(
      Object.entries(categoryBudgets)
        .map(([category, amount]) => [
          category,
          Math.max(0, Number(amount) || 0),
        ])
        .filter(([, amount]) => Number(amount) > 0),
    );
    const db = database;
    if (firebaseEnabled && db) {
      await set(ref(db, `budgets/${trip.id}/categories`), budgets);
      return;
    }
    const d = read();
    d.categoryBudgets[trip.id] = budgets;
    write(d);
  },
  async updateDailyBudget(trip: Trip, dailyBudget: number) {
    const budget = Math.max(0, Number(dailyBudget) || 0);
    const db = database;
    if (firebaseEnabled && db) {
      await set(ref(db, `budgets/${trip.id}/daily`), budget || null);
      return;
    }
    const d = read();
    d.dailyBudgets[trip.id] = budget;
    write(d);
  },
  async addTodo(input: Omit<TodoItem, "id" | "completed" | "createdAt">) {
    const todo = {
      ...input,
      id: id(),
      completed: false,
      createdAt: Date.now(),
    };
    const db = database;
    if (firebaseEnabled && db) {
      const { id: todoId, tripId, ...data } = todo;
      await set(ref(db, `todos/${tripId}/${todoId}`), data);
      return todo;
    }
    const d = read();
    d.todos.push(todo);
    write(d);
    return todo;
  },
  async updateTodo(todo: TodoItem) {
    const db = database;
    if (firebaseEnabled && db) {
      const { id: todoId, tripId, ...data } = todo;
      await set(ref(db, `todos/${tripId}/${todoId}`), data);
      return;
    }
    const d = read();
    d.todos = d.todos.map((entry) => (entry.id === todo.id ? todo : entry));
    write(d);
  },
  async toggleTodo(todo: TodoItem) {
    const db = database;
    if (firebaseEnabled && db) {
      await update(ref(db, `todos/${todo.tripId}/${todo.id}`), {
        completed: !todo.completed,
      });
      return;
    }
    const d = read();
    const target = d.todos.find((entry) => entry.id === todo.id);
    if (target) target.completed = !target.completed;
    write(d);
  },
  async deleteTodo(todo: TodoItem) {
    const db = database;
    if (firebaseEnabled && db) {
      await set(ref(db, `todos/${todo.tripId}/${todo.id}`), null);
      return;
    }
    const d = read();
    d.todos = d.todos.filter((entry) => entry.id !== todo.id);
    write(d);
  },
  async addPackingItem(
    input: Omit<PackingItem, "id" | "completed" | "createdAt">,
  ) {
    const item = {
      ...input,
      id: id(),
      completed: false,
      createdAt: Date.now(),
    };
    const db = database;
    if (firebaseEnabled && db) {
      const { id: itemId, tripId, ...data } = item;
      await set(ref(db, `packingItems/${tripId}/${itemId}`), data);
      return item;
    }
    const d = read();
    d.packingItems.push(item);
    write(d);
    return item;
  },
  async updatePackingItem(item: PackingItem) {
    const db = database;
    if (firebaseEnabled && db) {
      const { id: itemId, tripId, ...data } = item;
      await set(ref(db, `packingItems/${tripId}/${itemId}`), data);
      return;
    }
    const d = read();
    d.packingItems = d.packingItems.map((entry) =>
      entry.id === item.id ? item : entry,
    );
    write(d);
  },
  async reorderPackingItems(items: PackingItem[]) {
    if (!items.length) return;
    const db = database;
    if (firebaseEnabled && db) {
      const updates: Record<string, number> = {};
      items.forEach((item, order) => {
        updates[`packingItems/${item.tripId}/${item.id}/order`] = order;
      });
      await update(ref(db), updates);
      return;
    }
    const orders = new Map(items.map((item, order) => [item.id, order]));
    const d = read();
    d.packingItems = d.packingItems.map((item) =>
      orders.has(item.id) ? { ...item, order: orders.get(item.id) } : item,
    );
    write(d);
  },
  async togglePackingItem(item: PackingItem) {
    const db = database;
    if (firebaseEnabled && db) {
      await update(ref(db, `packingItems/${item.tripId}/${item.id}`), {
        completed: !item.completed,
      });
      return;
    }
    const d = read();
    const target = d.packingItems.find((entry) => entry.id === item.id);
    if (target) target.completed = !target.completed;
    write(d);
  },
  async deletePackingItem(item: PackingItem) {
    const db = database;
    if (firebaseEnabled && db) {
      await set(ref(db, `packingItems/${item.tripId}/${item.id}`), null);
      return;
    }
    const d = read();
    d.packingItems = d.packingItems.filter((entry) => entry.id !== item.id);
    write(d);
  },
  async addBooking(input: Omit<Booking, "id" | "createdAt">) {
    const booking = { ...input, id: id(), createdAt: Date.now() };
    const db = database;
    if (firebaseEnabled && db) {
      const { id: bookingId, tripId, ...data } = booking;
      await set(ref(db, `bookings/${tripId}/${bookingId}`), data);
      return booking;
    }
    const d = read();
    d.bookings.push(booking);
    write(d);
    return booking;
  },
  async updateBooking(booking: Booking) {
    const db = database;
    if (firebaseEnabled && db) {
      const { id: bookingId, tripId, ...data } = booking;
      await set(ref(db, `bookings/${tripId}/${bookingId}`), data);
      return;
    }
    const d = read();
    d.bookings = d.bookings.map((entry) =>
      entry.id === booking.id ? booking : entry,
    );
    write(d);
  },
  async deleteBooking(booking: Booking) {
    const db = database;
    if (firebaseEnabled && db) {
      await set(ref(db, `bookings/${booking.tripId}/${booking.id}`), null);
      return;
    }
    const d = read();
    d.bookings = d.bookings.filter((entry) => entry.id !== booking.id);
    write(d);
  },
  async addFavorite(
    input: Omit<Favorite, "id" | "createdAt" | "addedToItinerary">,
  ) {
    const favorite = {
      ...input,
      id: id(),
      addedToItinerary: false,
      order: input.order ?? Date.now(),
      createdAt: Date.now(),
    };
    const db = database;
    if (firebaseEnabled && db) {
      const { id: favoriteId, tripId, ...data } = favorite;
      await set(ref(db, `favorites/${tripId}/${favoriteId}`), data);
      return favorite;
    }
    const d = read();
    d.favorites.push(favorite);
    write(d);
    return favorite;
  },
  async updateFavorite(favorite: Favorite) {
    const db = database;
    if (firebaseEnabled && db) {
      const { id: favoriteId, tripId, ...data } = favorite;
      await set(ref(db, `favorites/${tripId}/${favoriteId}`), data);
      return;
    }
    const d = read();
    d.favorites = d.favorites.map((entry) =>
      entry.id === favorite.id ? favorite : entry,
    );
    write(d);
  },
  async reorderFavorites(favorites: Favorite[]) {
    if (!favorites.length) return;
    const db = database;
    if (firebaseEnabled && db) {
      const updates: Record<string, number> = {};
      favorites.forEach((favorite, order) => {
        updates[`favorites/${favorite.tripId}/${favorite.id}/order`] = order;
      });
      await update(ref(db), updates);
      return;
    }
    const orders = new Map(
      favorites.map((favorite, order) => [favorite.id, order]),
    );
    const d = read();
    d.favorites = d.favorites.map((favorite) =>
      orders.has(favorite.id)
        ? { ...favorite, order: orders.get(favorite.id) }
        : favorite,
    );
    write(d);
  },
  async deleteFavorite(favorite: Favorite) {
    const db = database;
    if (firebaseEnabled && db) {
      await set(ref(db, `favorites/${favorite.tripId}/${favorite.id}`), null);
      return;
    }
    const d = read();
    d.favorites = d.favorites.filter((entry) => entry.id !== favorite.id);
    write(d);
  },
  async addAlbumPhoto(input: Omit<AlbumPhoto, "id" | "createdAt">) {
    const photo = { ...input, id: id(), createdAt: Date.now() };
    const db = database;
    if (firebaseEnabled && db) {
      const { id: photoId, tripId, ...data } = photo;
      await set(ref(db, `albums/${tripId}/${photoId}`), data);
      return photo;
    }
    const d = read();
    d.albumPhotos.push(photo);
    write(d);
    return photo;
  },
  async updateAlbumPhoto(photo: AlbumPhoto) {
    const db = database;
    if (firebaseEnabled && db) {
      const { id: photoId, tripId, ...data } = photo;
      await set(ref(db, `albums/${tripId}/${photoId}`), data);
      return;
    }
    const d = read();
    d.albumPhotos = d.albumPhotos.map((entry) =>
      entry.id === photo.id ? photo : entry,
    );
    write(d);
  },
  async deleteAlbumPhoto(photo: AlbumPhoto) {
    const db = database;
    if (firebaseEnabled && db) {
      await set(ref(db, `albums/${photo.tripId}/${photo.id}`), null);
      return;
    }
    const d = read();
    d.albumPhotos = d.albumPhotos.filter((entry) => entry.id !== photo.id);
    write(d);
  },
  async addShoppingItem(
    input: Omit<ShoppingItem, "id" | "createdAt" | "updatedAt">,
  ) {
    const item = {
      ...input,
      id: id(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const db = database;
    if (firebaseEnabled && db) {
      const { id: itemId, tripId, ...data } = item;
      await set(
        ref(db, `shoppingItems/${tripId}/${itemId}`),
        withoutUndefined(data),
      );
      return item;
    }
    const d = read();
    d.shoppingItems.push(item);
    write(d);
    return item;
  },
  async updateShoppingItem(item: ShoppingItem) {
    const updated = { ...item, updatedAt: Date.now() };
    const db = database;
    if (firebaseEnabled && db) {
      const { id: itemId, tripId, ...data } = updated;
      await set(
        ref(db, `shoppingItems/${tripId}/${itemId}`),
        withoutUndefined(data),
      );
      return updated;
    }
    const d = read();
    d.shoppingItems = d.shoppingItems.map((entry) =>
      entry.id === item.id ? updated : entry,
    );
    write(d);
    return updated;
  },
  async deleteShoppingItem(item: ShoppingItem) {
    const db = database;
    if (firebaseEnabled && db) {
      await set(ref(db, `shoppingItems/${item.tripId}/${item.id}`), null);
      return;
    }
    const d = read();
    d.shoppingItems = d.shoppingItems.filter((entry) => entry.id !== item.id);
    write(d);
  },
  async addItinerary(input: Omit<ItineraryItem, "id" | "completed">) {
    const item = { ...input, id: id(), completed: false };
    const db = database;
    if (firebaseEnabled && db) {
      const { id: itemId, tripId, ...data } = item;
      const path =
        item.activityKind === "personal" && item.ownerId
          ? `privateItineraryItems/${tripId}/${item.ownerId}/${itemId}`
          : `itineraryItems/${tripId}/${itemId}`;
      await set(ref(db, path), data);
      return item;
    }
    const d = read();
    d.itinerary.push(item);
    write(d);
    return item;
  },
  async updateItinerary(item: ItineraryItem) {
    const db = database;
    if (firebaseEnabled && db) {
      const { id: itemId, tripId, ...data } = item;
      const path =
        item.activityKind === "personal" && item.ownerId
          ? `privateItineraryItems/${tripId}/${item.ownerId}/${itemId}`
          : `itineraryItems/${tripId}/${itemId}`;
      await set(ref(db, path), data);
      return;
    }
    const d = read();
    d.itinerary = d.itinerary.map((entry) =>
      entry.id === item.id ? item : entry,
    );
    write(d);
  },
  async moveItinerary(item: ItineraryItem, previous: ItineraryItem) {
    const db = database;
    if (firebaseEnabled && db) {
      const pathFor = (entry: ItineraryItem) =>
        entry.activityKind === "personal" && entry.ownerId
          ? `privateItineraryItems/${entry.tripId}/${entry.ownerId}/${entry.id}`
          : `itineraryItems/${entry.tripId}/${entry.id}`;
      const previousPath = pathFor(previous);
      const nextPath = pathFor(item);
      const { id: _itemId, tripId: _tripId, ...data } = item;
      const nextData = withoutUndefined(data);

      if (previousPath === nextPath) {
        await set(ref(db, nextPath), nextData);
      } else {
        await update(ref(db), {
          [previousPath]: null,
          [nextPath]: nextData,
        });
      }
      return;
    }
    const d = read();
    d.itinerary = d.itinerary.map((entry) =>
      entry.id === item.id ? item : entry,
    );
    write(d);
  },
  async reorderItinerary(items: ItineraryItem[]) {
    if (!items.length) return;
    const db = database;
    if (firebaseEnabled && db) {
      const updates: Record<string, number> = {};
      items.forEach((item, order) => {
        const path =
          item.activityKind === "personal" && item.ownerId
            ? `privateItineraryItems/${item.tripId}/${item.ownerId}/${item.id}/order`
            : `itineraryItems/${item.tripId}/${item.id}/order`;
        updates[path] = order;
      });
      await update(ref(db), updates);
      return;
    }
    const orders = new Map(items.map((item, order) => [item.id, order]));
    const d = read();
    d.itinerary = d.itinerary.map((item) =>
      orders.has(item.id) ? { ...item, order: orders.get(item.id) } : item,
    );
    write(d);
  },
  async deleteItinerary(item: ItineraryItem) {
    const db = database;
    if (firebaseEnabled && db) {
      const path =
        item.activityKind === "personal" && item.ownerId
          ? `privateItineraryItems/${item.tripId}/${item.ownerId}/${item.id}`
          : `itineraryItems/${item.tripId}/${item.id}`;
      await set(ref(db, path), null);
      return;
    }
    const d = read();
    d.itinerary = d.itinerary.filter((entry) => entry.id !== item.id);
    write(d);
  },
  async toggleItinerary(itemId: string, item?: ItineraryItem) {
    const db = database;
    if (firebaseEnabled && db && item) {
      const path =
        item.activityKind === "personal" && item.ownerId
          ? `privateItineraryItems/${item.tripId}/${item.ownerId}/${itemId}`
          : `itineraryItems/${item.tripId}/${itemId}`;
      await update(ref(db, path), { completed: !item.completed });
      return;
    }
    const d = read();
    const target = d.itinerary.find((x) => x.id === itemId);
    if (target) target.completed = !target.completed;
    write(d);
  },
  async addExpense(input: Omit<Expense, "id">) {
    const expense = { ...input, id: id() };
    const db = database;
    if (firebaseEnabled && db) {
      const { id: expenseId, ...data } = expense;
      await set(ref(db, `expenses/${expense.tripId}/${expenseId}`), data);
      return expense;
    }
    const d = read();
    d.expenses.push(expense);
    write(d);
    return expense;
  },
  async updateExpense(expense: Expense) {
    const db = database;
    if (firebaseEnabled && db) {
      const { id: expenseId, tripId, ...data } = expense;
      await set(ref(db, `expenses/${tripId}/${expenseId}`), data);
      return;
    }
    const d = read();
    d.expenses = d.expenses.map((item) =>
      item.id === expense.id ? expense : item,
    );
    write(d);
  },
  async deleteExpense(expense: Expense) {
    const db = database;
    if (firebaseEnabled && db) {
      await set(ref(db, `expenses/${expense.tripId}/${expense.id}`), null);
      return;
    }
    const d = read();
    d.expenses = d.expenses.filter((item) => item.id !== expense.id);
    write(d);
  },
  async addSettlement(input: Omit<Settlement, "id">) {
    const settlement = { ...input, id: id() };
    const db = database;
    if (firebaseEnabled && db) {
      const { id: settlementId, ...data } = settlement;
      await set(
        ref(db, `settlements/${settlement.tripId}/${settlementId}`),
        data,
      );
      return settlement;
    }
    const d = read();
    d.settlements.push(settlement);
    write(d);
    return settlement;
  },
  async deleteSettlement(settlement: Settlement) {
    const db = database;
    if (firebaseEnabled && db) {
      await set(
        ref(db, `settlements/${settlement.tripId}/${settlement.id}`),
        null,
      );
      return;
    }
    const d = read();
    d.settlements = d.settlements.filter((item) => item.id !== settlement.id);
    write(d);
  },
  async saveInsurance(input: Omit<TravelInsurance, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<TravelInsurance, 'createdAt'>>, statusSummary?: Pick<InsuranceStatusSummary, 'status' | 'coverageStatus'>) {
    const now = Date.now();
    const insurance: TravelInsurance = { ...input, id: input.userId, createdAt: input.createdAt || now, updatedAt: now };
    const db = database;
    if (firebaseEnabled && db) {
      const { id: _id, tripId, userId, ...data } = insurance;
      const summary = withoutUndefined({ status: statusSummary?.status || (insurance.status === 'active' ? 'covered' : insurance.status === 'cancelled' ? 'cancelled' : insurance.status === 'expired' ? 'expired' : 'draft'), coverageStatus: statusSummary?.coverageStatus, providerName: insurance.visibility === 'private' ? undefined : insurance.providerName, visibility: insurance.visibility, updatedAt: insurance.updatedAt });
      await update(ref(db), { [`travelInsurances/${tripId}/${userId}`]: withoutUndefined(data), [`insuranceStatuses/${tripId}/${userId}`]: summary });
      return insurance;
    }
    const d = read(); const index = d.insurances.findIndex((entry) => entry.tripId === insurance.tripId && entry.userId === insurance.userId);
    if (index >= 0) d.insurances.splice(index, 1, insurance); else d.insurances.push(insurance); write(d); return insurance;
  },
  async deleteInsurance(insurance: TravelInsurance) {
    const db = database;
    if (firebaseEnabled && db) { await update(ref(db), { [`travelInsurances/${insurance.tripId}/${insurance.userId}`]: null, [`insuranceStatuses/${insurance.tripId}/${insurance.userId}`]: null }); return; }
    const d = read(); d.insurances = d.insurances.filter((entry) => !(entry.tripId === insurance.tripId && entry.userId === insurance.userId)); write(d);
  },
  async savePaymentTool(input: Omit<PaymentTool, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<PaymentTool, 'id' | 'createdAt'>>) { const now = Date.now(); const tool: PaymentTool = { ...input, id: input.id || id(), createdAt: input.createdAt || now, updatedAt: now }; const db = database; const summary = tool.visibility === 'private' ? null : { ownerUserId: tool.ownerUserId, type: tool.type, name: tool.name, issuer: tool.issuer, visibility: tool.visibility, isActive: tool.isActive, updatedAt: tool.updatedAt }; if (firebaseEnabled && db) { const { id: toolId, tripId, ownerUserId, ...data } = tool; await update(ref(db), { [`paymentTools/${tripId}/${ownerUserId}/${toolId}`]: withoutUndefined({ ...data, ownerUserId }), [`paymentToolSummaries/${tripId}/${toolId}`]: summary ? withoutUndefined(summary) : null }); return tool } const d = read(); const index = d.paymentTools.findIndex((item) => item.id === tool.id); if (index >= 0) d.paymentTools.splice(index, 1, tool); else d.paymentTools.push(tool); d.paymentToolSummaries = d.paymentToolSummaries.filter((item) => item.id !== tool.id); if (summary) d.paymentToolSummaries.push({ id: tool.id, tripId: tool.tripId, ...summary }); write(d); return tool },
  async deletePaymentTool(tool: PaymentTool) { const db = database; if (firebaseEnabled && db) { await update(ref(db), { [`paymentTools/${tool.tripId}/${tool.ownerUserId}/${tool.id}`]: null, [`paymentToolSummaries/${tool.tripId}/${tool.id}`]: null, [`rewardRules/${tool.tripId}/${tool.ownerUserId}/${tool.id}`]: null, [`storedValueBalances/${tool.tripId}/${tool.ownerUserId}/${tool.id}`]: null }); return } const d = read(); d.paymentTools = d.paymentTools.filter((item) => item.id !== tool.id); d.paymentToolSummaries = d.paymentToolSummaries.filter((item) => item.id !== tool.id); d.rewardRules = d.rewardRules.filter((item) => item.paymentToolId !== tool.id); d.storedValueBalances = d.storedValueBalances.filter((item) => item.paymentToolId !== tool.id); write(d) },
  async saveRewardRule(input: Omit<RewardRule, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<RewardRule, 'id' | 'createdAt'>>) { const now = Date.now(); const rule: RewardRule = { ...input, id: input.id || id(), createdAt: input.createdAt || now, updatedAt: now }; const db = database; if (firebaseEnabled && db) { const { id: ruleId, tripId, paymentToolId, createdBy, ...data } = rule; await set(ref(db, `rewardRules/${tripId}/${createdBy}/${ruleId}`), withoutUndefined({ ...data, paymentToolId, createdBy })); return rule } const d = read(); const index = d.rewardRules.findIndex((item) => item.id === rule.id); if (index >= 0) d.rewardRules.splice(index, 1, rule); else d.rewardRules.push(rule); write(d); return rule },
  async deleteRewardRule(rule: RewardRule) { const db = database; if (firebaseEnabled && db) { await set(ref(db, `rewardRules/${rule.tripId}/${rule.createdBy}/${rule.id}`), null); return } const d = read(); d.rewardRules = d.rewardRules.filter((item) => item.id !== rule.id); write(d) },
  async savePaymentTransaction(input: Omit<PaymentTransaction, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<PaymentTransaction, 'id' | 'createdAt'>>) { const now = Date.now(); const transaction: PaymentTransaction = { ...input, id: input.id || id(), createdAt: input.createdAt || now, updatedAt: now }; const db = database; if (firebaseEnabled && db) { const { id: transactionId, tripId, ownerUserId, ...data } = transaction; await set(ref(db, `paymentTransactions/${tripId}/${ownerUserId}/${transactionId}`), withoutUndefined({ ...data, ownerUserId })); return transaction } const d = read(); const index = d.paymentTransactions.findIndex((item) => item.id === transaction.id); if (index >= 0) d.paymentTransactions.splice(index, 1, transaction); else d.paymentTransactions.push(transaction); write(d); return transaction },
  async deletePaymentTransaction(transaction: PaymentTransaction) { const db = database; if (firebaseEnabled && db) { await set(ref(db, `paymentTransactions/${transaction.tripId}/${transaction.ownerUserId}/${transaction.id}`), null); return } const d = read(); d.paymentTransactions = d.paymentTransactions.filter((item) => item.id !== transaction.id); write(d) },
  async saveStoredValueBalance(balance: StoredValueBalance) { const db = database; if (firebaseEnabled && db) { const { tripId, paymentToolId, ownerUserId, ...data } = balance; await set(ref(db, `storedValueBalances/${tripId}/${ownerUserId}/${paymentToolId}`), withoutUndefined({ ...data, ownerUserId })); return } const d = read(); const index = d.storedValueBalances.findIndex((item) => item.tripId === balance.tripId && item.paymentToolId === balance.paymentToolId); if (index >= 0) d.storedValueBalances.splice(index, 1, balance); else d.storedValueBalances.push(balance); write(d) },
};
