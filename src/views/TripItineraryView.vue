<script setup lang="ts">
import { computed, reactive, ref, watch, type Component } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, CollectionTag, UserFilled } from '@element-plus/icons-vue'
import TripItineraryCard from '../components/TripItineraryCard.vue'
import { estimateTransitFare, type TransitFareEstimateResult } from '../services/ai'
import { useTripStore } from '../stores/trip'
import type { Favorite, FavoriteType, ItineraryActivityKind, ItineraryItem, ItineraryVisibility, ShoppingItem, TransportFareConfidence, TransportFareSource, Trip } from '../types'

type Day = { date: string; entries: ItineraryItem[] }

const props = defineProps<{
  trip: Trip
  items: ItineraryItem[]
  favorites: Favorite[]
  userId: string
  favoriteRequestId?: string
  days: Day[]
  shoppingItems: ShoppingItem[]
  canEdit: boolean
  sortingEnabled: boolean
  formatDate: (date: string) => string
  duration: (entry: ItineraryItem) => string
  timeWarning: (entries: ItineraryItem[], index: number) => string
  mapsUrl: (location: string, mapUrl?: string) => string
}>()

const emit = defineEmits<{
  toggle: [entry: ItineraryItem]
  edit: [entry: ItineraryItem]
  remove: [entry: ItineraryItem]
  toggleSorting: []
  sort: [payload: { date: string; oldIndex: number; newIndex: number }]
  sortGroup: [payload: { groupId: string; oldIndex: number; newIndex: number }]
  move: [payload: { itemId: string; from: string; to: string; oldIndex: number; newIndex: number }]
  favoriteRequestConsumed: []
}>()

const store = useTripStore()
const groupColorOptions = [
  { label: '預設霧藍綠', value: '#8FBFC6' },
  { label: '森林綠', value: '#7FAF93' },
  { label: '暖杏黃', value: '#E2B96E' },
  { label: '柔霧紫', value: '#B8A4D6' },
  { label: '珊瑚橘', value: '#E99B86' },
  { label: '海鹽藍', value: '#8FB4D9' },
] as const
const showGroupForm = ref(false)
const editingGroupId = ref<string | null>(null)
const groupMemberIds = ref<string[]>([])
const itineraryGroup = reactive({ date: '', time: '', endTime: '', title: '', location: '', mapUrl: '', website: '', note: '', cardVisibility: 'shared' as ItineraryVisibility, childVisibility: 'shared' as ItineraryVisibility, groupColor: '' })
const showItem = ref(false)
const savingItem = ref(false)
const editingItemId = ref<string | null>(null)
const itemActivityKind = ref<ItineraryActivityKind>('shared')
const itemFormContext = ref<'default' | 'group-child'>('default')
const insertAfterItemId = ref<string | null>(null)
const pendingFavoriteId = ref<string | null>(null)
const itemFavoriteId = ref('')
const itemItineraryGroupId = ref('')
const itemFormGroupName = ref('')
const showFavoritePicker = ref(false)
const favoritePickerTarget = ref<'source' | 'destination'>('source')
const favoritePickerSearch = ref('')
const favoritePickerType = ref<FavoriteType | 'all'>('all')
const showFareEstimateDialog = ref(false)
const loadingFareEstimate = ref(false)
const savingFareEstimate = ref(false)
const fareEstimateTarget = ref<ItineraryItem | null>(null)
const fareEstimateResult = ref<TransitFareEstimateResult | null>(null)
const estimatingItemFare = ref(false)
const item = reactive({
  date: '',
  time: '',
  endTime: '',
  title: '',
  location: '',
  mapUrl: '',
  website: '',
  imageUrl: '',
  note: '',
  type: '景點',
  transportDestinationFavoriteId: '',
  transportDestinationName: '',
  transportDestinationLocation: '',
  transportDestinationMapUrl: '',
  transportFareAmount: undefined as number | undefined,
  transportFareCurrency: '',
  transportFareSource: '' as TransportFareSource | '',
  transportFareEstimateConfidence: undefined as TransportFareConfidence | undefined,
  transportFareEstimateReasoning: '',
  transportFareEstimateAssumptions: [] as string[],
  transportFareEstimatedAt: undefined as number | undefined,
  transportFareEstimateModel: '',
})
const favoritePickerOptions: Array<{ value: FavoriteType | 'all'; label: string }> = [{ value: 'all', label: '全部' }, { value: 'attraction', label: '景點' }, { value: 'restaurant', label: '餐廳' }, { value: 'transport', label: '交通' }, { value: 'stay', label: '住宿' }, { value: 'shop', label: '商店' }]
const activityKindOptions: Array<{
  value: ItineraryActivityKind
  label: string
  tag: string
  description: string
  icon: Component
}> = [
  {
    value: 'shared',
    label: '共用行程',
    tag: '多人共用',
    description: '所有旅伴都看得到，適合正式排定的共同活動。',
    icon: UserFilled,
  },
  {
    value: 'group',
    label: '群組卡',
    tag: '地點整理',
    description: '建立一張群組卡，把同一區域的多筆共用行程收在一起，之後也能繼續拖曳調整。',
    icon: CollectionTag,
  },
]
const itineraryGroupsForItem = computed(() => props.items.filter((entry) => entry.activityKind === 'group' && entry.date === item.date))
const groupSelectableEntries = computed(() =>
  props.items.filter(
    (entry) =>
      entry.date === itineraryGroup.date &&
      (entry.activityKind || 'shared') === 'shared',
  ),
)
const groupChildVisibilityLocked = computed(() => itineraryGroup.cardVisibility === 'private')
const groupChildVisibilityLabel = computed(() => itineraryGroup.cardVisibility === 'private' || itineraryGroup.childVisibility === 'private' ? '僅自己可見' : '所有旅伴可見')
const groupCardTypeLabel = computed(() => itemActivityKind.value === 'group' ? '群組卡' : '群組卡片')
const groupCardModeDescription = computed(() => itemActivityKind.value === 'group'
  ? '把同一區域的多筆共用行程整理進同一張群組卡，之後也能拖曳移入、移出與調整排序。'
  : '群組卡可用來承載同一段安排或同一區域的多筆內容。')
const groupCardVisibilitySummary = computed(() => {
  const cardText = itineraryGroup.cardVisibility === 'private' ? '卡片僅自己可見' : '卡片所有旅伴可見'
  const childText = itineraryGroup.cardVisibility === 'private' || itineraryGroup.childVisibility === 'private'
      ? '底下行程僅自己可見'
      : '底下行程所有旅伴可見'
  return `${cardText}・${childText}`
})
const filteredFavoritesForPicker = computed(() => { const keyword = favoritePickerSearch.value.trim().toLowerCase(); return props.favorites.filter((entry) => { const matchesType = favoritePickerType.value === 'all' || normalizeFavoriteType(entry.type) === favoritePickerType.value; const matchesSearch = !keyword || [entry.name, entry.location, entry.note].some((value) => value?.toLowerCase().includes(keyword)); return matchesType && matchesSearch }) })

function normalizeGoogleMapsUrl(value: string) {
  const raw = value.trim()
  if (!raw) return ''
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const hostname = new URL(normalized).hostname.toLowerCase()
    if (!/(^|\.)google\.[a-z.]+$/.test(hostname) && hostname !== 'maps.app.goo.gl' && hostname !== 'goo.gl') {
      throw new Error()
    }
    return normalized
  } catch {
    throw new Error('請貼上有效的 Google Maps 景點網址。')
  }
}
function normalizeHexColor(value: string) {
  const raw = value.trim()
  if (!raw) return ''
  const normalized = raw.startsWith('#') ? raw : `#${raw}`
  return /^#[0-9a-fA-F]{6}$/.test(normalized) ? normalized.toUpperCase() : ''
}
function normalizeUrl(value: string) {
  const raw = value.trim()
  return raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw
}

