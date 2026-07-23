<script setup lang="ts">
import { computed, onUnmounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TripShoppingCard from '../components/TripShoppingCard.vue'
import ShoppingItemDialog, { type ShoppingItemDraft } from '../components/ShoppingItemDialog.vue'
import ShoppingItineraryPickerDialog from '../components/ShoppingItineraryPickerDialog.vue'
import type { ExpenseKind, ItineraryItem, ShoppingItem, Trip } from '../types'
import { uploadTripImage } from '../services/cloudinary'
import { useTripStore } from '../stores/trip'

const props = defineProps<{
  trip: Trip
  items: ShoppingItem[]
  itineraries: ItineraryItem[]
  canEdit: boolean
  userId: string
  memberName: (id: string) => string
  formatDate: (date: string) => string
}>()

const store = useTripStore()
const localDate = () => new Date().toLocaleDateString('sv-SE')

const showShopping = ref(false)
const savingShopping = ref(false)
const showShoppingItineraryPicker = ref(false)
const shoppingItineraryPickerDay = ref('')
const shoppingItineraryPickerMode = ref<'form' | 'batch'>('form')
const batchShoppingItemIds = ref<string[]>([])
const batchShoppingItineraryItemIds = ref<string[]>([])
const editingShoppingId = ref<string | null>(null)
const shoppingImageFile = ref<File>()
const shoppingImagePreview = ref('')
const shoppingImageUrl = ref('')
const shoppingParticipantIds = ref<string[]>([])
const shoppingItineraryItemIds = ref<string[]>([])

const shopping = reactive<ShoppingItemDraft>({
  name: '',
  description: '',
  shoppingType: 'personal',
  category: '其他',
  priority: 'medium',
  quantity: 1,
  unit: '件',
  estimatedUnitPrice: 0,
  actualUnitPrice: 0,
  currency: 'JPY',
  requestedBy: '',
  assignedTo: '',
  giftRecipient: '',
  storeName: '',
  storeBranch: '',
  location: '',
  address: '',
  mapUrl: '',
  website: '',
  note: '',
  status: 'wishlist',
  plannedDate: '',
  itineraryItemId: '',
})

const shoppingImageDisplay = computed(() =>
  shoppingImagePreview.value.startsWith('blob:')
    ? shoppingImagePreview.value
    : shoppingImageUrl.value.trim() || shoppingImagePreview.value,
)

const shoppingItineraryDays = computed(() =>
  Object.entries(
    props.itineraries
      .filter((entry) => entry.activityKind !== 'free')
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
          (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) ||
          (a.time || '').localeCompare(b.time || ''),
      ),
    })),
)

const selectedShoppingItineraries = computed(() =>
  shoppingItineraryItemIds.value
    .map((id) => props.itineraries.find((entry) => entry.id === id))
    .filter((entry): entry is ItineraryItem => Boolean(entry)),
)

const selectedShoppingItinerary = computed(() => selectedShoppingItineraries.value[0])
const shoppingItineraryEntries = computed(
  () => shoppingItineraryDays.value.find((day) => day.date === shoppingItineraryPickerDay.value)?.entries || [],
)

const activeShoppingItineraryItemIds = computed<string[]>({
  get: () =>
    shoppingItineraryPickerMode.value === 'batch'
      ? batchShoppingItineraryItemIds.value
      : shoppingItineraryItemIds.value,
  set: (value) => {
    if (shoppingItineraryPickerMode.value === 'batch') batchShoppingItineraryItemIds.value = value
    else shoppingItineraryItemIds.value = value
  },
})

function normalizeExternalUrl(value: string) {
  const raw = value.trim()
  return raw && !/^https?:\/\//i.test(raw) ? `https://${raw}` : raw
}

function normalizeGoogleMapsUrl(value: string) {
  const raw = value.trim()
  if (!raw) return ''
  const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try {
    const hostname = new URL(normalized).hostname.toLowerCase()
    if (
      !/(^|\.)google\.[a-z.]+$/.test(hostname) &&
      hostname !== 'maps.app.goo.gl' &&
      hostname !== 'goo.gl'
    ) {
      throw new Error()
    }
    return normalized
  } catch {
    throw new Error('請貼上有效的 Google Maps 地點網址。')
  }
}

