import { computed, ref, type ComputedRef, type Ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { User } from 'firebase/auth'
import type { Favorite, FavoriteType, ItineraryItem } from '../types'
import { firebaseEnabled } from '../services/firebase'
import { useTripStore } from '../stores/trip'

export function useTripWorkspaceItinerary({
  store,
  items,
  favorites,
  user,
  canEditTrip,
  openItineraryTab,
}: {
  store: ReturnType<typeof useTripStore>
  items: ComputedRef<ItineraryItem[]>
  favorites: ComputedRef<Favorite[]>
  user: Ref<User | null>
  canEditTrip: ComputedRef<boolean>
  openItineraryTab?: () => void
}) {
  const favoriteItineraryRequestId = ref('')

  function itemCardVisibility(entry: ItineraryItem) {
    return entry.cardVisibility || 'shared'
  }

  function itemChildVisibility(entry: ItineraryItem) {
    if (itemCardVisibility(entry) === 'private') return 'private'
    if (entry.activityKind === 'free') return 'private'
    return entry.childVisibility || 'shared'
  }

  function canSeeTopLevelEntry(entry: ItineraryItem) {
    return itemCardVisibility(entry) !== 'private' || !firebaseEnabled || entry.ownerId === user.value?.uid
  }

  function visibleGroupItems(groupId: string) {
    const parent = items.value.find((entry) => entry.id === groupId)
    const onlyOwner = parent && itemChildVisibility(parent) === 'private'
    return items.value.filter(
      (entry) =>
        entry.itineraryGroupId === groupId &&
        (!onlyOwner || !firebaseEnabled || entry.ownerId === user.value?.uid),
    )
  }

  const currentPersonalItems = computed(() =>
    items.value.filter(
      (entry) =>
        entry.activityKind === 'personal' &&
        (!firebaseEnabled || entry.ownerId === user.value?.uid),
    ),
  )

  function favoriteToItineraryType(favoriteType: FavoriteType) {
    return (
      {
        attraction: '景點',
        restaurant: '餐廳',
        transport: '交通',
        stay: '住宿',
        shop: '商店',
        cafe: '餐廳',
        alternative: '景點',
        other: '景點',
      } as Record<FavoriteType, string>
    )[favoriteType]
  }

  const favoritesWithItineraryStatus = computed(() =>
    favorites.value.map((favoriteItem) => ({
      ...favoriteItem,
      addedToItinerary: items.value.some(
        (entry) =>
          entry.favoriteId === favoriteItem.id ||
          (!entry.favoriteId &&
            entry.title === favoriteItem.name &&
            (favoriteItem.mapUrl
              ? entry.mapUrl === favoriteItem.mapUrl
              : favoriteItem.location
                ? entry.location === favoriteItem.location
                : entry.type === favoriteToItineraryType(favoriteItem.type))),
      ),
    })),
  )

  const itineraryDays = computed(() =>
    Object.entries(
      items.value
        .filter(
          (entry) =>
            (entry.activityKind || 'shared') !== 'personal' &&
            canSeeTopLevelEntry(entry),
        )
        .reduce<Record<string, ItineraryItem[]>>((days, entry) => {
          ;(days[entry.date] ||= []).push(entry)
          return days
        }, {}),
    )
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, entries]) => ({
        date,
        entries: entries.sort(
          (a, b) =>
            (a.order ?? Number.MAX_SAFE_INTEGER) -
              (b.order ?? Number.MAX_SAFE_INTEGER) ||
            compareItineraryTime(a, b),
        ),
      })),
  )

  const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']

  const mapsUrl = (location: string, mapUrl?: string) =>
    mapUrl ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`

  function formatItineraryDate(date: string) {
    const value = new Date(`${date}T00:00:00`)
    return Number.isNaN(value.getTime())
      ? date
      : `${value.getFullYear()} 年 ${value.getMonth() + 1} 月 ${value.getDate()} 日・${weekdays[value.getDay()]}`
  }

  function itineraryDuration(entry: ItineraryItem) {
    if (!entry.time || !entry.endTime) return ''
    const [startHour, startMinute] = entry.time.split(':').map(Number)
    const [endHour, endMinute] = entry.endTime.split(':').map(Number)
    const minutes = endHour * 60 + endMinute - (startHour * 60 + startMinute)
    if (!Number.isFinite(minutes) || minutes <= 0) return ''
    const hours = Math.floor(minutes / 60)
    const remainingMinutes = minutes % 60
    return `約 ${hours ? `${hours} 小時` : ''}${hours && remainingMinutes ? ' ' : ''}${remainingMinutes ? `${remainingMinutes} 分` : ''}`
  }

  function timeToMinutes(value?: string) {
    if (!value) return Number.NaN
    const [hourText, minuteText = '0'] = value.split(':')
    const hour = Number(hourText)
    const minute = Number(minuteText)
    if (!Number.isFinite(hour) || !Number.isFinite(minute)) return Number.NaN
    return hour * 60 + minute
  }

  function compareItineraryTime(a: ItineraryItem, b: ItineraryItem) {
    const aMinutes = timeToMinutes(a.time)
    const bMinutes = timeToMinutes(b.time)
    const aHasTime = Number.isFinite(aMinutes)
    const bHasTime = Number.isFinite(bMinutes)
    if (aHasTime && bHasTime && aMinutes !== bMinutes) return aMinutes - bMinutes
    if (aHasTime && !bHasTime) return -1
    if (!aHasTime && bHasTime) return 1
    return 0
  }

  function itineraryTimeWarning(entries: ItineraryItem[], index: number) {
    if (index === 0) return ''
    const previous = entries[index - 1]
    const entry = entries[index]
    if (!previous?.time || !entry?.time) return ''
    const previousStart = timeToMinutes(previous.time)
    const previousEnd = timeToMinutes(previous.endTime || previous.time)
    const entryStart = timeToMinutes(entry.time)
    if (!Number.isFinite(previousStart) || !Number.isFinite(previousEnd) || !Number.isFinite(entryStart)) return ''
    if (entryStart < previousStart) return '開始時間早於上一筆行程'
    if (entryStart < previousEnd) return '與上一筆行程時間重疊'
    return ''
  }

  async function removeItem(entry: ItineraryItem) {
    if (!canEditTrip.value) {
      ElMessage.warning('Viewer 僅能查看行程，無法修改。')
      return
    }
    try {
      const isFree = entry.activityKind === 'free'
      await ElMessageBox.confirm(
        `確定刪除${isFree ? '自由活動群組' : '行程'}「${entry.title}」嗎？${
          isFree ? '你的個人行程也會一併移除。' : ''
        }`,
        `刪除${isFree ? '自由活動' : '行程'}`,
        { confirmButtonText: '刪除', cancelButtonText: '取消', type: 'warning' },
      )
      if (isFree) {
        await Promise.all(
          currentPersonalItems.value
            .filter((item) => item.parentFreeActivityId === entry.id)
            .map((item) => store.deleteItem(item)),
        )
      }
      await store.deleteItem(entry)
      ElMessage.success(isFree ? '自由活動已刪除。' : '行程已刪除。')
    } catch (error) {
      if (error !== 'cancel' && error !== 'close') {
        ElMessage.error(error instanceof Error ? error.message : '無法刪除行程。')
      }
    }
  }

  async function toggleItinerary(entry: ItineraryItem) {
    if (!canEditTrip.value) {
      ElMessage.warning('Viewer 僅能查看行程，無法修改。')
      return
    }
    await store.toggleItem(entry.id)
  }

  function addFavoriteToItinerary(favoriteItem: Favorite) {
    if (!canEditTrip.value) {
      ElMessage.warning('Viewer 僅能查看旅遊收藏，無法修改。')
      return
    }
    favoriteItineraryRequestId.value = favoriteItem.id
    openItineraryTab?.()
  }

  function clearFavoriteRequest() {
    favoriteItineraryRequestId.value = ''
  }

  async function sortItineraryItems({
    date,
    oldIndex,
    newIndex,
  }: {
    date: string
    oldIndex: number
    newIndex: number
  }) {
    const entries = (itineraryDays.value.find((day) => day.date === date)?.entries || []).filter(
      (entry) => !entry.itineraryGroupId,
    )
    if (oldIndex < 0 || newIndex < 0 || oldIndex >= entries.length || newIndex >= entries.length) return
    const reordered = [...entries]
    const [moved] = reordered.splice(oldIndex, 1)
    if (!moved) return
    reordered.splice(newIndex, 0, moved)
    await store.reorderItems(reordered)
  }

  async function sortGroupItineraryItems({
    groupId,
    oldIndex,
    newIndex,
  }: {
    groupId: string
    oldIndex: number
    newIndex: number
  }) {
    const entries = items.value
      .filter((entry) => visibleGroupItems(groupId).some((item) => item.id === entry.id))
      .sort(
        (a, b) =>
          (a.order ?? Number.MAX_SAFE_INTEGER) -
            (b.order ?? Number.MAX_SAFE_INTEGER) ||
          compareItineraryTime(a, b),
      )
    if (oldIndex < 0 || newIndex < 0 || oldIndex >= entries.length || newIndex >= entries.length) return
    const reordered = [...entries]
    const [moved] = reordered.splice(oldIndex, 1)
    if (!moved) return
    reordered.splice(newIndex, 0, moved)
    await store.reorderItems(reordered)
  }

  async function sortPersonalItineraryItems({
    parentId,
    oldIndex,
    newIndex,
  }: {
    parentId: string
    oldIndex: number
    newIndex: number
  }) {
    const entries = currentPersonalItems.value
      .filter((entry) => entry.parentFreeActivityId === parentId)
      .sort(
        (a, b) =>
          (a.order ?? Number.MAX_SAFE_INTEGER) -
            (b.order ?? Number.MAX_SAFE_INTEGER) ||
          compareItineraryTime(a, b),
      )
    if (oldIndex < 0 || newIndex < 0 || oldIndex >= entries.length || newIndex >= entries.length) return
    const reordered = [...entries]
    const [moved] = reordered.splice(oldIndex, 1)
    if (!moved) return
    reordered.splice(newIndex, 0, moved)
    await store.reorderItems(reordered)
  }

  async function moveItineraryItem({
    itemId,
    from,
    to,
    oldIndex,
    newIndex,
  }: {
    itemId: string
    from: string
    to: string
    oldIndex: number
    newIndex: number
  }) {
    const entry = items.value.find((item) => item.id === itemId)
    if (!entry || entry.activityKind === 'free' || entry.activityKind === 'group') return

    const sourceIsPersonal = from.startsWith('personal:')
    const targetIsPersonal = to.startsWith('personal:')
    const sourceIsDay = from.startsWith('day:')
    const targetIsDay = to.startsWith('day:')
    const sourceIsGroup = from.startsWith('group:')
    const targetIsGroup = to.startsWith('group:')
    if ((!sourceIsPersonal && !sourceIsDay && !sourceIsGroup) || (!targetIsPersonal && !targetIsDay && !targetIsGroup)) {
      return
    }

    const byOrder = (a: ItineraryItem, b: ItineraryItem) =>
      (a.order ?? Number.MAX_SAFE_INTEGER) -
        (b.order ?? Number.MAX_SAFE_INTEGER) ||
      compareItineraryTime(a, b)

    const entriesFor = (scope: string) =>
      scope.startsWith('personal:')
        ? currentPersonalItems.value
            .filter((item) => item.parentFreeActivityId === scope.slice('personal:'.length))
            .sort(byOrder)
        : scope.startsWith('group:')
          ? items.value
              .filter((item) =>
                visibleGroupItems(scope.slice('group:'.length)).some((entry) => entry.id === item.id),
              )
              .sort(byOrder)
          : (itineraryDays.value.find((day) => day.date === scope.slice('day:'.length))?.entries || [])
              .filter((item) => !item.itineraryGroupId)
              .sort(byOrder)

    const sourceEntries = entriesFor(from)
    if (oldIndex < 0 || oldIndex >= sourceEntries.length || newIndex < 0) return
    const previous = { ...entry }
    let moved: ItineraryItem

    if (targetIsPersonal) {
      const parentFreeActivityId = to.slice('personal:'.length)
      const freeGroup = items.value.find(
        (item) => item.id === parentFreeActivityId && item.activityKind === 'free',
      )
      if (!freeGroup || !user.value?.uid) return
      moved = {
        ...entry,
        activityKind: 'personal',
        cardVisibility: 'shared',
        childVisibility: 'private',
        ownerId: user.value.uid,
        parentFreeActivityId,
        itineraryGroupId: '',
        date: freeGroup.date,
      }
    } else if (targetIsGroup) {
      const itineraryGroupId = to.slice('group:'.length)
      const placeGroup = items.value.find(
        (item) => item.id === itineraryGroupId && item.activityKind === 'group',
      )
      if (!placeGroup) return
      const { ownerId: _ownerId, parentFreeActivityId: _parentFreeActivityId, ...sharedEntry } = entry
      moved = {
        ...sharedEntry,
        activityKind: 'shared',
        ownerId: itemChildVisibility(placeGroup) === 'private' ? (user.value?.uid || placeGroup.ownerId || '') : '',
        parentFreeActivityId: '',
        itineraryGroupId,
        cardVisibility: 'shared',
        childVisibility: 'shared',
        date: placeGroup.date,
      }
    } else {
      const date = to.slice('day:'.length)
      const { ownerId: _ownerId, parentFreeActivityId: _parentFreeActivityId, ...sharedEntry } = entry
      moved = {
        ...sharedEntry,
        activityKind: 'shared',
        ownerId: '',
        parentFreeActivityId: '',
        itineraryGroupId: '',
        cardVisibility: 'shared',
        childVisibility: 'shared',
        date,
      }
    }

    const targetEntries = entriesFor(to).filter((item) => item.id !== entry.id)
    const reorderedSource = sourceEntries.filter((item) => item.id !== entry.id)
    const reorderedTarget = [...targetEntries]
    reorderedTarget.splice(Math.min(Math.max(newIndex, 0), reorderedTarget.length), 0, moved)

    await store.moveItem(moved, previous)
    if (reorderedSource.length) await store.reorderItems(reorderedSource)
    await store.reorderItems(reorderedTarget)
  }

  return {
    favoriteItineraryRequestId,
    currentPersonalItems,
    favoritesWithItineraryStatus,
    itineraryDays,
    mapsUrl,
    formatItineraryDate,
    itineraryDuration,
    itineraryTimeWarning,
    removeItem,
    toggleItinerary,
    addFavoriteToItinerary,
    clearFavoriteRequest,
    sortItineraryItems,
    sortGroupItineraryItems,
    sortPersonalItineraryItems,
    moveItineraryItem,
  }
}