function normalizeFavoriteType(type: FavoriteType): FavoriteType { return type === 'cafe' ? 'restaurant' : type === 'alternative' || type === 'other' ? 'attraction' : type }
function favoriteToItineraryType(type: FavoriteType) { return ({ attraction: '景點', restaurant: '餐廳', transport: '交通', stay: '住宿', shop: '商店', cafe: '餐廳', alternative: '景點', other: '景點' } as Record<FavoriteType, string>)[type] }
function favoriteTypeLabel(type: FavoriteType) { return favoriteToItineraryType(type) }
function inferredFareSource(entry?: ItineraryItem): TransportFareSource | '' {
  if (!entry) return ''
  if (entry.transportFareSource) return entry.transportFareSource
  if (entry.transportFareEstimateModel?.startsWith('official-rule:')) return 'rule'
  if (typeof entry.transportFareEstimateAmount === 'number') return 'ai'
  return ''
}
function groupColorPreviewStyle(color = itineraryGroup.groupColor) {
  const normalized = normalizeHexColor(color)
  return normalized
    ? {
        background: `linear-gradient(135deg, ${normalized}1A 0%, ${normalized}12 100%)`,
        borderColor: `${normalized}4D`,
        color: normalized,
      }
    : {}
}
function resetGroupDraft(entry?: Partial<ItineraryItem>, entries: ItineraryItem[] = []) {
  const first = entries[0] || entry
  const uniqueLocations = [...new Set(entries.map((item) => (item.location || '').trim()).filter(Boolean))]
  const suggestedGroupLocation = uniqueLocations.length === 1 ? uniqueLocations[0] : ''
  Object.assign(
    itineraryGroup,
    entry
      ? {
          date: entry.date || props.trip.startDate || '',
          time: entry.time || '',
          endTime: entry.endTime || '',
          title: entry.title || '',
          location: entry.location || '',
          mapUrl: entry.mapUrl || '',
          website: entry.website || '',
          note: entry.note || '',
          cardVisibility: entry.cardVisibility || 'shared',
          childVisibility: entry.childVisibility || 'shared',
          groupColor: normalizeHexColor(entry.groupColor || ''),
        }
      : {
          date: first?.date || props.trip.startDate || '',
          time: '',
          endTime: '',
          title: '',
          location: suggestedGroupLocation,
          mapUrl: '',
          website: '',
          note: '',
          cardVisibility: 'shared',
          childVisibility: 'shared',
          groupColor: '',
        },
  )
}
function resetItem(entry?: ItineraryItem, favoriteId?: string) { const linkedFavoriteId = favoriteId || entry?.favoriteId || ''; pendingFavoriteId.value = linkedFavoriteId || null; itemFavoriteId.value = linkedFavoriteId; itemItineraryGroupId.value = entry?.itineraryGroupId || ''; editingItemId.value = entry?.id || null; Object.assign(item, entry ? { date: entry.date, time: entry.time, endTime: entry.endTime || '', title: entry.title, location: entry.location, mapUrl: entry.mapUrl || '', website: entry.website || '', imageUrl: entry.imageUrl || '', note: entry.note || '', type: entry.type, transportDestinationFavoriteId: entry.transportDestinationFavoriteId || '', transportDestinationName: entry.transportDestinationName || '', transportDestinationLocation: entry.transportDestinationLocation || '', transportDestinationMapUrl: entry.transportDestinationMapUrl || '', transportFareAmount: entry.transportFareAmount ?? entry.transportFareEstimateAmount, transportFareCurrency: entry.transportFareCurrency || entry.transportFareEstimateCurrency || props.trip.currency, transportFareSource: inferredFareSource(entry), transportFareEstimateConfidence: entry.transportFareEstimateConfidence, transportFareEstimateReasoning: entry.transportFareEstimateReasoning || '', transportFareEstimateAssumptions: entry.transportFareEstimateAssumptions || [], transportFareEstimatedAt: entry.transportFareEstimatedAt, transportFareEstimateModel: entry.transportFareEstimateModel || '' } : { date: '', time: '', endTime: '', title: '', location: '', mapUrl: '', website: '', imageUrl: '', note: '', type: '景點', transportDestinationFavoriteId: '', transportDestinationName: '', transportDestinationLocation: '', transportDestinationMapUrl: '', transportFareAmount: undefined, transportFareCurrency: props.trip.currency, transportFareSource: '', transportFareEstimateConfidence: undefined, transportFareEstimateReasoning: '', transportFareEstimateAssumptions: [], transportFareEstimatedAt: undefined, transportFareEstimateModel: '' }) }
function openNewItemForm() { if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); itemActivityKind.value = 'shared'; itemFormContext.value = 'default'; itemFormGroupName.value = ''; insertAfterItemId.value = null; editingGroupId.value = null; groupMemberIds.value = []; resetItem(); resetGroupDraft(); showItem.value = true }
function openItemFormForEdit(entry: ItineraryItem) { if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); itemActivityKind.value = entry.activityKind || 'shared'; itemFormContext.value = 'default'; itemFormGroupName.value = ''; insertAfterItemId.value = null; resetItem(entry); if (entry.activityKind === 'group') resetGroupDraft(entry); showItem.value = true }
function openGroupItemForm(group: ItineraryItem) { if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); itemActivityKind.value = 'shared'; itemFormContext.value = 'group-child'; itemFormGroupName.value = group.title || '未命名群組'; insertAfterItemId.value = null; resetItem(); item.date = group.date; itemItineraryGroupId.value = group.id; showItem.value = true }
function openItemFormAfter(entry: ItineraryItem) { if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看行程，無法修改。'); itemActivityKind.value = 'shared'; itemFormContext.value = 'default'; itemFormGroupName.value = ''; insertAfterItemId.value = entry.id; resetItem(); itemItineraryGroupId.value = entry.itineraryGroupId || ''; item.date = entry.date; showItem.value = true }
function openFavoritePicker(target: 'source' | 'destination' = 'source') { favoritePickerTarget.value = target; favoritePickerSearch.value = ''; favoritePickerType.value = 'all'; showFavoritePicker.value = true }
function applyFavoriteToItem(favoriteId: string) { const selected = props.favorites.find((entry) => entry.id === favoriteId); if (!selected) return; const type = favoriteToItineraryType(selected.type); itemFavoriteId.value = selected.id; pendingFavoriteId.value = selected.id; Object.assign(item, { title: selected.name, location: selected.location || '', mapUrl: selected.mapUrl || '', website: selected.website || '', imageUrl: selected.imageUrl || '', type }); if (type !== '交通') Object.assign(item, { transportDestinationFavoriteId: '', transportDestinationName: '', transportDestinationLocation: '', transportDestinationMapUrl: '' }) }
function selectFavoriteForItem(favoriteId: string) { const selected = props.favorites.find((entry) => entry.id === favoriteId); if (!selected) return; if (favoritePickerTarget.value === 'destination') Object.assign(item, { transportDestinationFavoriteId: selected.id, transportDestinationName: selected.name, transportDestinationLocation: selected.location || '', transportDestinationMapUrl: selected.mapUrl || '' }); else applyFavoriteToItem(favoriteId); showFavoritePicker.value = false }
function didTransportFareInputsChange(existing?: ItineraryItem, normalizedMapUrl = '', normalizedDestinationMapUrl = '') {
  if (!existing) return false
  return existing.type !== item.type || existing.title !== item.title.trim() || (existing.location || '') !== item.location.trim() || (existing.mapUrl || '') !== normalizedMapUrl || (existing.transportDestinationName || '') !== item.transportDestinationName.trim() || (existing.transportDestinationLocation || '') !== item.transportDestinationLocation.trim() || (existing.transportDestinationMapUrl || '') !== normalizedDestinationMapUrl
}
function clearItemFareMeta() {
  item.transportFareSource = ''
  item.transportFareEstimateConfidence = undefined
  item.transportFareEstimateReasoning = ''
  item.transportFareEstimateAssumptions = []
  item.transportFareEstimatedAt = undefined
  item.transportFareEstimateModel = ''
}
function transportFareSourceLabel(source: TransportFareSource | '') {
  return source === 'rule' ? '官方規則已帶入' : source === 'ai' ? 'AI 已帶入' : '手動輸入'
}
function transportFareSourceHint(source: TransportFareSource | '') {
  if (source === 'rule') return '已依官方票價規則帶入；你仍可直接改數字。'
  if (source === 'ai') return '已依目前出發地與抵達地帶入 AI 估算；你仍可直接改數字。'
  return '可直接手動輸入，或先設定出發地與抵達地後使用估算。'
}
function setManualTransportFare(value?: number | null) {
  item.transportFareAmount = typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
  item.transportFareCurrency = props.trip.currency
  if (item.transportFareAmount == null) {
    clearItemFareMeta()
    return
  }
  item.transportFareSource = 'manual'
  item.transportFareEstimateConfidence = undefined
  item.transportFareEstimateReasoning = ''
  item.transportFareEstimateAssumptions = []
  item.transportFareEstimatedAt = undefined
  item.transportFareEstimateModel = ''
}
const canEstimateDraftTransportFare = computed(() => item.type === '交通' && !!(item.location.trim() || item.title.trim()) && !!(item.transportDestinationLocation.trim() || item.transportDestinationName.trim()))
async function estimateTransportFareForForm() {
  if (estimatingItemFare.value) return
  if (!canEstimateDraftTransportFare.value) return ElMessage.warning('請先設定出發地與抵達地，再進行 AI 估算。')
  estimatingItemFare.value = true
  try {
    const result = await estimateTransitFare({
      tripId: props.trip.id,
      country: props.trip.country,
      city: props.trip.city,
      currency: props.trip.currency,
      date: item.date || props.trip.startDate,
      title: item.title.trim(),
      departureName: item.title.trim(),
      departureLocation: item.location.trim() || item.title.trim(),
      departureMapUrl: item.mapUrl.trim(),
      destinationName: item.transportDestinationName.trim(),
      destinationLocation: item.transportDestinationLocation.trim(),
      destinationMapUrl: item.transportDestinationMapUrl.trim(),
      note: item.note.trim(),
    })
    item.transportFareAmount = result.amount
    item.transportFareCurrency = result.currency
    item.transportFareSource = result.source
    item.transportFareEstimateConfidence = result.confidence
    item.transportFareEstimateReasoning = result.reasoning
    item.transportFareEstimateAssumptions = result.assumptions
    item.transportFareEstimatedAt = Date.parse(result.estimatedAt)
    item.transportFareEstimateModel = result.model
    ElMessage.success(result.source === 'rule' ? '已帶入官方規則估算交通費，可再自行調整。' : '已帶入 AI 估算交通費，可再自行調整。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '交通費估算失敗。')
  } finally {
    estimatingItemFare.value = false
  }
}
async function saveItem() {
  if (savingItem.value) return
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看行程，無法修改。')
  if (itemActivityKind.value === 'group') {
    await saveGroup({ closeItemDialog: true })
    return
  }
  if (!item.title.trim() || !item.date) return ElMessage.warning('請填寫行程名稱與日期。')
  if (item.endTime && item.time && item.endTime <= item.time) return ElMessage.warning('結束時間必須晚於開始時間。')
  const kind = itemActivityKind.value
  const sameLevelItems = props.items
  const conflict = sameLevelItems.some((entry) => entry.id !== editingItemId.value && entry.date === item.date && item.time && entry.time && entry.time < (item.endTime || item.time) && (entry.endTime || entry.time) > item.time)
  if (conflict) return ElMessage.warning('此時段與既有行程重疊，請調整時間。')
  savingItem.value = true
  try {
    const existing = editingItemId.value ? props.items.find((entry) => entry.id === editingItemId.value) : undefined
    const selectedGroup = itemItineraryGroupId.value
      ? props.items.find((entry) => entry.id === itemItineraryGroupId.value && entry.activityKind === 'group')
      : undefined
    const sharedOwnerId = selectedGroup?.childVisibility === 'private' ? (props.userId || props.trip.ownerId) : ''
    const rawImage = item.imageUrl.trim()
    const normalizedWebsite = normalizeUrl(item.website)
    const normalizedMapUrl = normalizeGoogleMapsUrl(item.mapUrl)
    const normalizedDestinationMapUrl = item.type === '交通' ? normalizeGoogleMapsUrl(item.transportDestinationMapUrl) : ''
    let payload = {
      ...item,
      title: item.title.trim(),
      type: item.type,
      location: item.location.trim(),
      mapUrl: normalizedMapUrl,
      website: normalizedWebsite,
      imageUrl: rawImage && !/^https?:\/\//i.test(rawImage) ? `https://${rawImage}` : rawImage,
      note: item.note.trim(),
      activityKind: kind,
      cardVisibility: 'shared' as ItineraryVisibility,
      childVisibility: 'shared' as ItineraryVisibility,
      itineraryGroupId: itemItineraryGroupId.value,
      ownerId: sharedOwnerId,
      favoriteId: pendingFavoriteId.value || existing?.favoriteId || '',
      transportDestinationMapUrl: normalizedDestinationMapUrl,
      transportDestinationFavoriteId: item.type === '交通' ? item.transportDestinationFavoriteId : '',
      transportDestinationName: item.type === '交通' ? item.transportDestinationName.trim() : '',
      transportDestinationLocation: item.type === '交通' ? item.transportDestinationLocation.trim() : '',
      transportFareAmount: item.type === '交通' && typeof item.transportFareAmount === 'number' && Number.isFinite(item.transportFareAmount) && item.transportFareAmount > 0 ? item.transportFareAmount : undefined,
      transportFareCurrency: item.type === '交通' && typeof item.transportFareAmount === 'number' && Number.isFinite(item.transportFareAmount) && item.transportFareAmount > 0 ? (item.transportFareCurrency || props.trip.currency) : undefined,
      transportFareSource: item.type === '交通' && typeof item.transportFareAmount === 'number' && Number.isFinite(item.transportFareAmount) && item.transportFareAmount > 0 ? (item.transportFareSource || 'manual') : undefined,
      transportFareEstimateAmount: item.type === '交通' && item.transportFareSource && item.transportFareSource !== 'manual' && typeof item.transportFareAmount === 'number' && Number.isFinite(item.transportFareAmount) && item.transportFareAmount > 0 ? item.transportFareAmount : undefined,
      transportFareEstimateCurrency: item.type === '交通' && item.transportFareSource && item.transportFareSource !== 'manual' && typeof item.transportFareAmount === 'number' && Number.isFinite(item.transportFareAmount) && item.transportFareAmount > 0 ? (item.transportFareCurrency || props.trip.currency) : undefined,
      transportFareEstimateConfidence: item.type === '交通' && item.transportFareSource && item.transportFareSource !== 'manual' ? item.transportFareEstimateConfidence : undefined,
      transportFareEstimateReasoning: item.type === '交通' && item.transportFareSource && item.transportFareSource !== 'manual' ? item.transportFareEstimateReasoning.trim() : undefined,
      transportFareEstimateAssumptions: item.type === '交通' && item.transportFareSource && item.transportFareSource !== 'manual' ? item.transportFareEstimateAssumptions : undefined,
      transportFareEstimatedAt: item.type === '交通' && item.transportFareSource && item.transportFareSource !== 'manual' ? item.transportFareEstimatedAt : undefined,
      transportFareEstimateModel: item.type === '交通' && item.transportFareSource && item.transportFareSource !== 'manual' ? item.transportFareEstimateModel : undefined,
    }
    const shouldResetFareEstimate = Boolean(existing && existing.transportFareSource && existing.transportFareSource !== 'manual' && (payload.type !== '交通' || didTransportFareInputsChange(existing, normalizedMapUrl, normalizedDestinationMapUrl)))
    if (existing) {
      const baseExisting = shouldResetFareEstimate ? (({ transportFareAmount, transportFareCurrency, transportFareSource, transportFareEstimateAmount, transportFareEstimateCurrency, transportFareEstimateConfidence, transportFareEstimateReasoning, transportFareEstimateAssumptions, transportFareEstimatedAt, transportFareEstimateModel, ...rest }) => rest)(existing) : existing
      await store.updateItem({ ...baseExisting, ...payload })
    }
    else {
      const ordered = sameLevelItems.filter((entry) => entry.date === item.date).sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || (a.time || '').localeCompare(b.time || ''))
      const afterIndex = insertAfterItemId.value ? ordered.findIndex((entry) => entry.id === insertAfterItemId.value) : -1
      const insertIndex = afterIndex >= 0 ? afterIndex + 1 : ordered.length
      const added = await store.addItem({ tripId: props.trip.id, ...payload, order: insertIndex })
      if (afterIndex >= 0) {
        const reordered = [...ordered]
        reordered.splice(insertIndex, 0, added)
        await store.reorderItems(reordered)
      }
      const savedFavorite = pendingFavoriteId.value ? props.favorites.find((entry) => entry.id === pendingFavoriteId.value) : undefined
      if (savedFavorite) await store.updateFavorite({ ...savedFavorite, addedToItinerary: true })
    }
    showItem.value = false
    editingItemId.value = null
    insertAfterItemId.value = null
    pendingFavoriteId.value = null
    itemActivityKind.value = 'shared'
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法儲存行程。')
  } finally {
    savingItem.value = false
  }
}
watch(() => props.favoriteRequestId, (favoriteId) => { if (!favoriteId) return; openNewItemForm(); item.date = props.trip.startDate; applyFavoriteToItem(favoriteId); emit('favoriteRequestConsumed') }, { immediate: true })
watch(itemActivityKind, (kind) => {
  if (kind !== 'group') return
  resetGroupDraft()
  itineraryGroup.date = item.date || itineraryGroup.date || props.trip.startDate || ''
  itineraryGroup.title = item.title.trim() || itineraryGroup.title
  itineraryGroup.location = item.location.trim() || itineraryGroup.location
  itineraryGroup.mapUrl = item.mapUrl.trim() || itineraryGroup.mapUrl
  itineraryGroup.website = item.website.trim() || itineraryGroup.website
  itineraryGroup.note = item.note.trim() || itineraryGroup.note
})

function fareEstimateRouteSummary(entry: ItineraryItem) {
  return `${entry.location || entry.title} → ${entry.transportDestinationLocation || entry.transportDestinationName || '未設定抵達地'}`
}

async function openFareEstimate(entry: ItineraryItem) {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看行程，無法修改。')
  if (entry.type !== '交通') return ElMessage.warning('目前僅支援交通類型的票價估算。')
  if (!(entry.location || entry.title).trim() || !(entry.transportDestinationLocation || entry.transportDestinationName || '').trim()) {
    return ElMessage.warning('請先設定出發地與抵達地，再進行票價估算。')
  }
  fareEstimateTarget.value = entry
  fareEstimateResult.value = null
  showFareEstimateDialog.value = true
  loadingFareEstimate.value = true
  try {
    fareEstimateResult.value = await estimateTransitFare({
      tripId: props.trip.id,
      country: props.trip.country,
      city: props.trip.city,
      currency: props.trip.currency,
      date: entry.date || props.trip.startDate,
      title: entry.title,
      departureName: entry.title,
      departureLocation: entry.location || entry.title,
      departureMapUrl: entry.mapUrl || '',
      destinationName: entry.transportDestinationName || '',
      destinationLocation: entry.transportDestinationLocation || '',
      destinationMapUrl: entry.transportDestinationMapUrl || '',
      note: entry.note || '',
    })
  } catch (error) {
    showFareEstimateDialog.value = false
    fareEstimateTarget.value = null
    ElMessage.error(error instanceof Error ? error.message : '票價估算失敗。')
  } finally {
    loadingFareEstimate.value = false
  }
}

async function confirmFareEstimate() {
  if (!fareEstimateTarget.value || !fareEstimateResult.value || savingFareEstimate.value) return
  savingFareEstimate.value = true
  try {
    await store.updateItem({
      ...fareEstimateTarget.value,
      transportFareAmount: fareEstimateResult.value.amount,
      transportFareCurrency: fareEstimateResult.value.currency,
      transportFareSource: fareEstimateResult.value.source,
      transportFareEstimateAmount: fareEstimateResult.value.amount,
      transportFareEstimateCurrency: fareEstimateResult.value.currency,
      transportFareEstimateConfidence: fareEstimateResult.value.confidence,
      transportFareEstimateReasoning: fareEstimateResult.value.reasoning,
      transportFareEstimateAssumptions: fareEstimateResult.value.assumptions,
      transportFareEstimatedAt: Date.parse(fareEstimateResult.value.estimatedAt),
      transportFareEstimateModel: fareEstimateResult.value.model,
    })
    ElMessage.success(fareEstimateResult.value.source === 'rule' ? '已將官方規則票價寫回行程。' : '已將 AI 票價估算寫回行程。')
    showFareEstimateDialog.value = false
    fareEstimateTarget.value = null
    fareEstimateResult.value = null
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法儲存票價估算。')
  } finally {
    savingFareEstimate.value = false
  }
}

function openGroupForm(entries: ItineraryItem[] = [], existing?: ItineraryItem) {
  if (!props.canEdit) {
    ElMessage.warning('Viewer 僅能查看行程，無法修改。')
    return
  }
  editingGroupId.value = existing?.id || null
  groupMemberIds.value = existing
    ? props.items.filter((item) => item.itineraryGroupId === existing.id).map((item) => item.id)
    : entries.map((item) => item.id)
  resetGroupDraft(existing, entries)
  showGroupForm.value = true
}

async function saveGroup(options?: { closeItemDialog?: boolean }) {
  if (!itineraryGroup.title.trim() || !itineraryGroup.date) {
    ElMessage.warning('請填寫群組名稱與日期。')
    return
  }
  if (itineraryGroup.endTime && itineraryGroup.time && itineraryGroup.endTime <= itineraryGroup.time) {
    ElMessage.warning('群組結束時間必須晚於開始時間。')
    return
  }

  try {
    const existing = editingGroupId.value ? props.items.find((item) => item.id === editingGroupId.value) : undefined
    const payload = {
      tripId: props.trip.id,
      date: itineraryGroup.date,
      time: itineraryGroup.time || '',
      endTime: itineraryGroup.endTime || '',
      title: itineraryGroup.title.trim(),
      location: itineraryGroup.location.trim(),
      mapUrl: normalizeGoogleMapsUrl(itineraryGroup.mapUrl),
      website: normalizeUrl(itineraryGroup.website),
      imageUrl: '',
      note: itineraryGroup.note.trim(),
      type: '群組卡',
      activityKind: 'group' as const,
      cardVisibility: itineraryGroup.cardVisibility,
      childVisibility: itineraryGroup.childVisibility,
      groupColor: normalizeHexColor(itineraryGroup.groupColor),
      ownerId: props.userId || props.trip.ownerId,
    }
    const group = existing
      ? { ...existing, ...payload }
      : await store.addItem({
          ...payload,
          order: props.items.filter((item) => item.date === itineraryGroup.date && !item.itineraryGroupId).length,
        })

    if (existing) await store.updateItem(group)

    const selected = new Set(groupMemberIds.value)
    await Promise.all(
      props.items
        .filter(
          (item) =>
            item.date === itineraryGroup.date &&
            item.id !== group.id &&
            (item.activityKind || 'shared') === 'shared' &&
            (item.itineraryGroupId === group.id || selected.has(item.id)),
        )
        .map((item) =>
          store.updateItem({
            ...item,
            itineraryGroupId: selected.has(item.id) ? group.id : '',
            ownerId: selected.has(item.id) && itineraryGroup.childVisibility === 'private'
              ? (props.userId || props.trip.ownerId)
              : item.itineraryGroupId === group.id && itineraryGroup.childVisibility !== 'private'
                ? ''
                : item.ownerId || '',
          }),
        ),
    )
    showGroupForm.value = false
    if (options?.closeItemDialog) {
      showItem.value = false
      resetItem()
      itemActivityKind.value = 'shared'
      insertAfterItemId.value = null
      pendingFavoriteId.value = null
    }
    editingGroupId.value = null
    groupMemberIds.value = []
    resetGroupDraft()
    ElMessage.success(existing ? '群組卡已更新。' : '已建立群組卡。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法儲存群組卡。')
  }
}

async function dissolveGroup(group: ItineraryItem) {
  if (!props.canEdit) return
  try {
    await ElMessageBox.confirm(`解散「${group.title}」後，群組內行程會保留為一般行程。`, '解散群組卡', {
      confirmButtonText: '解散群組卡',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await Promise.all(
      props.items
        .filter((item) => item.itineraryGroupId === group.id)
        .map((item) => store.updateItem({ ...item, itineraryGroupId: '' })),
    )
    await store.deleteItem(group)
    ElMessage.success('群組卡已解散，原行程已保留。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '無法解散群組卡。')
    }
  }
}

async function deleteGroup(group: ItineraryItem) {
  if (!props.canEdit) return
  const members = props.items.filter((item) => item.itineraryGroupId === group.id)
  try {
    await ElMessageBox.confirm(
      `確定刪除群組卡「${group.title}」嗎？群組內 ${members.length} 筆行程也會一併刪除。`,
      '刪除群組卡',
      {
        confirmButtonText: '刪除群組卡',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    await Promise.all(members.map((item) => store.deleteItem(item)))
    await store.deleteItem(group)
    ElMessage.success('群組卡與群組內行程已刪除。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '無法刪除群組卡。')
    }
  }
}

async function toggleGroupCardVisibility(group: ItineraryItem) {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看行程，無法修改。')
  const nextVisibility: ItineraryVisibility = group.cardVisibility === 'private' ? 'shared' : 'private'
  try {
    await store.updateItem({
      ...group,
      cardVisibility: nextVisibility,
      ownerId: props.userId || props.trip.ownerId,
    })
    ElMessage.success(nextVisibility === 'private' ? '群組卡已改為僅自己可見。' : '群組卡已改為所有旅伴可見。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法更新群組卡可見性。')
  }
}

async function toggleGroupChildVisibility(group: ItineraryItem) {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看行程，無法修改。')
  if (group.activityKind !== 'group') return
  const nextVisibility: ItineraryVisibility = group.childVisibility === 'private' ? 'shared' : 'private'
  const members = props.items.filter((item) => item.itineraryGroupId === group.id)
  try {
    await Promise.all([
      store.updateItem({
        ...group,
        childVisibility: nextVisibility,
        ownerId: props.userId || props.trip.ownerId,
      }),
      ...members.map((item) =>
        store.updateItem({
          ...item,
          ownerId: nextVisibility === 'private' ? (props.userId || props.trip.ownerId) : '',
        }),
      ),
    ])
    ElMessage.success(nextVisibility === 'private' ? '群組內行程已改為僅自己可見。' : '群組內行程已改為所有旅伴可見。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法更新群組內行程可見性。')
  }
}

async function bulkRemoveEntries(entries: ItineraryItem[]) {
  if (!props.canEdit) return
  const uniqueEntries = entries.filter(
    (entry, index, source) => source.findIndex((item) => item.id === entry.id) === index,
  )
  if (!uniqueEntries.length) return
  try {
    await ElMessageBox.confirm(
      `確定刪除已選取的 ${uniqueEntries.length} 筆行程嗎？此操作無法復原。`,
      '批次刪除行程',
      {
        confirmButtonText: '刪除所選行程',
        cancelButtonText: '取消',
        type: 'warning',
      },
    )
    await Promise.all(uniqueEntries.map((entry) => store.deleteItem(entry)))
    ElMessage.success(`已刪除 ${uniqueEntries.length} 筆行程。`)
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '無法批次刪除行程。')
    }
  }
}
</script>

<template>
  <section class="trip-itinerary-view" aria-label="每日行程">
    <TripItineraryCard
      :days="days"
      :shopping-items="shoppingItems"
      :current-user-id="userId"
      :can-edit-trip="canEdit"
      :sorting-enabled="sortingEnabled"
      :format-date="formatDate"
      :duration="duration"
      :time-warning="timeWarning"
      :maps-url="mapsUrl"
      @add="openNewItemForm"
      @add-after="openItemFormAfter"
      @add-group-item="openGroupItemForm"
      @toggle="emit('toggle', $event)"
      @edit="openItemFormForEdit"
      @remove="emit('remove', $event)"
      @create-group="openGroupForm($event.entries)"
      @edit-group="openGroupForm([], $event)"
      @toggle-group-card-visibility="toggleGroupCardVisibility"
      @toggle-group-child-visibility="toggleGroupChildVisibility"
      @dissolve-group="dissolveGroup"
      @delete-group="deleteGroup"
      @bulk-remove="bulkRemoveEntries"
      @estimate-fare="openFareEstimate"
      @toggle-sorting="emit('toggleSorting')"
      @sort="emit('sort', $event)"
      @sort-group="emit('sortGroup', $event)"
      @move="emit('move', $event)"
    />

    <el-dialog v-model="showGroupForm" :title="editingGroupId ? '編輯群組卡' : '建立群組卡'" class="itinerary-group-dialog" width="min(92vw, 560px)">
      <el-form label-position="top">
        <div class="two-col">
          <el-form-item label="群組名稱"><el-input v-model="itineraryGroup.title" placeholder="例如：築地市場探索" /></el-form-item>
          <el-form-item label="區域／地點"><el-input v-model="itineraryGroup.location" placeholder="例如：築地市場" /></el-form-item>
        </div>
        <div class="three-col">
          <el-form-item label="日期"><el-date-picker v-model="itineraryGroup.date" type="date" value-format="YYYY-MM-DD" /></el-form-item>
          <el-form-item label="固定開始時間（選填）"><el-time-picker v-model="itineraryGroup.time" value-format="HH:mm" format="HH:mm" placeholder="未排時間" /></el-form-item>
          <el-form-item label="結束時間（選填）"><el-time-picker v-model="itineraryGroup.endTime" value-format="HH:mm" format="HH:mm" placeholder="選填" /></el-form-item>
        </div>
        <div class="two-col">
          <el-form-item label="群組卡片可見性">
            <el-radio-group v-model="itineraryGroup.cardVisibility">
              <el-radio-button label="shared">所有旅伴可見</el-radio-button>
              <el-radio-button label="private">僅自己可見</el-radio-button>
            </el-radio-group>
            <small>控制整張群組卡誰看得到；若設為僅自己可見，其他旅伴不會看到這張群組卡。</small>
          </el-form-item>
          <el-form-item label="群組內行程可見性">
            <template v-if="groupChildVisibilityLocked">
              <div class="itinerary-group-visibility-lock">
                <strong>{{ groupChildVisibilityLabel }}</strong>
                <small>因為整張群組卡已設為僅自己可見，底下行程會自動跟著維持私人顯示。</small>
              </div>
            </template>
            <template v-else>
              <el-radio-group v-model="itineraryGroup.childVisibility">
                <el-radio-button label="shared">所有旅伴可見</el-radio-button>
                <el-radio-button label="private">僅自己可見</el-radio-button>
              </el-radio-group>
              <small>控制群組底下子行程的可見範圍；設為私人時，群組內共用行程會只顯示給你。</small>
            </template>
          </el-form-item>
        </div>
        <el-form-item label="群組卡顏色（選填）">
          <div class="itinerary-group-color-field">
            <div class="itinerary-group-color-swatches" role="list" aria-label="選擇群組卡顏色">
              <button
                v-for="option in groupColorOptions"
                :key="option.value"
                type="button"
                class="itinerary-group-color-swatch"
                :class="{ 'is-active': normalizeHexColor(itineraryGroup.groupColor) === option.value }"
                :style="{ '--swatch-color': option.value }"
                :title="option.label"
                @click="itineraryGroup.groupColor = option.value"
              >
                <span class="itinerary-group-color-swatch-dot" aria-hidden="true"></span>
                <span>{{ option.label }}</span>
              </button>
              <button
                type="button"
                class="itinerary-group-color-swatch is-default"
                :class="{ 'is-active': !normalizeHexColor(itineraryGroup.groupColor) }"
                title="使用系統預設群組色"
                @click="itineraryGroup.groupColor = ''"
              >
                <span class="itinerary-group-color-swatch-dot" aria-hidden="true"></span>
                <span>系統預設</span>
              </button>
            </div>
            <div class="itinerary-group-color-tools">
              <el-color-picker v-model="itineraryGroup.groupColor" color-format="hex" />
              <small>可直接選色；留白則沿用目前群組卡預設色。</small>
            </div>
            <div class="itinerary-group-color-preview" :style="groupColorPreviewStyle()">
              <span class="itinerary-group-color-preview-tag">群組卡預覽</span>
              <strong>{{ itineraryGroup.title || '群組卡名稱預覽' }}</strong>
              <p>{{ itineraryGroup.location || '未設定區域' }}</p>
            </div>
          </div>
        </el-form-item>
        <el-form-item label="Google Maps 區域連結（選填）"><el-input v-model="itineraryGroup.mapUrl" placeholder="貼上 Google Maps 區域或地點網址" /></el-form-item>
        <el-form-item label="群組網站（選填）"><el-input v-model="itineraryGroup.website" placeholder="例如：https://example.com" /><small>可放區域介紹、商圈官網或整理頁面，會顯示在群組卡片上。</small></el-form-item>
        <el-form-item label="群組備註（選填）"><el-input v-model="itineraryGroup.note" type="textarea" :rows="2" maxlength="200" show-word-limit /></el-form-item>
        <el-form-item label="群組內行程">
          <el-checkbox-group v-model="groupMemberIds" class="itinerary-group-member-selector">
            <el-checkbox v-for="entry in items.filter((entry) => entry.date === itineraryGroup.date && (entry.activityKind || 'shared') === 'shared')" :key="entry.id" :label="entry.id">
              {{ entry.title }}<small>{{ entry.time || '未排時間' }}・{{ entry.type }}</small>
            </el-checkbox>
          </el-checkbox-group>
          <small>可勾選或取消行程，儲存後會移入或移出這個群組。</small>
        </el-form-item>
      </el-form>
      <template #footer><el-button @click="showGroupForm = false">取消</el-button><el-button type="primary" @click="saveGroup">儲存群組卡</el-button></template>
    </el-dialog>

    <el-dialog v-model="showItem" :title="editingItemId ? `編輯${itemActivityKind === 'group' ? '群組卡' : '行程'}` : itemFormContext === 'group-child' ? '新增群組行程' : itemActivityKind === 'group' ? '新增群組卡' : '新增行程'" class="itinerary-dialog" width="min(92vw, 520px)">
      <el-form class="itinerary-form" label-position="top">
        <el-form-item v-if="!editingItemId && itemFormContext !== 'group-child'" label="行程安排方式">
          <div class="itinerary-activity-kind" role="radiogroup" aria-label="選擇行程安排方式">
            <button
              v-for="option in activityKindOptions"
              :key="option.value"
              type="button"
              class="itinerary-activity-card"
              :class="{ 'is-active': itemActivityKind === option.value }"
              role="radio"
              :aria-checked="itemActivityKind === option.value"
              @click="itemActivityKind = option.value"
            >
              <span class="itinerary-activity-card-top">
                <span class="itinerary-activity-card-heading">
                  <span class="itinerary-activity-card-icon" aria-hidden="true">
                    <el-icon><component :is="option.icon" /></el-icon>
                  </span>
                  <strong>{{ option.label }}</strong>
                </span>
                <span class="itinerary-activity-card-meta">
                  <span class="itinerary-activity-card-tag">{{ option.tag }}</span>
                  <span v-if="itemActivityKind === option.value" class="itinerary-activity-card-check" aria-hidden="true">
                    <el-icon><Check /></el-icon>
                  </span>
                </span>
              </span>
              <span class="itinerary-activity-card-description">{{ option.description }}</span>
            </button>
          </div>
          <small>{{ itemActivityKind === 'group' ? '群組卡適合整理同區域的共用行程，之後也能繼續拖曳調整。' : '共用行程會顯示給所有旅伴，並可從旅遊收藏快速帶入。' }}</small>
        </el-form-item>
        <template v-if="itemActivityKind === 'group'">
          <div class="itinerary-group-mode-summary">
            <span class="itinerary-group-mode-kicker">{{ groupCardTypeLabel }}</span>
            <strong>{{ itemActivityKind === 'group' ? '整理同地點的共用行程' : '讓每位旅伴安排自己的時間' }}</strong>
            <p>{{ groupCardModeDescription }}</p>
            <small>{{ groupCardVisibilitySummary }}</small>
          </div>
          <div class="two-col">
            <el-form-item label="群組名稱"><el-input v-model="itineraryGroup.title" placeholder="例如：築地市場探索" /></el-form-item>
            <el-form-item label="區域／地點"><el-input v-model="itineraryGroup.location" placeholder="例如：築地市場" /></el-form-item>
          </div>
          <div class="three-col">
            <el-form-item label="日期"><el-date-picker v-model="itineraryGroup.date" type="date" value-format="YYYY-MM-DD" placeholder="選擇日期" /></el-form-item>
            <el-form-item label="固定開始時間（選填）"><el-time-picker v-model="itineraryGroup.time" value-format="HH:mm" format="HH:mm" placeholder="未排時間" /></el-form-item>
            <el-form-item label="結束時間（選填）"><el-time-picker v-model="itineraryGroup.endTime" value-format="HH:mm" format="HH:mm" placeholder="選填" /></el-form-item>
          </div>
          <div class="two-col">
            <el-form-item label="群組卡片可見性">
              <el-radio-group v-model="itineraryGroup.cardVisibility">
                <el-radio-button label="shared">所有旅伴可見</el-radio-button>
                <el-radio-button label="private">僅自己可見</el-radio-button>
              </el-radio-group>
              <small>控制整張群組卡誰看得到；若設為僅自己可見，其他旅伴不會看到這張群組卡。</small>
            </el-form-item>
            <el-form-item label="群組內行程可見性">
              <template v-if="groupChildVisibilityLocked">
                <div class="itinerary-group-visibility-lock">
                  <strong>{{ groupChildVisibilityLabel }}</strong>
                  <small>因為整張群組卡已設為僅自己可見，底下行程會自動跟著維持私人顯示。</small>
                </div>
              </template>
              <template v-else>
                <el-radio-group v-model="itineraryGroup.childVisibility">
                  <el-radio-button label="shared">所有旅伴可見</el-radio-button>
                  <el-radio-button label="private">僅自己可見</el-radio-button>
                </el-radio-group>
                <small>控制群組底下子行程的可見範圍；設為私人時，群組內共用行程會只顯示給你。</small>
              </template>
            </el-form-item>
          </div>
          <el-form-item label="群組卡顏色（選填）">
            <div class="itinerary-group-color-field">
              <div class="itinerary-group-color-swatches" role="list" aria-label="選擇群組卡顏色">
                <button
                  v-for="option in groupColorOptions"
                  :key="option.value"
                  type="button"
                  class="itinerary-group-color-swatch"
                  :class="{ 'is-active': normalizeHexColor(itineraryGroup.groupColor) === option.value }"
                  :style="{ '--swatch-color': option.value }"
                  :title="option.label"
                  @click="itineraryGroup.groupColor = option.value"
                >
                  <span class="itinerary-group-color-swatch-dot" aria-hidden="true"></span>
                  <span>{{ option.label }}</span>
                </button>
                <button
                  type="button"
                  class="itinerary-group-color-swatch is-default"
                  :class="{ 'is-active': !normalizeHexColor(itineraryGroup.groupColor) }"
                  title="使用系統預設群組色"
                  @click="itineraryGroup.groupColor = ''"
                >
                  <span class="itinerary-group-color-swatch-dot" aria-hidden="true"></span>
                  <span>系統預設</span>
                </button>
              </div>
              <div class="itinerary-group-color-tools">
                <el-color-picker v-model="itineraryGroup.groupColor" color-format="hex" />
                <small>可直接選色；留白則沿用目前群組卡預設色。</small>
              </div>
              <div class="itinerary-group-color-preview" :style="groupColorPreviewStyle()">
                <span class="itinerary-group-color-preview-tag">群組卡預覽</span>
                <strong>{{ itineraryGroup.title || '群組卡名稱預覽' }}</strong>
                <p>{{ itineraryGroup.location || '未設定區域' }}</p>
              </div>
            </div>
          </el-form-item>
          <el-form-item label="Google Maps 區域連結（選填）"><el-input v-model="itineraryGroup.mapUrl" placeholder="貼上 Google Maps 區域或地點網址" /></el-form-item>
          <el-form-item label="群組網站（選填）"><el-input v-model="itineraryGroup.website" placeholder="例如：https://example.com" /><small>可放商圈官網、區域整理頁、店鋪總覽或行前攻略。</small></el-form-item>
          <el-form-item label="群組備註（選填）"><el-input v-model="itineraryGroup.note" type="textarea" :rows="3" maxlength="200" show-word-limit placeholder="例如：這區主要安排早餐與採買，建議步行移動" /></el-form-item>
          <el-form-item label="群組內行程">
            <el-checkbox-group v-model="groupMemberIds" class="itinerary-group-member-selector">
              <el-checkbox v-for="entry in groupSelectableEntries" :key="entry.id" :label="entry.id">
                {{ entry.title }}<small>{{ entry.time || '未排時間' }}・{{ entry.type }}</small>
              </el-checkbox>
            </el-checkbox-group>
            <small>可直接勾選要收進這張群組卡的共用行程；之後也能再從卡片拖曳調整。</small>
          </el-form-item>
        </template>
        <template v-else>
        <div v-if="itemFormContext === 'group-child'" class="itinerary-group-mode-summary is-inline is-compact">
          <span class="itinerary-group-mode-kicker">群組卡底下行程</span>
          <strong>將加入 {{ itemFormGroupName }}</strong>
          <p>這裡只需填寫子行程本身的資訊。</p>
        </div>
        <el-form-item v-if="favorites.length" label="從旅遊收藏快速帶入">
          <div class="itinerary-favorite-picker-control"><div class="itinerary-favorite-picker-copy"><strong>{{ itemFavoriteId ? '已選擇旅遊收藏' : '尚未選擇收藏' }}</strong><span>{{ itemFavoriteId ? (favorites.find((entry) => entry.id === itemFavoriteId)?.name || '已選擇項目') : '可從收藏清單帶入名稱、類型、地點與圖片' }}</span></div><el-button class="itinerary-favorite-picker-button" @click="openFavoritePicker()">{{ itemFavoriteId ? '更換收藏' : '選擇收藏' }}</el-button></div>
          <small>日期與時間不會自動設定，請依實際行程選擇。</small>
        </el-form-item>
        <el-form-item label="行程名稱"><el-input v-model="item.title" placeholder="例如：前往秋葉原" /></el-form-item>
        <el-form-item label="日期"><el-date-picker v-model="item.date" type="date" value-format="YYYY-MM-DD" placeholder="選擇日期" /></el-form-item>
        <el-form-item v-if="itemActivityKind === 'shared' && itineraryGroupsForItem.length && itemFormContext !== 'group-child'" label="加入群組卡（選填）"><el-select v-model="itemItineraryGroupId" clearable placeholder="不加入群組卡"><el-option v-for="group in itineraryGroupsForItem" :key="group.id" :label="`${group.title}・${group.location || '未設定區域'}`" :value="group.id" /></el-select><small>可將這筆行程加入當日既有群組卡；留白則維持一般共用行程。</small></el-form-item>
        <div class="itinerary-time-grid"><el-form-item label="開始時間"><el-time-picker v-model="item.time" value-format="HH:mm" format="HH:mm" placeholder="選擇開始時間" /></el-form-item><el-form-item label="結束時間"><el-time-picker v-model="item.endTime" value-format="HH:mm" format="HH:mm" placeholder="選擇結束時間（選填）" /></el-form-item></div>
        <el-form-item label="類型"><el-select v-model="item.type"><el-option label="景點" value="景點" /><el-option label="餐廳" value="餐廳" /><el-option label="交通" value="交通" /><el-option label="住宿" value="住宿" /><el-option label="商店" value="商店" /></el-select></el-form-item>
        <el-form-item v-if="item.type === '交通'" label="抵達站／目的地（選填）"><div class="itinerary-favorite-picker-control transport-destination-control"><div class="itinerary-favorite-picker-copy"><strong>{{ item.transportDestinationName || '尚未選擇抵達站' }}</strong><span>{{ item.transportDestinationLocation || (item.transportDestinationMapUrl ? '已設定 Google Maps 連結' : '從旅遊收藏選擇下車站或目的地') }}</span></div><div class="transport-destination-actions"><el-button v-if="item.transportDestinationName" text class="transport-destination-clear" aria-label="清除抵達站" @click="Object.assign(item, { transportDestinationFavoriteId: '', transportDestinationName: '', transportDestinationLocation: '', transportDestinationMapUrl: '' })">清除</el-button><el-button class="itinerary-favorite-picker-button" @click="openFavoritePicker('destination')">{{ item.transportDestinationName ? '更換抵達站' : '選擇抵達站' }}</el-button></div></div><small>可選交通站、景點、住宿等任何收藏項目；設定後行程卡片會顯示出發站 → 抵達站。</small></el-form-item>
        <el-form-item v-if="item.type === '交通'" label="交通費（選填）"><div class="transport-fare-field"><el-input-number :model-value="item.transportFareAmount" :min="0" :step="1" controls-position="right" placeholder="輸入交通費" @update:model-value="setManualTransportFare($event as number | null | undefined)" /><el-button class="transport-fare-ai-button" :loading="estimatingItemFare" :disabled="estimatingItemFare || !canEstimateDraftTransportFare" @click="estimateTransportFareForForm">智能估算</el-button></div><div v-if="item.transportFareAmount" class="transport-fare-meta"><span>{{ transportFareSourceLabel(item.transportFareSource) }} {{ item.transportFareCurrency || trip.currency }} {{ new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(item.transportFareAmount) }}</span><small v-if="item.transportFareSource && item.transportFareSource !== 'manual' && item.transportFareEstimateConfidence">{{ item.transportFareEstimateConfidence === 'high' ? '高信心' : item.transportFareEstimateConfidence === 'low' ? '低信心' : '中等信心' }}</small></div><small>{{ transportFareSourceHint(item.transportFareSource) }}</small></el-form-item>
        <el-form-item label="Google Maps 景點網址（選填）"><el-input v-model="item.mapUrl" placeholder="貼上 Google Maps 或 maps.app.goo.gl 分享網址" /><small>行程卡片會直接開啟此景點；既有的地點文字資料會保留。</small></el-form-item>
        <el-form-item label="網站（選填）"><el-input v-model="item.website" placeholder="例如：https://example.com" /><small>可放官網、菜單、訂位頁或活動介紹頁；從旅遊收藏帶入時會自動填入。</small></el-form-item>
        <el-form-item label="行程圖片網址（選填）"><el-input v-model="item.imageUrl" placeholder="貼上圖片網址，例如 https://..." /><div v-if="item.imageUrl" class="itinerary-form-image-preview"><img :src="item.imageUrl" alt="行程圖片預覽" /><div><strong>行程圖片預覽</strong><span>從旅遊收藏帶入或使用此網址顯示</span></div></div><small>圖片會以縮圖顯示在每日行程卡片；從旅遊收藏帶入時會自動填入。</small></el-form-item>
        <el-form-item label="備註（選填）"><el-input v-model="item.note" type="textarea" :rows="3" maxlength="240" show-word-limit placeholder="例如：預約資訊、集合地點或注意事項" /></el-form-item>
        </template>
      </el-form>
      <template #footer><el-button :disabled="savingItem" @click="showItem = false">取消</el-button><el-button type="primary" :loading="savingItem" :disabled="savingItem" @click="saveItem">{{ itemActivityKind === 'group' ? '儲存群組卡' : '儲存行程' }}</el-button></template>
    </el-dialog>

    <el-dialog v-model="showFavoritePicker" :title="favoritePickerTarget === 'destination' ? '選擇抵達站／目的地' : '選擇旅遊收藏'" class="favorite-picker-dialog" width="min(92vw, 660px)" append-to-body>
      <div class="favorite-picker-toolbar"><el-input v-model="favoritePickerSearch" clearable placeholder="搜尋收藏名稱、地點或備註" aria-label="搜尋旅遊收藏" /><div class="favorite-picker-filters" role="group" aria-label="篩選收藏類型"><el-button v-for="option in favoritePickerOptions" :key="option.value" class="favorite-picker-filter" :class="[{ 'is-active': favoritePickerType === option.value }, option.value === 'all' ? '' : `type-${option.value}`]" :aria-pressed="favoritePickerType === option.value" @click="favoritePickerType = option.value">{{ option.label }}<small>{{ option.value === 'all' ? favorites.length : favorites.filter((entry) => normalizeFavoriteType(entry.type) === option.value).length }}</small></el-button></div></div>
      <div v-if="filteredFavoritesForPicker.length" class="favorite-picker-list"><button v-for="savedFavorite in filteredFavoritesForPicker" :key="savedFavorite.id" type="button" class="favorite-picker-row" :class="{ 'is-selected': favoritePickerTarget === 'destination' ? item.transportDestinationFavoriteId === savedFavorite.id : itemFavoriteId === savedFavorite.id }" @click="selectFavoriteForItem(savedFavorite.id)"><img v-if="savedFavorite.imageUrl" :src="savedFavorite.imageUrl" :alt="`${savedFavorite.name} 圖片`" /><span v-else class="favorite-picker-placeholder">{{ favoriteTypeLabel(savedFavorite.type).slice(0, 1) }}</span><span class="favorite-picker-row-copy"><strong>{{ savedFavorite.name }}</strong><span class="favorite-picker-type" :class="`type-${normalizeFavoriteType(savedFavorite.type)}`">{{ favoriteTypeLabel(savedFavorite.type) }}</span><small v-if="savedFavorite.location">{{ savedFavorite.location }}</small><small v-else-if="savedFavorite.mapUrl" class="favorite-picker-map-status">已設定 Google Maps 連結</small><small v-else>未填寫地點名稱或地圖連結</small></span><span class="favorite-picker-select">{{ favoritePickerTarget === 'destination' ? '設為抵達站' : '帶入' }}</span></button></div>
      <div v-else class="favorite-picker-empty"><strong>找不到符合的收藏</strong><p>試試其他關鍵字或類別。</p></div>
      <template #footer><el-button @click="showFavoritePicker = false">取消</el-button></template>
    </el-dialog>

    <el-dialog v-model="showFareEstimateDialog" title="交通票價估算" class="fare-estimate-dialog" width="min(92vw, 520px)" destroy-on-close>
      <div class="fare-estimate-content">
        <template v-if="fareEstimateTarget">
          <div class="fare-estimate-summary">
            <span class="fare-estimate-kicker">估算路線</span>
            <strong>{{ fareEstimateTarget.title }}</strong>
            <p>{{ fareEstimateRouteSummary(fareEstimateTarget) }}</p>
          </div>
          <div v-if="loadingFareEstimate" class="fare-estimate-loading">
            <el-skeleton :rows="4" animated />
          </div>
          <template v-else-if="fareEstimateResult">
            <div class="fare-estimate-result-card">
              <span class="fare-estimate-label">{{ fareEstimateResult.source === 'rule' ? '官方規則估算' : 'AI 參考票價' }}</span>
              <strong>{{ fareEstimateResult.currency }} {{ new Intl.NumberFormat('zh-TW', { maximumFractionDigits: 2 }).format(fareEstimateResult.amount) }}</strong>
              <small>{{ fareEstimateResult.confidence === 'high' ? '高信心' : fareEstimateResult.confidence === 'low' ? '低信心' : '中等信心' }}・{{ fareEstimateResult.provider }}<template v-if="fareEstimateResult.fareMode">・{{ fareEstimateResult.fareMode === 'ic' ? 'IC 卡票價' : '車票票價' }}</template><template v-if="fareEstimateResult.source === 'ai'">・模型 {{ fareEstimateResult.model }}</template></small>
            </div>
            <div class="fare-estimate-block">
              <span>估算說明</span>
              <p>{{ fareEstimateResult.reasoning }}</p>
            </div>
            <div v-if="fareEstimateResult.assumptions.length" class="fare-estimate-block">
              <span>估算假設</span>
              <ul>
                <li v-for="assumption in fareEstimateResult.assumptions" :key="assumption">{{ assumption }}</li>
              </ul>
            </div>
            <p class="fare-estimate-disclaimer">{{ fareEstimateResult.source === 'rule' ? '這是依官方票價規則推定的參考結果；按下確認後才會寫回這筆行程。' : '這是 AI 依目前路線資訊做出的參考估算；按下確認後才會寫回這筆行程。' }}</p>
          </template>
        </template>
      </div>
      <template #footer><el-button :disabled="savingFareEstimate" @click="showFareEstimateDialog = false">取消</el-button><el-button type="primary" :loading="savingFareEstimate || loadingFareEstimate" :disabled="!fareEstimateResult || loadingFareEstimate" @click="confirmFareEstimate">確認寫回行程</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.trip-itinerary-view{display:grid;min-width:0}.two-col,.three-col,.itinerary-time-grid{display:grid;gap:12px}.two-col,.itinerary-time-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.three-col{grid-template-columns:repeat(3,minmax(0,1fr))}.three-col :deep(.el-date-editor),.three-col :deep(.el-time-picker),.itinerary-time-grid :deep(.el-time-picker),.itinerary-form :deep(.el-date-editor),.itinerary-form :deep(.el-select){width:100%}.itinerary-form small{display:block;margin-top:5px;color:#71827c;font-size:12px;line-height:1.5}.itinerary-activity-kind{display:grid;grid-template-columns:1fr;gap:12px}.itinerary-activity-card{display:grid;gap:10px;min-width:0;padding:16px;border:1px solid #dce8e2;border-radius:14px;background:#fff;text-align:left;transition:border-color .18s ease,box-shadow .18s ease,background-color .18s ease}.itinerary-activity-card:hover,.itinerary-activity-card:focus-visible{border-color:#93b9aa;box-shadow:0 8px 20px rgba(18,63,58,.06);outline:none}.itinerary-activity-card.is-active{border-color:#123f3a;background:#eef5f0;box-shadow:0 10px 22px rgba(18,63,58,.08)}.itinerary-activity-card-top{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:12px}.itinerary-activity-card-heading{display:flex;align-items:center;gap:12px;min-width:0}.itinerary-activity-card-icon{display:grid;flex:0 0 38px;width:38px;height:38px;place-items:center;border-radius:12px;background:#f3f7f5;color:#467266}.itinerary-activity-card.is-active .itinerary-activity-card-icon{background:#dcece5;color:#145247}.itinerary-activity-card strong{color:#163b37;font-size:16px;line-height:1.4;overflow-wrap:anywhere}.itinerary-activity-card-meta{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:0 0 auto}.itinerary-activity-card-tag{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border-radius:999px;background:#f4f7f5;color:#5f7971;font-size:11px;font-weight:800;white-space:nowrap}.itinerary-activity-card.is-active .itinerary-activity-card-tag{background:#dcece5;color:#1f5e52}.itinerary-activity-card-check{display:grid;flex:0 0 22px;width:22px;height:22px;place-items:center;border-radius:999px;background:#123f3a;color:#fff;box-shadow:0 4px 10px rgba(18,63,58,.16)}.itinerary-activity-card-description{color:#6b7d78;font-size:13px;line-height:1.65}.itinerary-group-mode-summary{display:grid;gap:4px;padding:13px 14px;border:1px solid #dce8e2;border-radius:14px;background:linear-gradient(180deg,#fbfcfa 0%,#f4f8f6 100%)}.itinerary-group-mode-summary.is-inline{margin-bottom:2px}.itinerary-group-mode-kicker{display:inline-flex;align-items:center;width:max-content;min-height:24px;padding:0 8px;border-radius:999px;background:#eef5f0;color:#2f7d70;font-size:11px;font-weight:800;letter-spacing:.04em}.itinerary-group-mode-summary strong{color:#163b37;font-size:14px;line-height:1.45}.itinerary-group-mode-summary p{margin:0;color:#5f716c;font-size:13px;line-height:1.6}.itinerary-group-mode-summary small{margin:0;color:#2f7d70;font-size:12px;font-weight:700;line-height:1.55}.itinerary-group-visibility-panel{display:grid;gap:12px;padding:12px;border:1px solid #dce8e2;border-radius:14px;background:#fbfcfa}.itinerary-group-visibility-row{display:grid;gap:8px}.itinerary-group-visibility-row>span{color:#244a43;font-size:13px;font-weight:700}.itinerary-group-visibility-lock{display:grid;gap:4px;padding:10px 12px;border:1px dashed #cfe0d9;border-radius:12px;background:#f3f8f5}.itinerary-group-visibility-lock strong{color:#123f3a;font-size:13px}.itinerary-group-visibility-lock small{margin:0;color:#6b7d78;font-size:12px;line-height:1.55}.itinerary-favorite-picker-control{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid #dce8e2;border-radius:10px;background:#fbfdfc}.itinerary-favorite-picker-copy{display:grid;min-width:0;gap:2px}.itinerary-favorite-picker-copy strong,.itinerary-favorite-picker-copy span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.itinerary-favorite-picker-copy strong{color:#244a43;font-size:13px}.itinerary-favorite-picker-copy span{color:#71827c;font-size:12px}.itinerary-favorite-picker-button{flex:0 0 auto;min-height:36px;border-color:#bfd7cd;color:#236c59;font-weight:700}.transport-destination-actions{display:flex;flex:0 0 auto;align-items:center;gap:4px}.transport-destination-clear{color:#a96a50}.itinerary-form-image-preview{display:flex;align-items:center;gap:10px;margin-top:9px;padding:8px;border:1px solid #e1e8e3;border-radius:10px;background:#fbfcfa}.itinerary-form-image-preview img{width:52px;height:52px;border-radius:8px;object-fit:cover}.itinerary-form-image-preview div{display:grid;gap:2px}.itinerary-form-image-preview strong{color:#244a43;font-size:13px}.itinerary-form-image-preview span{color:#71827c;font-size:12px}.itinerary-group-member-selector{display:grid;gap:7px}.itinerary-group-member-selector :deep(.el-checkbox){height:auto;margin-right:0;white-space:normal}.itinerary-group-member-selector small{display:block;margin:2px 0 0;color:#71827c;font-size:12px}.favorite-picker-toolbar{display:grid;gap:12px}.favorite-picker-filters{display:flex;flex-wrap:wrap;gap:7px}.favorite-picker-filter{min-height:34px;margin:0;border-color:#d9e6e0;color:#477168}.favorite-picker-filter.is-active{border-color:#123f3a;background:#123f3a;color:#fff}.favorite-picker-filter small{margin-left:4px;font-size:11px}.favorite-picker-list{display:grid;gap:9px;max-height:52vh;margin-top:14px;overflow:auto}.favorite-picker-row{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;padding:9px;border:1px solid #e1e8e3;border-radius:12px;background:#fff;text-align:left;cursor:pointer}.favorite-picker-row:hover,.favorite-picker-row.is-selected{border-color:#9fc8b8;background:#f5faf7}.favorite-picker-row img,.favorite-picker-placeholder{display:grid;width:48px;height:48px;place-items:center;border-radius:9px;background:#eef5f0;color:#347965;object-fit:cover;font-weight:800}.favorite-picker-row-copy{display:grid;min-width:0;gap:3px}.favorite-picker-row-copy strong,.favorite-picker-row-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.favorite-picker-row-copy strong{color:#244a43;font-size:14px}.favorite-picker-row-copy small{color:#71827c;font-size:12px}.favorite-picker-type{width:max-content;padding:2px 6px;border-radius:999px;background:#eaf4ef;color:#3b7868;font-size:11px;font-weight:700}.favorite-picker-select{color:#2f7d70;font-size:13px;font-weight:800;white-space:nowrap}.favorite-picker-empty{padding:30px 10px;text-align:center;color:#71827c}.favorite-picker-empty strong{color:#244a43}.favorite-picker-empty p{margin:5px 0 0;font-size:13px}.fare-estimate-content{display:grid;gap:14px}.fare-estimate-summary{display:grid;gap:4px;padding:14px;border:1px solid #e1e8e3;border-radius:14px;background:#fbfcfa}.fare-estimate-summary strong{color:#163b37;font-size:16px}.fare-estimate-summary p{margin:0;color:#6b7d78;font-size:13px;line-height:1.6}.fare-estimate-kicker,.fare-estimate-label,.fare-estimate-block span{color:#2f7d70;font-size:12px;font-weight:800;letter-spacing:.08em}.fare-estimate-result-card{display:grid;gap:4px;padding:16px;border-radius:16px;background:#eef5f0}.fare-estimate-result-card strong{color:#123f3a;font-size:28px;line-height:1.1}.fare-estimate-result-card small{color:#5e746d;font-size:12px}.fare-estimate-block{display:grid;gap:6px}.fare-estimate-block p,.fare-estimate-block ul{margin:0;color:#405651;font-size:14px;line-height:1.65}.fare-estimate-block ul{padding-left:18px}.fare-estimate-disclaimer{margin:0;color:#6b7d78;font-size:12px;line-height:1.6}@media(max-width:600px){.two-col,.three-col,.itinerary-time-grid,.itinerary-activity-kind{grid-template-columns:1fr}.itinerary-group-dialog :deep(.el-dialog__body),.itinerary-dialog :deep(.el-dialog__body),.favorite-picker-dialog :deep(.el-dialog__body),.fare-estimate-dialog :deep(.el-dialog__body){padding:16px}.itinerary-group-dialog :deep(.el-dialog__footer),.itinerary-dialog :deep(.el-dialog__footer),.favorite-picker-dialog :deep(.el-dialog__footer),.fare-estimate-dialog :deep(.el-dialog__footer){padding:12px 16px 18px}.itinerary-activity-card-top{align-items:center}.itinerary-group-mode-summary{padding:12px}.itinerary-group-visibility-panel{padding:10px}.itinerary-favorite-picker-control{align-items:stretch;flex-direction:column}.itinerary-favorite-picker-button{width:100%}.transport-destination-actions{display:grid;grid-template-columns:1fr 1fr}.favorite-picker-row{grid-template-columns:44px minmax(0,1fr)}.favorite-picker-row img,.favorite-picker-placeholder{width:44px;height:44px}.favorite-picker-select{grid-column:2;justify-self:start}.fare-estimate-result-card strong{font-size:24px}}
.trip-itinerary-view{display:grid;min-width:0}.two-col,.three-col,.itinerary-time-grid{display:grid;gap:12px}.two-col,.itinerary-time-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.three-col{grid-template-columns:repeat(3,minmax(0,1fr))}.three-col :deep(.el-date-editor),.three-col :deep(.el-time-picker),.itinerary-time-grid :deep(.el-time-picker),.itinerary-form :deep(.el-date-editor),.itinerary-form :deep(.el-select){width:100%}.itinerary-form small{display:block;margin-top:5px;color:#71827c;font-size:12px;line-height:1.5}.itinerary-activity-kind{display:grid;grid-template-columns:1fr;gap:12px}.itinerary-activity-card{display:grid;gap:10px;min-width:0;padding:16px;border:1px solid #dce8e2;border-radius:14px;background:#fff;text-align:left;transition:border-color .18s ease,box-shadow .18s ease,background-color .18s ease}.itinerary-activity-card:hover,.itinerary-activity-card:focus-visible{border-color:#93b9aa;box-shadow:0 8px 20px rgba(18,63,58,.06);outline:none}.itinerary-activity-card.is-active{border-color:#123f3a;background:#eef5f0;box-shadow:0 10px 22px rgba(18,63,58,.08)}.itinerary-activity-card-top{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:start;gap:12px}.itinerary-activity-card-heading{display:flex;align-items:center;gap:12px;min-width:0}.itinerary-activity-card-icon{display:grid;flex:0 0 38px;width:38px;height:38px;place-items:center;border-radius:12px;background:#f3f7f5;color:#467266}.itinerary-activity-card.is-active .itinerary-activity-card-icon{background:#dcece5;color:#145247}.itinerary-activity-card strong{color:#163b37;font-size:16px;line-height:1.4;overflow-wrap:anywhere}.itinerary-activity-card-meta{display:flex;align-items:center;justify-content:flex-end;gap:8px;flex:0 0 auto}.itinerary-activity-card-tag{display:inline-flex;align-items:center;min-height:24px;padding:0 8px;border-radius:999px;background:#f4f7f5;color:#5f7971;font-size:11px;font-weight:800;white-space:nowrap}.itinerary-activity-card.is-active .itinerary-activity-card-tag{background:#dcece5;color:#1f5e52}.itinerary-activity-card-check{display:grid;flex:0 0 22px;width:22px;height:22px;place-items:center;border-radius:999px;background:#123f3a;color:#fff;box-shadow:0 4px 10px rgba(18,63,58,.16)}.itinerary-activity-card-description{color:#6b7d78;font-size:13px;line-height:1.65}.itinerary-group-mode-summary{display:grid;gap:4px;padding:13px 14px;border:1px solid #dce8e2;border-radius:14px;background:linear-gradient(180deg,#fbfcfa 0%,#f4f8f6 100%)}.itinerary-group-mode-summary.is-inline{margin-bottom:2px}.itinerary-group-mode-kicker{display:inline-flex;align-items:center;width:max-content;min-height:24px;padding:0 8px;border-radius:999px;background:#eef5f0;color:#2f7d70;font-size:11px;font-weight:800;letter-spacing:.04em}.itinerary-group-mode-summary strong{color:#163b37;font-size:14px;line-height:1.45}.itinerary-group-mode-summary p{margin:0;color:#5f716c;font-size:13px;line-height:1.6}.itinerary-group-mode-summary small{margin:0;color:#2f7d70;font-size:12px;font-weight:700;line-height:1.55}.itinerary-group-visibility-panel{display:grid;gap:12px;padding:12px;border:1px solid #dce8e2;border-radius:14px;background:#fbfcfa}.itinerary-group-visibility-row{display:grid;gap:8px}.itinerary-group-visibility-row>span{color:#244a43;font-size:13px;font-weight:700}.itinerary-group-visibility-lock{display:grid;gap:4px;padding:10px 12px;border:1px dashed #cfe0d9;border-radius:12px;background:#f3f8f5}.itinerary-group-visibility-lock strong{color:#123f3a;font-size:13px}.itinerary-group-visibility-lock small{margin:0;color:#6b7d78;font-size:12px;line-height:1.55}.itinerary-group-color-field{display:grid;gap:10px}.itinerary-group-color-swatches{display:flex;flex-wrap:wrap;gap:8px}.itinerary-group-color-swatch{display:inline-flex;align-items:center;gap:8px;min-height:38px;padding:0 12px;border:1px solid #d8e5df;border-radius:999px;background:#fff;color:#355b54;font-size:12px;font-weight:700;white-space:nowrap;transition:border-color .18s ease,box-shadow .18s ease,background-color .18s ease}.itinerary-group-color-swatch:hover,.itinerary-group-color-swatch:focus-visible{border-color:#91b8ab;background:#f7fbf9;outline:none}.itinerary-group-color-swatch.is-active{border-color:var(--swatch-color,#123f3a);background:color-mix(in srgb,var(--swatch-color,#123f3a) 10%,#fff);box-shadow:0 6px 14px rgba(18,63,58,.08)}.itinerary-group-color-swatch-dot{display:grid;flex:0 0 16px;width:16px;height:16px;border:1px solid rgba(18,63,58,.12);border-radius:999px;background:var(--swatch-color,#dce8e2)}.itinerary-group-color-swatch.is-default .itinerary-group-color-swatch-dot{background:linear-gradient(135deg,#8fbfc6 0%,#f1f7f8 100%)}.itinerary-group-color-tools{display:flex;align-items:center;gap:10px}.itinerary-group-color-tools :deep(.el-color-picker__trigger){border-radius:10px}.itinerary-group-color-preview{display:grid;gap:2px;padding:12px 14px;border:1px solid #dce8e2;border-radius:14px;background:#f5faf9}.itinerary-group-color-preview-tag{display:inline-flex;align-items:center;width:max-content;min-height:22px;padding:0 8px;border-radius:999px;background:rgba(255,255,255,.72);color:inherit;font-size:11px;font-weight:800;letter-spacing:.04em}.itinerary-group-color-preview strong{color:#244a43;font-size:14px;line-height:1.45}.itinerary-group-color-preview p{margin:0;color:#5f716c;font-size:12px;line-height:1.5}.itinerary-favorite-picker-control{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 12px;border:1px solid #dce8e2;border-radius:10px;background:#fbfdfc}.itinerary-favorite-picker-copy{display:grid;min-width:0;gap:2px}.itinerary-favorite-picker-copy strong,.itinerary-favorite-picker-copy span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.itinerary-favorite-picker-copy strong{color:#244a43;font-size:13px}.itinerary-favorite-picker-copy span{color:#71827c;font-size:12px}.itinerary-favorite-picker-button{flex:0 0 auto;min-height:36px;border-color:#bfd7cd;color:#236c59;font-weight:700}.transport-destination-actions{display:flex;flex:0 0 auto;align-items:center;gap:4px}.transport-destination-clear{color:#a96a50}.itinerary-form-image-preview{display:flex;align-items:center;gap:10px;margin-top:9px;padding:8px;border:1px solid #e1e8e3;border-radius:10px;background:#fbfcfa}.itinerary-form-image-preview img{width:52px;height:52px;border-radius:8px;object-fit:cover}.itinerary-form-image-preview div{display:grid;gap:2px}.itinerary-form-image-preview strong{color:#244a43;font-size:13px}.itinerary-form-image-preview span{color:#71827c;font-size:12px}.itinerary-group-member-selector{display:grid;gap:7px}.itinerary-group-member-selector :deep(.el-checkbox){height:auto;margin-right:0;white-space:normal}.itinerary-group-member-selector small{display:block;margin:2px 0 0;color:#71827c;font-size:12px}.favorite-picker-toolbar{display:grid;gap:12px}.favorite-picker-filters{display:flex;flex-wrap:wrap;gap:7px}.favorite-picker-filter{min-height:34px;margin:0;border-color:#d9e6e0;color:#477168}.favorite-picker-filter.is-active{border-color:#123f3a;background:#123f3a;color:#fff}.favorite-picker-filter small{margin-left:4px;font-size:11px}.favorite-picker-list{display:grid;gap:9px;max-height:52vh;margin-top:14px;overflow:auto}.favorite-picker-row{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:10px;width:100%;padding:9px;border:1px solid #e1e8e3;border-radius:12px;background:#fff;text-align:left;cursor:pointer}.favorite-picker-row:hover,.favorite-picker-row.is-selected{border-color:#9fc8b8;background:#f5faf7}.favorite-picker-row img,.favorite-picker-placeholder{display:grid;width:48px;height:48px;place-items:center;border-radius:9px;background:#eef5f0;color:#347965;object-fit:cover;font-weight:800}.favorite-picker-row-copy{display:grid;min-width:0;gap:3px}.favorite-picker-row-copy strong,.favorite-picker-row-copy small{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.favorite-picker-row-copy strong{color:#244a43;font-size:14px}.favorite-picker-row-copy small{color:#71827c;font-size:12px}.favorite-picker-type{width:max-content;padding:2px 6px;border-radius:999px;background:#eaf4ef;color:#3b7868;font-size:11px;font-weight:700}.favorite-picker-select{color:#2f7d70;font-size:13px;font-weight:800;white-space:nowrap}.favorite-picker-empty{padding:30px 10px;text-align:center;color:#71827c}.favorite-picker-empty strong{color:#244a43}.favorite-picker-empty p{margin:5px 0 0;font-size:13px}.fare-estimate-content{display:grid;gap:14px}.fare-estimate-summary{display:grid;gap:4px;padding:14px;border:1px solid #e1e8e3;border-radius:14px;background:#fbfcfa}.fare-estimate-summary strong{color:#163b37;font-size:16px}.fare-estimate-summary p{margin:0;color:#6b7d78;font-size:13px;line-height:1.6}.fare-estimate-kicker,.fare-estimate-label,.fare-estimate-block span{color:#2f7d70;font-size:12px;font-weight:800;letter-spacing:.08em}.fare-estimate-result-card{display:grid;gap:4px;padding:16px;border-radius:16px;background:#eef5f0}.fare-estimate-result-card strong{color:#123f3a;font-size:28px;line-height:1.1}.fare-estimate-result-card small{color:#5e746d;font-size:12px}.fare-estimate-block{display:grid;gap:6px}.fare-estimate-block p,.fare-estimate-block ul{margin:0;color:#405651;font-size:14px;line-height:1.65}.fare-estimate-block ul{padding-left:18px}.fare-estimate-disclaimer{margin:0;color:#6b7d78;font-size:12px;line-height:1.6}@media(max-width:600px){.two-col,.three-col,.itinerary-time-grid,.itinerary-activity-kind{grid-template-columns:1fr}.itinerary-group-dialog :deep(.el-dialog__body),.itinerary-dialog :deep(.el-dialog__body),.favorite-picker-dialog :deep(.el-dialog__body),.fare-estimate-dialog :deep(.el-dialog__body){padding:16px}.itinerary-group-dialog :deep(.el-dialog__footer),.itinerary-dialog :deep(.el-dialog__footer),.favorite-picker-dialog :deep(.el-dialog__footer),.fare-estimate-dialog :deep(.el-dialog__footer){padding:12px 16px 18px}.itinerary-activity-card-top{align-items:center}.itinerary-group-mode-summary{padding:12px}.itinerary-group-visibility-panel{padding:10px}.itinerary-group-color-tools{align-items:flex-start;flex-direction:column}.itinerary-group-color-swatch{width:100%;justify-content:flex-start}.itinerary-favorite-picker-control{align-items:stretch;flex-direction:column}.itinerary-favorite-picker-button{width:100%}.transport-destination-actions{display:grid;grid-template-columns:1fr 1fr}.favorite-picker-row{grid-template-columns:44px minmax(0,1fr)}.favorite-picker-row img,.favorite-picker-placeholder{width:44px;height:44px}.favorite-picker-select{grid-column:2;justify-self:start}.fare-estimate-result-card strong{font-size:24px}}
</style>

<style scoped>
.itinerary-group-mode-summary.is-compact {
  gap: 2px;
  padding: 10px 12px;
  border-radius: 12px;
  background: #f7fbf9;
}

.itinerary-group-mode-summary.is-compact strong {
  font-size: 13px;
}

.itinerary-group-mode-summary.is-compact p {
  font-size: 12px;
  line-height: 1.5;
}

@media (max-width: 600px) {
  .itinerary-group-mode-summary.is-compact {
    padding: 9px 10px;
  }
}
</style>