function clearShoppingImagePreview() {
  if (shoppingImagePreview.value.startsWith('blob:')) URL.revokeObjectURL(shoppingImagePreview.value)
  shoppingImagePreview.value = ''
}

function resetShoppingForm() {
  clearShoppingImagePreview()
  shoppingImageFile.value = undefined
  shoppingImageUrl.value = ''
  editingShoppingId.value = null
  shoppingParticipantIds.value = []
  shoppingItineraryItemIds.value = []
  Object.assign(shopping, {
    name: '',
    description: '',
    shoppingType: 'personal',
    category: '其他',
    priority: 'medium',
    quantity: 1,
    unit: '件',
    estimatedUnitPrice: 0,
    actualUnitPrice: 0,
    currency: props.trip.currency || 'JPY',
    requestedBy: '',
    assignedTo: '',
    giftRecipient: '',
    storeName: '',
    storeBranch: '',
    location: '',
    address: '',
    mapUrl: '',
    website: '',
    note: '',
    status: 'wishlist',
    plannedDate: '',
    itineraryItemId: '',
  })
}

function selectShoppingImage(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) return ElMessage.warning('請選擇圖片檔案。')
  if (file.size > 10 * 1024 * 1024) return ElMessage.warning('圖片大小請控制在 10 MB 以內。')
  clearShoppingImagePreview()
  shoppingImageFile.value = file
  shoppingImagePreview.value = URL.createObjectURL(file)
}

function openShoppingForm(existing?: ShoppingItem) {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看購物清單，無法修改。')
  resetShoppingForm()
  editingShoppingId.value = existing?.id || null
  if (existing) {
    Object.assign(shopping, {
      name: existing.name,
      description: existing.description || '',
      shoppingType: existing.shoppingType,
      category: existing.category,
      priority: existing.priority,
      quantity: existing.quantity,
      unit: existing.unit || '件',
      estimatedUnitPrice: existing.estimatedUnitPrice || 0,
      actualUnitPrice: existing.actualUnitPrice || 0,
      currency: existing.currency,
      requestedBy: existing.requestedBy || '',
      assignedTo: existing.assignedTo || '',
      giftRecipient: existing.giftRecipient || '',
      storeName: existing.storeName || '',
      storeBranch: existing.storeBranch || '',
      location: existing.location || '',
      address: existing.address || '',
      mapUrl: existing.mapUrl || '',
      website: existing.website || '',
      note: existing.note || '',
      status: existing.status,
      plannedDate: existing.plannedDate || '',
      itineraryItemId: existing.itineraryItemId || '',
    })
    shoppingItineraryItemIds.value = [
      ...new Set(
        existing.itineraryItemIds?.length
          ? existing.itineraryItemIds
          : existing.itineraryItemId
            ? [existing.itineraryItemId]
            : [],
      ),
    ]
    shoppingParticipantIds.value = [...(existing.participantIds || [])]
    shoppingImagePreview.value = existing.imageUrl || ''
    shoppingImageUrl.value = existing.imageUrl || ''
  } else {
    shopping.assignedTo = props.userId || props.trip.ownerId || ''
    shoppingParticipantIds.value = props.trip.members.map((member) => member.id)
  }
  showShopping.value = true
}

async function saveShoppingItem() {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看購物清單，無法修改。')
  if (!shopping.name.trim()) return ElMessage.warning('請填寫商品名稱。')
  const existing = editingShoppingId.value
    ? props.items.find((entry) => entry.id === editingShoppingId.value)
    : undefined
  const duplicate =
    !existing &&
    props.items.find(
      (entry) =>
        entry.name.trim().toLocaleLowerCase() === shopping.name.trim().toLocaleLowerCase() &&
        entry.status !== 'cancelled',
    )
  try {
    if (duplicate) {
      await ElMessageBox.confirm(
        `購物清單中已經有「${duplicate.name}」，仍要新增嗎？`,
        '可能重複的商品',
        {
          confirmButtonText: '仍要新增',
          cancelButtonText: '取消',
          type: 'warning',
        },
      )
    }
    savingShopping.value = true
    const quantity = Math.max(1, Number(shopping.quantity) || 1)
    const estimatedUnitPrice = Math.max(0, Number(shopping.estimatedUnitPrice) || 0)
    const actualUnitPrice = Math.max(0, Number(shopping.actualUnitPrice) || 0)
    const imageUrl = shoppingImageFile.value
      ? await uploadTripImage(shoppingImageFile.value, 'shopping', props.trip.id)
      : normalizeExternalUrl(shoppingImageUrl.value) || existing?.imageUrl || ''
    const mapUrl = normalizeGoogleMapsUrl(shopping.mapUrl)
    const itineraryItemIds = [...new Set(shoppingItineraryItemIds.value)].filter((id) =>
      props.itineraries.some((entry) => entry.id === id),
    )
    const payload = {
      tripId: props.trip.id,
      name: shopping.name.trim(),
      description: shopping.description.trim(),
      shoppingType: shopping.shoppingType,
      category: shopping.category.trim() || '其他',
      priority: shopping.priority,
      quantity,
      unit: shopping.unit.trim() || '件',
      estimatedUnitPrice,
      estimatedTotalPrice: estimatedUnitPrice * quantity,
      actualUnitPrice,
      actualTotalPrice: actualUnitPrice * quantity,
      currency: shopping.currency || props.trip.currency,
      requestedBy: shopping.requestedBy.trim(),
      assignedTo: shopping.assignedTo || '',
      giftRecipient: shopping.giftRecipient.trim(),
      storeName: shopping.storeName.trim(),
      storeBranch: shopping.storeBranch.trim(),
      location: shopping.location.trim(),
      address: shopping.address.trim(),
      mapUrl,
      website: normalizeExternalUrl(shopping.website),
      imageUrl,
      note: shopping.note.trim(),
      status: shopping.status,
      plannedDate: shopping.plannedDate || '',
      itineraryItemId: itineraryItemIds[0] || '',
      itineraryItemIds,
      participantIds: shopping.shoppingType === 'shared' ? shoppingParticipantIds.value : [],
      purchasedBy: existing?.purchasedBy || '',
      purchasedAt: existing?.purchasedAt,
      expenseId: existing?.expenseId || '',
      createdBy: existing?.createdBy || props.userId || props.trip.ownerId,
    }
    if (existing) await store.updateShoppingItem({ ...existing, ...payload })
    else await store.addShoppingItem(payload)
    showShopping.value = false
    resetShoppingForm()
    ElMessage.success(existing ? '購物項目已更新。' : '商品已加入購物清單。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '無法儲存購物項目。')
    }
  } finally {
    savingShopping.value = false
  }
}

function openShoppingItineraryPicker() {
  shoppingItineraryPickerMode.value = 'form'
  shoppingItineraryPickerDay.value =
    selectedShoppingItinerary.value?.date || shoppingItineraryDays.value[0]?.date || ''
  showShoppingItineraryPicker.value = true
}

function openBatchShoppingItineraryPicker(items: ShoppingItem[]) {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看購物清單，無法修改。')
  batchShoppingItemIds.value = items.map((item) => item.id)
  batchShoppingItineraryItemIds.value = []
  shoppingItineraryPickerMode.value = 'batch'
  shoppingItineraryPickerDay.value = shoppingItineraryDays.value[0]?.date || ''
  showShoppingItineraryPicker.value = true
}

function selectShoppingItinerary(entry: ItineraryItem) {
  const selected = new Set(activeShoppingItineraryItemIds.value)
  if (selected.has(entry.id)) selected.delete(entry.id)
  else selected.add(entry.id)
  activeShoppingItineraryItemIds.value = [...selected]
}

async function confirmShoppingItinerarySelection() {
  if (shoppingItineraryPickerMode.value !== 'batch') {
    showShoppingItineraryPicker.value = false
    return
  }
  const itineraryItemIds = [...new Set(batchShoppingItineraryItemIds.value)]
  const items = props.items.filter((item) => batchShoppingItemIds.value.includes(item.id))
  if (!items.length || !itineraryItemIds.length) {
    return ElMessage.warning('請至少選擇一筆商品與一個關聯行程。')
  }
  try {
    await Promise.all(
      items.map((item) => {
        const linkedIds = [
          ...new Set([
            ...(item.itineraryItemIds?.length
              ? item.itineraryItemIds
              : item.itineraryItemId
                ? [item.itineraryItemId]
                : []),
            ...itineraryItemIds,
          ]),
        ]
        return store.updateShoppingItem({
          ...item,
          itineraryItemId: linkedIds[0] || '',
          itineraryItemIds: linkedIds,
        })
      }),
    )
    showShoppingItineraryPicker.value = false
    batchShoppingItemIds.value = []
    batchShoppingItineraryItemIds.value = []
    ElMessage.success(`已將 ${items.length} 項商品加入 ${itineraryItemIds.length} 個關聯行程。`)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法更新商品關聯行程。')
  }
}

function clearShoppingItinerary() {
  activeShoppingItineraryItemIds.value = []
  if (shoppingItineraryPickerMode.value === 'form') shopping.itineraryItemId = ''
}

async function updateStatus(item: ShoppingItem, status: ShoppingItem['status']) {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看購物清單，無法修改。')
  try {
    const isPurchased = status === 'purchased'
    await store.updateShoppingItem({
      ...item,
      status,
      purchasedBy: isPurchased
        ? item.purchasedBy || item.assignedTo || props.userId || props.trip.ownerId
        : item.purchasedBy || '',
      purchasedAt: isPurchased ? item.purchasedAt || Date.now() : item.purchasedAt,
    })
    ElMessage.success(status === 'purchased' ? '已標記為已購買。' : '商品狀態已更新。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法更新商品狀態。')
  }
}

async function remove(item: ShoppingItem) {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看購物清單，無法修改。')
  try {
    await ElMessageBox.confirm(`確定刪除商品「${item.name}」嗎？`, '刪除購物項目', {
      confirmButtonText: '刪除',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await store.deleteShoppingItem(item)
    ElMessage.success('商品已刪除。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '無法刪除購物項目。')
    }
  }
}

async function duplicate(item: ShoppingItem) {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看購物清單，無法修改。')
  try {
    const itineraryItemIds = [
      ...new Set(
        item.itineraryItemIds?.length ? item.itineraryItemIds : item.itineraryItemId ? [item.itineraryItemId] : [],
      ),
    ]
    await store.addShoppingItem({
      tripId: props.trip.id,
      name: `${item.name}（副本）`,
      description: item.description || '',
      shoppingType: item.shoppingType,
      category: item.category,
      priority: item.priority,
      quantity: item.quantity,
      unit: item.unit || '件',
      estimatedUnitPrice: item.estimatedUnitPrice || 0,
      estimatedTotalPrice: item.estimatedTotalPrice || 0,
      actualUnitPrice: 0,
      actualTotalPrice: 0,
      currency: item.currency || props.trip.currency,
      requestedBy: item.requestedBy || '',
      assignedTo: item.assignedTo || '',
      giftRecipient: item.giftRecipient || '',
      storeName: item.storeName || '',
      storeBranch: item.storeBranch || '',
      location: item.location || '',
      address: item.address || '',
      mapUrl: item.mapUrl || '',
      website: item.website || '',
      imageUrl: item.imageUrl || '',
      note: item.note || '',
      status: 'wishlist',
      plannedDate: item.plannedDate || '',
      itineraryItemId: itineraryItemIds[0] || '',
      itineraryItemIds,
      participantIds: [...(item.participantIds || [])],
      purchasedBy: '',
      purchasedAt: undefined,
      expenseId: '',
      createdBy: props.userId || props.trip.ownerId,
    })
    ElMessage.success('已複製商品，可再編輯副本。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法複製商品。')
  }
}

async function convert(item: ShoppingItem) {
  if (!props.canEdit) return ElMessage.warning('Viewer 僅能查看購物清單，無法修改。')
  if (item.expenseId) return ElMessage.info('這筆商品已建立對應開銷。')
  const amount =
    Number(item.actualTotalPrice) ||
    Number(item.actualUnitPrice) * item.quantity ||
    Number(item.estimatedTotalPrice) ||
    Number(item.estimatedUnitPrice) * item.quantity
  if (!(amount > 0)) return ElMessage.warning('請先在商品中填寫預估或實際價格。')
  const payerId = item.purchasedBy || item.assignedTo || props.userId || props.trip.ownerId
  const kind: ExpenseKind = item.shoppingType === 'shared' ? 'shared' : 'personal'
  const participantIds =
    kind === 'shared' ? (item.participantIds?.length ? item.participantIds : props.trip.members.map((member) => member.id)) : [payerId]
  try {
    await ElMessageBox.confirm(
      `建立「${item.name}」的旅行開銷 ${item.currency} ${amount.toLocaleString()} 嗎？`,
      '建立旅行開銷',
      { confirmButtonText: '建立開銷', cancelButtonText: '取消', type: 'success' },
    )
    const expense = await store.addExpense({
      tripId: props.trip.id,
      title: item.name,
      amount,
      payerId,
      kind,
      participantIds,
      splitMode: 'equal',
      shares: {},
      category: '購物',
      date: item.plannedDate || localDate(),
    })
    await store.updateShoppingItem({
      ...item,
      status: 'purchased',
      purchasedBy: payerId,
      purchasedAt: item.purchasedAt || Date.now(),
      expenseId: expense.id,
      actualTotalPrice: Number(item.actualTotalPrice) || amount,
    })
    ElMessage.success('已建立旅行開銷並連結商品。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '無法建立旅行開銷。')
    }
  }
}

onUnmounted(() => {
  clearShoppingImagePreview()
})
</script>

<template>
  <section class="trip-shopping-view" aria-label="購物清單">
    <TripShoppingCard
      :trip="trip"
      :items="items"
      :can-edit-trip="canEdit"
      :member-name="memberName"
      @add="openShoppingForm()"
      @edit="openShoppingForm"
      @duplicate="duplicate"
      @remove="remove"
      @status="updateStatus"
      @convert="convert"
      @batch-link="openBatchShoppingItineraryPicker($event)"
    />

    <ShoppingItemDialog
      v-model="showShopping"
      :editing="Boolean(editingShoppingId)"
      :saving="savingShopping"
      :form="shopping"
      :trip="trip"
      :image-display="shoppingImageDisplay"
      :image-url="shoppingImageUrl"
      :participant-ids="shoppingParticipantIds"
      :itinerary-item-ids="shoppingItineraryItemIds"
      :selected-itineraries="selectedShoppingItineraries"
      @update:image-url="shoppingImageUrl = $event"
      @update:participant-ids="shoppingParticipantIds = $event"
      @select-image="selectShoppingImage"
      @open-itinerary-picker="openShoppingItineraryPicker"
      @clear-itinerary="clearShoppingItinerary"
      @save="saveShoppingItem"
      @closed="resetShoppingForm"
    />

    <ShoppingItineraryPickerDialog
      v-model="showShoppingItineraryPicker"
      :mode="shoppingItineraryPickerMode"
      :day="shoppingItineraryPickerDay"
      :days="shoppingItineraryDays"
      :entries="shoppingItineraryEntries"
      :selected-ids="activeShoppingItineraryItemIds"
      :batch-count="batchShoppingItemIds.length"
      :format-date="formatDate"
      @update:day="shoppingItineraryPickerDay = $event"
      @toggle="selectShoppingItinerary"
      @clear="clearShoppingItinerary"
      @confirm="confirmShoppingItinerarySelection"
    />
  </section>
</template>

<style scoped>
.trip-shopping-view{display:grid;grid-column:1/-1;min-width:0}
</style>
