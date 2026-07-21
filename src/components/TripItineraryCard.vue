<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref, watch } from "vue";
import {
  Calendar,
  CaretBottom,
  CaretRight,
  Lock,
  Location,
  MoreFilled,
  Plus,
  Rank,
  ShoppingCart,
  TopRight,
  WarningFilled,
} from "@element-plus/icons-vue";
import Sortable from "sortablejs";
import type { ItineraryItem, ShoppingItem } from "../types";

interface ItineraryDay {
  date: string;
  entries: ItineraryItem[];
}

const props = defineProps<{
  days: ItineraryDay[];
  personalItems: ItineraryItem[];
  shoppingItems: ShoppingItem[];
  canEditTrip: boolean;
  sortingEnabled: boolean;
  formatDate: (date: string) => string;
  duration: (entry: ItineraryItem) => string;
  timeWarning: (entries: ItineraryItem[], index: number) => string;
  mapsUrl: (location: string, mapUrl?: string) => string;
}>();

const emit = defineEmits<{
  add: [];
  addAfter: [entry: ItineraryItem];
  addPersonal: [group: ItineraryItem];
  toggle: [entry: ItineraryItem];
  edit: [entry: ItineraryItem];
  remove: [entry: ItineraryItem];
  toggleSorting: [];
  sort: [payload: { date: string; oldIndex: number; newIndex: number }];
  sortPersonal: [
    payload: { parentId: string; oldIndex: number; newIndex: number },
  ];
  move: [
    payload: {
      itemId: string;
      from: string;
      to: string;
      oldIndex: number;
      newIndex: number;
    },
  ];
  createGroup: [payload: { entries: ItineraryItem[] }];
  editGroup: [group: ItineraryItem];
  dissolveGroup: [group: ItineraryItem];
}>();

const collapsedIds = ref(new Set<string>());
const sortableLists = new Map<string, HTMLElement>();
const sortableInstances = new Map<string, Sortable>();
const shoppingPreviewEntry = ref<ItineraryItem | null>(null);
const showShoppingPreview = ref(false);
const shoppingPreviewItems = computed(() =>
  shoppingPreviewEntry.value
    ? shoppingItemsFor(shoppingPreviewEntry.value)
    : [],
);
const selectedDayFilter = ref("all");
const groupingMode = ref(false);
const selectedGroupEntryIds = ref<string[]>([]);
const filteredDays = computed(() =>
  selectedDayFilter.value === "all"
    ? props.days
    : props.days.filter((day) => day.date === selectedDayFilter.value),
);

function dayNumber(date: string) {
  return props.days.findIndex((day) => day.date === date) + 1;
}

function activityKind(entry: ItineraryItem) {
  return entry.activityKind || "shared";
}
function isFreeActivity(entry: ItineraryItem) {
  return activityKind(entry) === "free";
}
function isItineraryGroup(entry: ItineraryItem) { return activityKind(entry) === "group"; }
function visibleDayEntries(day: ItineraryDay) { return day.entries.filter((entry) => !entry.itineraryGroupId); }
function groupMembers(day: ItineraryDay, group: ItineraryItem) { return day.entries.filter((entry) => entry.itineraryGroupId === group.id).sort((a, b) => (a.order ?? Number.MAX_SAFE_INTEGER) - (b.order ?? Number.MAX_SAFE_INTEGER) || (a.time || "").localeCompare(b.time || "")); }
function groupTypeSummary(day: ItineraryDay, group: ItineraryItem) { const counts = groupMembers(day, group).reduce<Record<string, number>>((all, item) => { all[item.type || "其他"] = (all[item.type || "其他"] || 0) + 1; return all }, {}); return Object.entries(counts).map(([type, count]) => `${type} ${count}`).join("、"); }
function toggleGroupingMode() { groupingMode.value = !groupingMode.value; if (!groupingMode.value) selectedGroupEntryIds.value = []; }
function toggleGroupEntry(entry: ItineraryItem, checked: boolean) { const selected = new Set(selectedGroupEntryIds.value); checked ? selected.add(entry.id) : selected.delete(entry.id); selectedGroupEntryIds.value = [...selected]; }
function createGroupFromSelection() { const selected = props.days.flatMap((day) => day.entries).filter((entry) => selectedGroupEntryIds.value.includes(entry.id)); if (selected.length < 2) return; emit("createGroup", { entries: selected }); groupingMode.value = false; selectedGroupEntryIds.value = []; }
function isCollapsed(entry: ItineraryItem) {
  return collapsedIds.value.has(entry.id);
}
function toggleCollapsed(entry: ItineraryItem) {
  const next = new Set(collapsedIds.value);
  next.has(entry.id) ? next.delete(entry.id) : next.add(entry.id);
  collapsedIds.value = next;
}
function expandAll() {
  collapsedIds.value = new Set();
}
function collapseAll() {
  collapsedIds.value = new Set(
    props.days.flatMap((day) => day.entries.map((entry) => entry.id)),
  );
}
const allEntriesExpanded = computed(() => {
  const entryIds = props.days.flatMap((day) => day.entries.map((entry) => entry.id))
  return entryIds.length > 0 && entryIds.every((id) => !collapsedIds.value.has(id))
})
function toggleAllEntries() {
  allEntriesExpanded.value ? collapseAll() : expandAll()
}
function personalEntries(group: ItineraryItem) {
  return props.personalItems
    .filter((entry) => entry.parentFreeActivityId === group.id)
    .map((entry) => ({ ...entry, type: entry.type || "個人行程" }))
    .sort(
      (a, b) =>
        (a.order ?? Number.MAX_SAFE_INTEGER) -
          (b.order ?? Number.MAX_SAFE_INTEGER) ||
        (a.time || "").localeCompare(b.time || ""),
    );
}
function personalTimeGroupLabel(group: ItineraryItem) {
  const entries = personalEntries(group)
  return entries.every((entry) => !entry.time) ? "未排時間" : "已安排時間"
}
function personalTimeWarning(group: ItineraryItem, index: number) {
  return props.timeWarning(personalEntries(group), index);
}
function shoppingItemsFor(entry: ItineraryItem) {
  return props.shoppingItems.filter(
    (item) => item.itineraryItemId === entry.id,
  );
}
function registerSortableList(key: string, element: Element | null) {
  if (element instanceof HTMLElement) sortableLists.set(key, element);
  else sortableLists.delete(key);
}
function destroySortables() {
  sortableInstances.forEach((instance) => instance.destroy());
  sortableInstances.clear();
}

function handleSortableEnd(
  sourceScope: string,
  event: {
    to: HTMLElement;
    item: HTMLElement;
    oldIndex?: number;
    newIndex?: number;
  },
) {
  const { oldIndex, newIndex } = event;
  const targetScope = event.to.dataset.sortScope;
  const itemId = event.item.dataset.itineraryId;
  if (!targetScope || !itemId || oldIndex == null || newIndex == null) return;
  if (sourceScope === targetScope) {
    if (oldIndex === newIndex) return;
    if (sourceScope.startsWith("day:")) {
      emit("sort", { date: sourceScope.slice(4), oldIndex, newIndex });
    } else {
      emit("sortPersonal", {
        parentId: sourceScope.slice("personal:".length),
        oldIndex,
        newIndex,
      });
    }
    return;
  }
  emit("move", {
    itemId,
    from: sourceScope,
    to: targetScope,
    oldIndex,
    newIndex,
  });
}

const sortableGroup = {
  name: "trip-itinerary",
  pull: (_to: Sortable, _from: Sortable, dragged: HTMLElement) =>
    !dragged.classList.contains("is-free-activity"),
  put: (_to: Sortable, _from: Sortable, dragged: HTMLElement) =>
    !dragged.classList.contains("is-free-activity"),
};

async function syncSortables() {
  await nextTick();
  destroySortables();
  if (!props.canEditTrip || !props.sortingEnabled) return;
  props.days.forEach((day) => {
    const key = `day:${day.date}`;
    const list = sortableLists.get(key);
    if (!list) return;
    sortableInstances.set(
      key,
      Sortable.create(list, {
        animation: 180,
        easing: "cubic-bezier(.2,.8,.2,1)",
        group: sortableGroup,
        handle: ".itinerary-drag-handle",
        draggable: ".itinerary-entry",
        delay: 160,
        delayOnTouchOnly: true,
        touchStartThreshold: 5,
        forceFallback: true,
        fallbackTolerance: 4,
        ghostClass: "itinerary-sort-ghost",
        chosenClass: "itinerary-sort-chosen",
        dragClass: "itinerary-sort-drag",
        onEnd: (event) => handleSortableEnd(key, event),
      }),
    );
  });
  props.days
    .flatMap((day) => day.entries.filter(isFreeActivity))
    .forEach((group) => {
      if (isCollapsed(group)) return;
      const key = `personal:${group.id}`;
      const list = sortableLists.get(key);
      if (!list) return;
      sortableInstances.set(
        key,
        Sortable.create(list, {
        animation: 180,
        easing: "cubic-bezier(.2,.8,.2,1)",
        group: sortableGroup,
        handle: ".personal-drag-handle",
          draggable: ".personal-itinerary-entry",
          delay: 160,
          delayOnTouchOnly: true,
          touchStartThreshold: 5,
          forceFallback: true,
          fallbackTolerance: 4,
          ghostClass: "itinerary-sort-ghost",
          chosenClass: "itinerary-sort-chosen",
          dragClass: "itinerary-sort-drag",
          onEnd: (event) => handleSortableEnd(key, event),
        }),
      );
    });
}

watch(
  () => [
    props.canEditTrip,
    props.sortingEnabled,
    props.days
      .map(
        (day) =>
          `${day.date}:${day.entries.map((entry) => entry.id).join(",")}`,
      )
      .join("|"),
    props.personalItems
      .map((entry) => `${entry.id}:${entry.parentFreeActivityId}`)
      .join("|"),
    selectedDayFilter.value,
    [...collapsedIds.value].join(","),
  ],
  () => {
    void syncSortables();
  },
  { immediate: true, flush: "post" },
);
onBeforeUnmount(destroySortables);

function itineraryTypeClass(type: string) {
  return (
    (
      {
        景點: "is-type-attraction",
        餐廳: "is-type-food",
        交通: "is-type-transport",
        住宿: "is-type-stay",
        商店: "is-type-shop",
      } as Record<string, string>
    )[type] || "is-type-default"
  );
}
function shoppingStatusLabel(status: ShoppingItem["status"]) {
  return (
    {
      wishlist: "想買",
      planned: "預計購買",
      purchased: "已購買",
      unavailable: "暫時缺貨",
      cancelled: "已取消",
    } as Record<ShoppingItem["status"], string>
  )[status];
}
function openShoppingPreview(entry: ItineraryItem) {
  shoppingPreviewEntry.value = entry;
  showShoppingPreview.value = true;
}
function handleEntryAction(
  command: string | number | object,
  entry: ItineraryItem,
) {
  if (command === "add-after") emit("addAfter", entry);
  if (command === "edit") emit("edit", entry);
  if (command === "remove") emit("remove", entry);
  if (command === "edit-group") emit("editGroup", entry);
  if (command === "dissolve-group") emit("dissolveGroup", entry);
}
function sharedLabel(entry: ItineraryItem) {
  return isItineraryGroup(entry) ? "地點群組" : isFreeActivity(entry) ? "自由活動" : "共用行程";
}
</script>

<template>
  <section id="itinerary" class="trip-detail-card itinerary-panel">
    <div class="detail-card-heading">
      <div>
        <p class="section-kicker">ITINERARY</p>
        <h2>每日行程</h2>
      </div>
      <div class="itinerary-heading-actions">
        <div
          class="itinerary-expand-actions"
          role="group"
          aria-label="展開或收合行程"
        >
          <el-button
            class="itinerary-expand-toggle"
            :aria-label="allEntriesExpanded ? '收合全部行程' : '展開全部行程'"
            @click="toggleAllEntries"
            ><span>{{ allEntriesExpanded ? "收合全部" : "展開全部" }}</span
            ><el-icon
              ><CaretBottom
                :class="{ 'itinerary-expand-toggle-icon': allEntriesExpanded }"
            /></el-icon></el-button
          >
        </div>
        <template v-if="canEditTrip"
          ><el-button
            class="itinerary-sort-toggle"
            :class="{ 'is-active': sortingEnabled }"
            :aria-pressed="sortingEnabled"
            @click="emit('toggleSorting')"
            ><el-icon><Rank /></el-icon
            ><span class="itinerary-sort-full">{{
              sortingEnabled ? "保存排序" : "調整排序"
            }}</span
            ><span class="itinerary-sort-short">排序</span></el-button
          ><el-button class="coral-button itinerary-add" @click="emit('add')"
            ><el-icon><Plus /></el-icon
            ><span class="itinerary-add-full">新增行程</span
            ><span class="itinerary-add-short">新增</span></el-button
          ><el-button class="itinerary-group-toggle" :class="{ 'is-active': groupingMode }" @click="toggleGroupingMode">{{ groupingMode ? '取消分組' : '建立群組' }}</el-button
          ><div class="itinerary-mobile-toolbar" role="group" aria-label="行程操作">
            <el-button
              class="itinerary-mobile-expand-toggle"
              :aria-label="allEntriesExpanded ? '收合全部行程' : '展開全部行程'"
              @click="toggleAllEntries"
              ><span>{{ allEntriesExpanded ? "收合全部" : "展開全部" }}</span
              ><el-icon><CaretBottom v-if="!allEntriesExpanded" /><CaretBottom v-else class="itinerary-mobile-collapse-icon" /></el-icon></el-button
            ><el-button
              class="itinerary-sort-toggle itinerary-mobile-sort"
              :class="{ 'is-active': sortingEnabled }"
              :aria-pressed="sortingEnabled"
              @click="emit('toggleSorting')"
              ><el-icon><Rank /></el-icon><span>{{ sortingEnabled ? "保存" : "排序" }}</span></el-button
            ><el-button class="coral-button itinerary-mobile-add" @click="emit('add')"
              ><el-icon><Plus /></el-icon><span>新增</span></el-button
            >
          </div
          ></template
        >
        <span v-else class="readonly-chip">唯讀</span>
      </div>
    </div>

    <div v-if="groupingMode" class="itinerary-grouping-bar"><span>勾選 2 個以上行程後建立地點群組</span><el-button :disabled="selectedGroupEntryIds.length < 2" class="itinerary-group-create" @click="createGroupFromSelection">建立群組（{{ selectedGroupEntryIds.length }}）</el-button></div>

    <div v-if="days.length > 1" class="itinerary-day-filter">
      <label for="itinerary-day-filter">查看日期</label>
      <el-select
        id="itinerary-day-filter"
        v-model="selectedDayFilter"
        class="itinerary-day-filter-select"
        aria-label="篩選每日行程日期"
      >
        <el-option label="全部天數" value="all" />
        <el-option
          v-for="(day, index) in days"
          :key="day.date"
          :label="`第 ${index + 1} 天・${formatDate(day.date)}`"
          :value="day.date"
        />
      </el-select>
    </div>

    <div v-if="days.length" class="itinerary-timeline">
      <section
        v-for="day in filteredDays"
        :key="day.date"
        class="itinerary-day"
        :aria-label="formatDate(day.date)"
      >
        <div class="day-heading">
          <span>DAY {{ dayNumber(day.date) }}</span>
          <h3>{{ formatDate(day.date) }}</h3>
        </div>
        <div
          class="itinerary-list"
          :data-sort-scope="`day:${day.date}`"
          :ref="
            (element) =>
              registerSortableList(`day:${day.date}`, element as Element | null)
          "
        >
          <article
            v-for="(entry, entryIndex) in visibleDayEntries(day)"
            :key="entry.id"
            class="itinerary-entry"
            :data-itinerary-id="entry.id"
            :class="[
              {
                'is-completed': entry.completed,
                'is-sortable-enabled': sortingEnabled && canEditTrip,
                'is-free-activity': isFreeActivity(entry),
                'is-itinerary-group': isItineraryGroup(entry),
              },
            ]"
          >
            <div class="itinerary-checkbox">
              <el-checkbox
                v-if="!isFreeActivity(entry) && !isItineraryGroup(entry) && !groupingMode"
                :model-value="entry.completed"
                :disabled="!canEditTrip"
                :aria-label="`將「${entry.title}」標示為${entry.completed ? '未完成' : '已完成'}`"
                @change="emit('toggle', entry)"
              /><el-checkbox v-else-if="groupingMode && !isFreeActivity(entry) && !isItineraryGroup(entry)" :model-value="selectedGroupEntryIds.includes(entry.id)" :aria-label="`選取「${entry.title}」建立群組`" @change="toggleGroupEntry(entry, Boolean($event))"
              /><span v-else class="free-activity-marker" aria-hidden="true"
                >✦</span
              >
            </div>
            <div
              class="itinerary-time"
              :aria-label="
                entry.endTime
                  ? `${entry.time} 至 ${entry.endTime}`
                  : entry.time || '未設定時間'
              "
            >
              <time>{{ entry.time || "未排時間" }}</time
              ><time v-if="entry.endTime" class="itinerary-end-time">{{
                entry.endTime
              }}</time>
            </div>
            <div class="itinerary-connector" aria-hidden="true">
              <span class="itinerary-dot"></span>
            </div>
            <div
              class="itinerary-card"
              :class="[
                isFreeActivity(entry)
                  ? 'is-free-card'
                  : isItineraryGroup(entry)
                    ? 'is-itinerary-group-card'
                  : itineraryTypeClass(entry.type),
              ]"
              >
              <div class="itinerary-card-header">
                <img
                  v-if="entry.imageUrl && !isFreeActivity(entry)"
                  class="itinerary-card-image"
                  :src="entry.imageUrl"
                  :alt="`${entry.title} 圖片`"
                />
                <div class="itinerary-card-heading">
                  <el-tooltip
                    v-if="sortingEnabled && canEditTrip"
                    content="長按並拖曳排序"
                    placement="top"
                    ><span class="itinerary-drag-handle" aria-hidden="true"
                      ><el-icon><Rank /></el-icon></span
                  ></el-tooltip>
                  <div>
                    <span
                      class="itinerary-scope-tag"
                      :class="{ 'is-free': isFreeActivity(entry) }"
                      >{{ sharedLabel(entry) }}</span
                    ><strong>{{ entry.title }}</strong>
                  </div>
                </div>
                <div class="itinerary-card-controls">
                  <el-button
                    class="itinerary-collapse-button"
                    text
                    circle
                    :aria-label="`${isCollapsed(entry) ? '展開' : '收合'}「${entry.title}」`"
                    :title="isCollapsed(entry) ? '展開行程' : '收合行程'"
                    @click="toggleCollapsed(entry)"
                    ><el-icon
                      ><CaretRight v-if="isCollapsed(entry)" /><CaretBottom
                        v-else /></el-icon></el-button
                  ><el-dropdown
                    v-if="canEditTrip"
                    trigger="click"
                    @command="handleEntryAction($event, entry)"
                    ><el-button
                      class="itinerary-more-button"
                      text
                      circle
                      aria-label="更多行程操作"
                      title="更多行程操作"
                      ><el-icon><MoreFilled /></el-icon></el-button
                    ><template #dropdown
                      ><el-dropdown-menu
                        ><el-dropdown-item v-if="isItineraryGroup(entry)" command="edit-group">編輯群組</el-dropdown-item><el-dropdown-item v-if="isItineraryGroup(entry)" command="dissolve-group" divided class="itinerary-delete-menu-item">解散群組</el-dropdown-item><el-dropdown-item v-if="!isItineraryGroup(entry)" command="add-after"
                          >在此後新增行程</el-dropdown-item
                        ><el-dropdown-item v-if="!isItineraryGroup(entry)" command="edit"
                          >編輯{{
                            isFreeActivity(entry) ? "自由活動" : "行程"
                          }}</el-dropdown-item
                        ><el-dropdown-item v-if="!isItineraryGroup(entry)"
                          command="remove"
                          divided
                          class="itinerary-delete-menu-item"
                          >刪除{{
                            isFreeActivity(entry) ? "自由活動" : "行程"
                          }}</el-dropdown-item
                        ></el-dropdown-menu
                      ></template
                    ></el-dropdown
                  >
                </div>
              </div>

              <div v-show="!isCollapsed(entry)" class="itinerary-card-body">
                <template v-if="isItineraryGroup(entry)">
                  <div class="itinerary-group-summary"><p><strong>{{ entry.location || '未設定區域' }}</strong><span>共 {{ groupMembers(day, entry).length }} 項</span><span v-if="groupTypeSummary(day, entry)">{{ groupTypeSummary(day, entry) }}</span></p><a v-if="entry.mapUrl || entry.location" :href="mapsUrl(entry.location || entry.title, entry.mapUrl)" target="_blank" rel="noopener"><el-icon><Location /></el-icon>在 Google Maps 開啟 <el-icon><TopRight /></el-icon></a></div>
                  <div class="itinerary-group-members"><article v-for="(child, childIndex) in groupMembers(day, entry)" :key="child.id" class="itinerary-group-member" :class="[itineraryTypeClass(child.type), { 'is-completed': child.completed }]"><el-checkbox :model-value="child.completed" :disabled="!canEditTrip" :aria-label="`將「${child.title}」標示為${child.completed ? '未完成' : '完成'}`" @change="emit('toggle', child)" /><img v-if="child.imageUrl" :src="child.imageUrl" :alt="`${child.title} 圖片`" /><span v-else class="itinerary-group-member-placeholder">{{ child.type.slice(0, 1) }}</span><span class="itinerary-group-member-copy"><strong>{{ child.title }}</strong><small><time>{{ child.time || '未排時間' }}</time><template v-if="child.endTime">－{{ child.endTime }}</template><em>{{ child.type }}</em><template v-if="duration(child)">· {{ duration(child) }}</template></small></span><el-dropdown v-if="canEditTrip" trigger="click" @command="handleEntryAction($event, child)"><el-button class="itinerary-more-button" text circle aria-label="更多子行程操作"><el-icon><MoreFilled /></el-icon></el-button><template #dropdown><el-dropdown-menu><el-dropdown-item command="edit">編輯行程</el-dropdown-item><el-dropdown-item command="add-after">在此後新增行程</el-dropdown-item><el-dropdown-item command="remove" divided class="itinerary-delete-menu-item">刪除行程</el-dropdown-item></el-dropdown-menu></template></el-dropdown><div class="itinerary-group-member-detail"><p v-if="timeWarning(groupMembers(day, entry), childIndex)" class="itinerary-time-warning"><el-icon><WarningFilled /></el-icon>{{ timeWarning(groupMembers(day, entry), childIndex) }}</p><p v-if="child.note" class="itinerary-note">{{ child.note }}</p><el-button v-if="shoppingItemsFor(child).length" class="itinerary-shopping-button" text @click.stop="openShoppingPreview(child)"><el-icon><ShoppingCart /></el-icon>採購清單 {{ shoppingItemsFor(child).length }} 項</el-button><div v-if="child.type === '交通' && child.transportDestinationName" class="itinerary-transport-route" aria-label="交通路線"><a v-if="child.mapUrl || child.location" class="itinerary-transport-stop is-linked" :href="mapsUrl(child.location || child.title, child.mapUrl)" target="_blank" rel="noopener"><span class="itinerary-transport-stop-label">出發</span><strong>{{ child.location || child.title }}</strong><el-icon><TopRight /></el-icon></a><p v-else class="itinerary-transport-stop"><span class="itinerary-transport-stop-label">出發</span><strong>{{ child.title }}</strong></p><span class="itinerary-transport-arrow" aria-hidden="true">→</span><a v-if="child.transportDestinationMapUrl || child.transportDestinationLocation" class="itinerary-transport-stop is-linked" :href="mapsUrl(child.transportDestinationLocation || child.transportDestinationName, child.transportDestinationMapUrl)" target="_blank" rel="noopener"><span class="itinerary-transport-stop-label">抵達</span><strong>{{ child.transportDestinationLocation || child.transportDestinationName }}</strong><el-icon><TopRight /></el-icon></a><p v-else class="itinerary-transport-stop"><span class="itinerary-transport-stop-label">抵達</span><strong>{{ child.transportDestinationName }}</strong></p></div><a v-else-if="child.mapUrl || child.location" class="itinerary-location is-linked" :href="mapsUrl(child.location, child.mapUrl)" target="_blank" rel="noopener"><el-icon><Location /></el-icon><span>{{ child.location || '在 Google Maps 開啟' }}</span><el-icon class="itinerary-external-icon"><TopRight /></el-icon></a><p v-else class="itinerary-location is-empty"><el-icon><Location /></el-icon><span>尚未設定地點</span></p></div></article></div>
                </template>
                <template v-if="!isFreeActivity(entry) && !isItineraryGroup(entry)"
                  ><p
                    v-if="entry.type || duration(entry)"
                    class="itinerary-card-meta"
                  >
                    <span
                      v-if="entry.type"
                      class="itinerary-type-chip"
                      :class="itineraryTypeClass(entry.type)"
                      >{{ entry.type }}</span
                    ><span
                      v-if="entry.type && duration(entry)"
                      aria-hidden="true"
                      >·</span
                    ><span v-if="duration(entry)">{{ duration(entry) }}</span>
                  </p>
                  <p
                    v-if="timeWarning(day.entries, entryIndex)"
                    class="itinerary-time-warning"
                  >
                    <el-icon><WarningFilled /></el-icon
                    >{{ timeWarning(day.entries, entryIndex) }}
                  </p>
                  <p v-if="entry.note" class="itinerary-note">
                    {{ entry.note }}
                  </p>
                  <el-button
                    v-if="shoppingItemsFor(entry).length"
                    class="itinerary-shopping-button"
                    text
                    @click.stop="openShoppingPreview(entry)"
                    ><el-icon><ShoppingCart /></el-icon>採購清單
                    {{ shoppingItemsFor(entry).length }} 項</el-button
                  >
                  <div
                    v-if="
                      entry.type === '交通' && entry.transportDestinationName
                    "
                    class="itinerary-transport-route"
                    aria-label="交通路線"
                  >
                    <a
                      v-if="entry.mapUrl || entry.location"
                      class="itinerary-transport-stop is-linked"
                      :href="
                        mapsUrl(entry.location || entry.title, entry.mapUrl)
                      "
                      target="_blank"
                      rel="noopener"
                      :title="`在地圖中開啟出發站：${entry.location || entry.title}`"
                      ><span class="itinerary-transport-stop-label">出發</span
                      ><strong>{{ entry.location || entry.title }}</strong
                      ><el-icon><TopRight /></el-icon
                    ></a>
                    <p v-else class="itinerary-transport-stop">
                      <span class="itinerary-transport-stop-label">出發</span
                      ><strong>{{ entry.title }}</strong>
                    </p>
                    <span class="itinerary-transport-arrow" aria-hidden="true"
                      >→</span
                    ><a
                      v-if="
                        entry.transportDestinationMapUrl ||
                        entry.transportDestinationLocation
                      "
                      class="itinerary-transport-stop is-linked"
                      :href="
                        mapsUrl(
                          entry.transportDestinationLocation ||
                            entry.transportDestinationName,
                          entry.transportDestinationMapUrl,
                        )
                      "
                      target="_blank"
                      rel="noopener"
                      :title="`在地圖中開啟抵達站：${entry.transportDestinationLocation || entry.transportDestinationName}`"
                      ><span class="itinerary-transport-stop-label">抵達</span
                      ><strong>{{
                        entry.transportDestinationLocation ||
                        entry.transportDestinationName
                      }}</strong
                      ><el-icon><TopRight /></el-icon
                    ></a>
                    <p v-else class="itinerary-transport-stop">
                      <span class="itinerary-transport-stop-label">抵達</span
                      ><strong>{{ entry.transportDestinationName }}</strong>
                    </p>
                  </div>
                  <template v-else
                    ><a
                      v-if="entry.mapUrl || entry.location"
                      class="itinerary-location is-linked"
                      :href="mapsUrl(entry.location, entry.mapUrl)"
                      target="_blank"
                      rel="noopener"
                      :title="`在地圖中開啟：${entry.location || entry.title}`"
                      ><el-icon><Location /></el-icon
                      ><span>{{ entry.location || "在 Google Maps 開啟" }}</span
                      ><el-icon class="itinerary-external-icon"
                        ><TopRight /></el-icon
                    ></a>
                    <p v-else class="itinerary-location is-empty">
                      <el-icon><Location /></el-icon><span>尚未設定地點</span>
                    </p></template
                  ></template
                >
                <template v-else-if="isFreeActivity(entry)"
                  ><p
                    v-if="entry.note"
                    class="itinerary-note free-activity-note"
                  >
                    {{ entry.note }}
                  </p>
                  <div class="free-activity-personal-heading">
                    <div>
                      <div class="free-activity-personal-title-row">
                        <strong>我的行程</strong
                        ><span class="free-activity-personal-count"
                          >{{ personalEntries(entry).length }} 筆</span
                        >
                      </div>
                      <span class="free-activity-personal-private"
                        ><el-icon><Lock /></el-icon>僅自己可見</span
                      >
                    </div>
                    <el-button
                      v-if="canEditTrip"
                      class="free-activity-add-button"
                      @click="emit('addPersonal', entry)"
                      ><el-icon><Plus /></el-icon>新增個人行程</el-button
                    >
                  </div>
                  <div
                    v-if="personalEntries(entry).length"
                    class="personal-itinerary-list"
                    :data-sort-scope="`personal:${entry.id}`"
                    :ref="
                      (element) =>
                        registerSortableList(
                          `personal:${entry.id}`,
                          element as Element | null,
                        )
                    "
                  >
                    <div class="personal-itinerary-group-heading">
                      <span>{{ personalTimeGroupLabel(entry) }}</span
                      ><small>{{ personalEntries(entry).length }}</small>
                    </div>
                    <article
                      v-for="(personal, personalIndex) in personalEntries(entry)"
                      :key="personal.id"
                      class="personal-itinerary-entry"
                      :data-itinerary-id="personal.id"
                      :class="{
                        'is-completed': personal.completed,
                        'is-sortable-enabled': sortingEnabled && canEditTrip,
                      }"
                    >
                      <div class="personal-itinerary-time">
                        <time>{{ personal.time || "未排時間" }}</time
                        ><time v-if="personal.endTime">{{
                          personal.endTime
                        }}</time>
                      </div>
                      <span
                        class="personal-itinerary-dot"
                        aria-hidden="true"
                      ></span>
                      <div
                        class="personal-itinerary-card"
                        :class="itineraryTypeClass(personal.type)"
                      >
                        <el-checkbox
                          :model-value="personal.completed"
                          :disabled="!canEditTrip"
                          :aria-label="`將「${personal.title}」標示為${personal.completed ? '未完成' : '完成'}`"
                          @change="emit('toggle', personal)"
                        /><img
                          v-if="personal.imageUrl"
                          class="personal-itinerary-image"
                          :src="personal.imageUrl"
                          :alt="`${personal.title} 圖片`"
                        />
                        <div class="personal-itinerary-copy">
                          <div class="personal-itinerary-title">
                            <el-tooltip
                              v-if="sortingEnabled && canEditTrip"
                              content="長按並拖曳排序"
                              placement="top"
                              ><span
                                class="personal-drag-handle"
                                aria-hidden="true"
                                ><el-icon><Rank /></el-icon></span></el-tooltip
                            ><strong>{{ personal.title }}</strong>
                          </div>
                          <p class="personal-itinerary-time-detail">
                            <span v-if="personal.time"
                              >{{ personal.time
                              }}<template v-if="personal.endTime"
                                >－{{ personal.endTime }}</template
                              ></span
                            ><span v-else>未排時間</span>
                          </p>
                          <p class="personal-itinerary-meta">
                            <span
                              v-if="personal.type"
                              class="itinerary-type-chip"
                              :class="itineraryTypeClass(personal.type)"
                              >{{ personal.type }}</span
                            ><span
                              v-if="personal.type && duration(personal)"
                              aria-hidden="true"
                              >·</span
                            ><span v-if="duration(personal)">{{
                              duration(personal)
                            }}</span>
                          </p>
                          <p
                            v-if="personalTimeWarning(entry, personalIndex)"
                            class="itinerary-time-warning personal-itinerary-time-warning"
                          >
                            <el-icon><WarningFilled /></el-icon
                            >{{ personalTimeWarning(entry, personalIndex) }}
                          </p>
                          <p
                            v-if="personal.note"
                            class="personal-itinerary-note"
                          >
                            {{ personal.note }}
                          </p>
                          <el-button
                            v-if="shoppingItemsFor(personal).length"
                            class="itinerary-shopping-button personal-itinerary-shopping-button"
                            text
                            @click.stop="openShoppingPreview(personal)"
                            ><el-icon><ShoppingCart /></el-icon>採購清單
                            {{ shoppingItemsFor(personal).length }} 項</el-button
                          >
                          <div
                            v-if="
                              personal.type === '交通' &&
                              personal.transportDestinationName
                            "
                            class="itinerary-transport-route personal-transport-route"
                            aria-label="交通路線"
                          >
                            <a
                              v-if="personal.mapUrl || personal.location"
                              class="itinerary-transport-stop is-linked"
                              :href="
                                mapsUrl(
                                  personal.location || personal.title,
                                  personal.mapUrl,
                                )
                              "
                              target="_blank"
                              rel="noopener"
                              :title="`在地圖中開啟出發站：${personal.location || personal.title}`"
                              ><span class="itinerary-transport-stop-label"
                                >出發</span
                              ><strong>{{
                                personal.location || personal.title
                              }}</strong
                              ><el-icon><TopRight /></el-icon
                            ></a>
                            <p v-else class="itinerary-transport-stop">
                              <span class="itinerary-transport-stop-label"
                                >出發</span
                              ><strong>{{ personal.title }}</strong>
                            </p>
                            <span
                              class="itinerary-transport-arrow"
                              aria-hidden="true"
                              >→</span
                            ><a
                              v-if="
                                personal.transportDestinationMapUrl ||
                                personal.transportDestinationLocation
                              "
                              class="itinerary-transport-stop is-linked"
                              :href="
                                mapsUrl(
                                  personal.transportDestinationLocation ||
                                    personal.transportDestinationName,
                                  personal.transportDestinationMapUrl,
                                )
                              "
                              target="_blank"
                              rel="noopener"
                              :title="`在地圖中開啟抵達站：${personal.transportDestinationLocation || personal.transportDestinationName}`"
                              ><span class="itinerary-transport-stop-label"
                                >抵達</span
                              ><strong>{{
                                personal.transportDestinationLocation ||
                                personal.transportDestinationName
                              }}</strong
                              ><el-icon><TopRight /></el-icon
                            ></a>
                            <p v-else class="itinerary-transport-stop">
                              <span class="itinerary-transport-stop-label"
                                >抵達</span
                              ><strong>{{
                                personal.transportDestinationName
                              }}</strong>
                            </p>
                          </div>
                          <template v-else
                            ><a
                              v-if="personal.mapUrl || personal.location"
                              class="itinerary-location is-linked personal-itinerary-location"
                              :href="
                                mapsUrl(
                                  personal.location || personal.title,
                                  personal.mapUrl,
                                )
                              "
                              target="_blank"
                              rel="noopener"
                              :title="`在地圖中開啟：${personal.location || personal.title}`"
                              ><el-icon><Location /></el-icon
                              ><span>{{
                                personal.location || "在 Google Maps 開啟"
                              }}</span
                              ><el-icon class="itinerary-external-icon"
                                ><TopRight /></el-icon
                            ></a>
                            <p
                              v-else
                              class="itinerary-location is-empty personal-itinerary-location"
                            >
                              <el-icon><Location /></el-icon
                              ><span>尚未設定地點</span>
                            </p></template
                          >
                        </div>
                        <el-dropdown
                          v-if="canEditTrip"
                          trigger="click"
                          @command="handleEntryAction($event, personal)"
                          ><el-button
                            class="personal-more-button"
                            text
                            circle
                            aria-label="更多個人行程操作"
                            title="更多個人行程操作"
                            ><el-icon><MoreFilled /></el-icon></el-button
                          ><template #dropdown
                            ><el-dropdown-menu
                              ><el-dropdown-item command="edit"
                                >編輯我的行程</el-dropdown-item
                              ><el-dropdown-item
                                command="remove"
                                divided
                                class="itinerary-delete-menu-item"
                                >刪除我的行程</el-dropdown-item
                              ></el-dropdown-menu
                            ></template
                          ></el-dropdown
                        >
                      </div>
                    </article>
                  </div>
                  <div v-else class="personal-itinerary-empty">
                    <span>你尚未安排個人行程</span
                    ><el-button
                      v-if="canEditTrip"
                      text
                      @click="emit('addPersonal', entry)"
                      >新增個人行程</el-button
                    >
                  </div></template
                >
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
    <div v-else class="detail-empty-state">
      <el-icon><Calendar /></el-icon>
      <div>
        <strong>還沒有安排行程</strong>
        <p>先建立共用行程，或新增一段自由活動讓旅伴各自安排。</p>
      </div>
      <el-button v-if="canEditTrip" class="coral-button" @click="emit('add')"
        >新增第一個行程</el-button
      >
    </div>
  </section>

  <el-dialog
    v-model="showShoppingPreview"
    :title="
      shoppingPreviewEntry
        ? `${shoppingPreviewEntry.title}・採購清單`
        : '採購清單'
    "
    class="itinerary-shopping-dialog"
    width="min(92vw, 480px)"
    ><p class="shopping-dialog-intro">這些商品已關聯到此行程。</p>
    <ul class="itinerary-shopping-list">
      <li
        v-for="item in shoppingPreviewItems"
        :key="item.id"
        class="itinerary-shopping-item"
      >
        <img v-if="item.imageUrl" :src="item.imageUrl" :alt="item.name" /><span
          v-else
          class="itinerary-shopping-item-icon"
          ><el-icon><ShoppingCart /></el-icon
        ></span>
        <div>
          <strong>{{ item.name }}</strong>
          <p>
            <span>{{ item.category }}</span
            ><span v-if="item.storeName" class="itinerary-shopping-store"
              >・{{ item.storeName }}</span
            >
          </p>
        </div>
        <span class="itinerary-shopping-status" :class="`is-${item.status}`">{{
          shoppingStatusLabel(item.status)
        }}</span>
      </li>
    </ul></el-dialog
  >
</template>

<style scoped>
.trip-detail-card {
  border: 1px solid #e1e8e3;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 8px 24px rgba(18, 63, 58, 0.06);
}
.itinerary-panel {
  padding: 24px;
  overflow: visible;
}
.detail-card-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 14px;
  padding-bottom: 17px;
  border-bottom: 1px solid #e8eeea;
}
.section-kicker {
  margin: 0 0 4px;
  color: #d1826e;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 1.4px;
}
.detail-card-heading h2 {
  margin: 0;
  color: #163b37;
  font-size: 20px;
  line-height: 1.35;
}
.itinerary-heading-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}
.itinerary-expand-actions {
  display: flex;
  align-items: center;
}
.itinerary-expand-toggle {
  min-height: 42px;
  padding: 0 12px;
  border-color: #d3e3dc;
  border-radius: 10px;
  background: #f8fbf9;
  color: #416d62;
  font-size: 13px;
  font-weight: 700;
}
.itinerary-expand-toggle:hover,
.itinerary-expand-toggle:focus-visible {
  border-color: #aacbbf;
  background: #eef5f0;
  color: #163b37;
}
.itinerary-expand-toggle-icon {
  transform: rotate(180deg);
}
.itinerary-sort-toggle,
.coral-button {
  min-height: 42px;
  border-radius: 10px;
  font-weight: 700;
}
.itinerary-sort-toggle {
  border-color: #bfd7cd;
  color: #2f7d70;
}
.itinerary-sort-toggle.is-active {
  border-color: #123f3a;
  background: #123f3a;
  color: #fff;
}
.coral-button {
  border: 0;
  background: #ff735c;
  color: #fff;
}
.coral-button:hover,
.coral-button:focus-visible {
  background: #e7644e;
  color: #fff;
}
.itinerary-sort-short,
.itinerary-add-short {
  display: none;
}
.readonly-chip {
  display: inline-flex;
  align-items: center;
  min-height: 32px;
  padding: 0 10px;
  border-radius: 999px;
  background: #eef5f0;
  color: #62766f;
  font-size: 13px;
  font-weight: 700;
}
.itinerary-day-filter {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 9px;
  margin-top: 16px;
}
.itinerary-day-filter label {
  color: #6b7d78;
  font-size: 13px;
  font-weight: 700;
  white-space: nowrap;
}
.itinerary-day-filter-select {
  width: min(100%, 290px);
}
.itinerary-day-filter-select :deep(.el-select__wrapper) {
  min-height: 40px;
  border: 1px solid #d9e7e1;
  border-radius: 10px;
  box-shadow: none;
}
.itinerary-day-filter-select :deep(.el-select__wrapper:hover),
.itinerary-day-filter-select :deep(.el-select__wrapper.is-focused) {
  border-color: #8ab8a9;
  box-shadow: 0 0 0 3px rgba(47, 125, 112, 0.1);
}
.itinerary-timeline {
  display: grid;
  gap: 26px;
  margin-top: 21px;
}
.day-heading {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin-bottom: 14px;
}
.day-heading span {
  padding: 4px 7px;
  border-radius: 6px;
  background: #eef5f0;
  color: #2f7d70;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.7px;
}
.day-heading h3 {
  margin: 0;
  color: #315e55;
  font-size: 14px;
  line-height: 1.5;
}
.itinerary-list {
  display: grid;
  gap: 11px;
}
.itinerary-entry {
  position: relative;
  display: grid;
  grid-template-columns: 34px 76px 20px minmax(0, 1fr);
  min-width: 0;
}
.itinerary-entry.is-sortable-enabled,
.personal-itinerary-entry.is-sortable-enabled {
  cursor: grab;
}
.itinerary-checkbox {
  display: flex;
  padding-top: 16px;
}
.itinerary-checkbox :deep(.el-checkbox) {
  width: 32px;
  height: 32px;
  margin: -6px 0 0;
}
.itinerary-checkbox :deep(.el-checkbox__inner) {
  width: 17px;
  height: 17px;
  border-color: #b8cac2;
}
.free-activity-marker {
  display: grid;
  width: 26px;
  height: 18px;
  place-items: center;
  margin: -2px 0 0;
  color: #8d6927;
  font-size: 14px;
  line-height: 1;
}
.itinerary-time {
  display: grid;
  align-content: start;
  gap: 3px;
  padding: 16px 8px 0 0;
  color: #84948f;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  line-height: 1.3;
}
.itinerary-time time:first-child {
  color: #2c6659;
  font-weight: 800;
}
.itinerary-end-time {
  color: #91a19b;
}
.itinerary-connector {
  position: relative;
  display: flex;
  justify-content: center;
}
.itinerary-connector::after {
  position: absolute;
  top: 22px;
  bottom: -16px;
  width: 1px;
  background: #dce8e2;
  content: "";
}
.itinerary-entry:last-child .itinerary-connector::after {
  display: none;
}
.itinerary-dot {
  position: relative;
  z-index: 1;
  width: 10px;
  height: 10px;
  margin-top: 18px;
  border: 2px solid #4f9e89;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 0 0 4px #fff;
}
.is-completed .itinerary-dot {
  border-color: #2f7d70;
  background: #2f7d70;
}
.is-free-activity .itinerary-dot {
  border-color: #c49b45;
  background: #fff4d9;
}
.itinerary-card {
  min-width: 0;
  padding: 14px 15px;
  border: 1px solid #e1e9e4;
  border-radius: 12px;
  background: #fbfcfa;
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    opacity 0.18s ease;
}
.itinerary-card:hover,
.itinerary-card:focus-within {
  border-color: #abcfc1;
  box-shadow: 0 6px 16px rgba(18, 63, 58, 0.07);
}
.is-completed .itinerary-card {
  opacity: 0.65;
}
.itinerary-card.is-free-card {
  border-color: #ead8a8;
  background: #fffaf0;
}
.itinerary-card-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.itinerary-card-image {
  width: 52px;
  height: 52px;
  flex: 0 0 52px;
  border: 1px solid rgba(37, 86, 76, 0.12);
  border-radius: 9px;
  object-fit: cover;
}
.itinerary-card-heading {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: flex-start;
  gap: 6px;
}
.itinerary-card-heading > div {
  min-width: 0;
}
.itinerary-card-heading strong {
  display: block;
  min-width: 0;
  overflow-wrap: anywhere;
  color: #173d37;
  font-size: 16px;
  font-weight: 700;
  line-height: 1.45;
}
.is-completed .itinerary-card-heading strong {
  text-decoration: line-through;
}
.itinerary-scope-tag {
  display: inline-flex;
  margin-bottom: 3px;
  padding: 2px 7px;
  border-radius: 999px;
  background: #e7f4ed;
  color: #26705d;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.4;
}
.itinerary-scope-tag.is-free {
  background: #fff0cf;
  color: #8a621c;
}
.itinerary-card-controls {
  display: flex;
  flex: 0 0 auto;
  gap: 1px;
}
.itinerary-collapse-button,
.itinerary-more-button {
  width: 36px !important;
  min-width: 36px !important;
  height: 36px !important;
  margin: -4px -4px 0 0;
  padding: 0 !important;
  color: #69847b;
}
.itinerary-collapse-button:hover,
.itinerary-collapse-button:focus-visible,
.itinerary-more-button:hover,
.itinerary-more-button:focus-visible {
  background: #eff6f2;
  color: #236c59;
}
.itinerary-drag-handle {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  margin: -6px 0 0 -7px;
  border-radius: 8px;
  color: #4d8d7c;
  cursor: grab;
  touch-action: none;
}
.itinerary-drag-handle:hover {
  background: #eaf5ef;
  color: #155b4b;
}
.itinerary-card-body {
  min-width: 0;
}
.itinerary-card-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin: 5px 0 7px;
  color: #7f918b;
  font-size: 13px;
  line-height: 1.4;
}
.itinerary-type-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 6px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 800;
  line-height: 1.35;
}
.itinerary-type-chip.is-type-attraction {
  background: #dceee3;
  color: #26705d;
}
.itinerary-type-chip.is-type-food {
  background: #fde4dd;
  color: #aa594b;
}
.itinerary-type-chip.is-type-transport {
  background: #dcebf1;
  color: #397487;
}
.itinerary-type-chip.is-type-stay {
  background: #ebe3f4;
  color: #775f94;
}
.itinerary-type-chip.is-type-shop {
  background: #fff0cf;
  color: #8a621c;
}
.itinerary-time-warning {
  display: flex;
  align-items: center;
  gap: 4px;
  margin: 6px 0;
  color: #a86821;
  font-size: 12px;
  line-height: 1.4;
}
.personal-itinerary-time-warning {
  color: #a86821 !important;
  font-weight: 700;
}
.itinerary-note {
  margin: 6px 0;
  color: #6b7d78;
  font-size: 13px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.itinerary-location {
  display: flex;
  align-items: flex-start;
  min-width: 0;
  gap: 5px;
  margin: 0;
  font-size: 13px;
  line-height: 1.45;
}
.itinerary-location .el-icon {
  flex: 0 0 auto;
  margin-top: 1px;
  font-size: 15px;
}
.itinerary-location span {
  min-width: 0;
  overflow-wrap: anywhere;
}
.itinerary-location.is-linked {
  color: #287761;
  text-decoration: none;
}
.itinerary-location.is-linked:hover span {
  text-decoration: underline;
}
.itinerary-location.is-empty {
  color: #9aa7a2;
  font-style: italic;
}
.itinerary-shopping-button {
  min-height: 32px;
  margin: 0 0 7px -6px;
  padding: 0 7px;
  color: #26705d;
  font-weight: 700;
}
.personal-itinerary-shopping-button {
  margin-top: 2px;
}
.free-activity-note {
  margin-bottom: 12px;
}
.free-activity-personal-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 11px 0 9px;
  border-top: 1px solid #efdfb7;
}
.free-activity-personal-heading > div {
  display: grid;
  gap: 1px;
}
.free-activity-personal-heading strong {
  color: #6e5528;
  font-size: 13px;
}
.free-activity-personal-heading span {
  color: #8c7a58;
  font-size: 12px;
}
.free-activity-add-button {
  min-height: 36px;
  border-color: #d7ba75;
  border-radius: 8px;
  background: #fffdf8;
  color: #80601d;
  font-weight: 700;
}
.free-activity-add-button:hover,
.free-activity-add-button:focus-visible {
  border-color: #b98a2b;
  background: #fff4d9;
  color: #654607;
}
.personal-itinerary-list {
  display: grid;
  gap: 7px;
  padding: 2px 0 2px 12px;
  border-left: 2px solid #ead8a8;
}
.personal-itinerary-entry {
  position: relative;
  display: grid;
  grid-template-columns: 52px 10px minmax(0, 1fr);
  gap: 8px;
  align-items: start;
}
.personal-itinerary-time {
  display: grid;
  justify-items: end;
  gap: 2px;
  padding-top: 11px;
  color: #8a8170;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
}
.personal-itinerary-time time:first-child {
  color: #765f36;
  font-weight: 800;
}
.personal-itinerary-dot {
  width: 8px;
  height: 8px;
  margin-top: 15px;
  border: 2px solid #b58b3a;
  border-radius: 50%;
  background: #fffaf0;
}
.personal-itinerary-card {
  display: flex;
  align-items: flex-start;
  gap: 7px;
  min-width: 0;
  padding: 9px;
  border: 1px solid #eadfca;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.72);
}
.personal-itinerary-card :deep(.el-checkbox) {
  flex: 0 0 auto;
  margin-top: 1px;
}
.personal-itinerary-copy {
  min-width: 0;
  flex: 1;
}
.personal-itinerary-copy strong {
  display: inline;
  color: #324a43;
  font-size: 14px;
  line-height: 1.45;
  overflow-wrap: anywhere;
}
.personal-itinerary-copy p {
  display: flex;
  align-items: flex-start;
  gap: 4px;
  margin: 3px 0 0;
  color: #72827d;
  font-size: 12px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.personal-itinerary-copy p .el-icon {
  margin-top: 1px;
  flex: 0 0 auto;
}
.personal-itinerary-copy a {
  color: #287761;
  text-decoration: none;
}
.personal-itinerary-copy a:hover {
  text-decoration: underline;
}
.personal-itinerary-note {
  color: #8a8170 !important;
}
.personal-drag-handle {
  display: inline-flex;
  width: 26px;
  height: 26px;
  align-items: center;
  justify-content: center;
  margin: -5px 2px -5px -6px;
  border-radius: 7px;
  color: #9b7b44;
  cursor: grab;
  touch-action: none;
}
.personal-drag-handle:hover {
  background: #fff0cf;
}
.personal-more-button {
  width: 36px !important;
  min-width: 36px !important;
  height: 36px !important;
  margin: -3px -3px 0 0;
  padding: 0 !important;
  color: #8b7651;
}
.personal-more-button:hover,
.personal-more-button:focus-visible {
  background: #fff0cf;
  color: #684e1c;
}
.personal-itinerary-entry.is-completed {
  opacity: 0.65;
}
.personal-itinerary-entry.is-completed strong {
  text-decoration: line-through;
}
.personal-itinerary-empty {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 14px 12px;
  margin-left: 12px;
  border: 1px dashed #decfae;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.52);
  color: #81755f;
  font-size: 13px;
}
.personal-itinerary-empty :deep(.el-button) {
  color: #80601d;
  font-weight: 700;
}
.detail-empty-state {
  display: grid;
  place-items: center;
  gap: 10px;
  padding: 42px 16px;
  text-align: center;
  color: #6b7d78;
}
.detail-empty-state > .el-icon {
  font-size: 30px;
  color: #9db8ae;
}
.detail-empty-state strong {
  color: #244a43;
  font-size: 16px;
}
.detail-empty-state p {
  margin: 5px 0 8px;
  font-size: 14px;
  line-height: 1.55;
}
.shopping-dialog-intro {
  margin: 0 0 14px;
  color: #6b7d78;
  font-size: 14px;
}
.itinerary-shopping-list {
  display: grid;
  gap: 9px;
  padding: 0;
  margin: 0;
  list-style: none;
}
.itinerary-shopping-item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  padding: 10px;
  border: 1px solid #e1e9e4;
  border-radius: 10px;
  background: #fbfcfa;
}
.itinerary-shopping-item > img,
.itinerary-shopping-item-icon {
  display: grid;
  width: 38px;
  height: 38px;
  flex: 0 0 38px;
  place-items: center;
  border-radius: 8px;
  object-fit: cover;
  background: #eef5f0;
  color: #2f7d70;
}
.itinerary-shopping-item > div {
  min-width: 0;
  flex: 1;
}
.itinerary-shopping-item strong {
  display: block;
  overflow-wrap: anywhere;
  color: #163b37;
  font-size: 14px;
  line-height: 1.4;
}
.itinerary-shopping-item p {
  margin: 2px 0 0;
  color: #6b7d78;
  font-size: 12px;
}
.itinerary-shopping-status {
  padding: 3px 6px;
  border-radius: 999px;
  background: #eef5f0;
  color: #2f7d70;
  font-size: 11px;
  font-weight: 700;
}
.itinerary-shopping-status.is-purchased {
  background: #e3f2e9;
  color: #28725b;
}
:global(.itinerary-delete-menu-item) {
  color: #c36358;
}
:global(.itinerary-sort-ghost) {
  opacity: 0.34;
}
.itinerary-entry:global(.itinerary-sort-ghost) .itinerary-card,
.personal-itinerary-entry:global(.itinerary-sort-ghost)
  .personal-itinerary-card {
  border-color: #b89348;
  border-style: dashed;
  box-shadow: none;
}
:global(.itinerary-sort-chosen) .itinerary-card,
:global(.itinerary-sort-chosen) .personal-itinerary-card {
  box-shadow: 0 12px 26px rgba(18, 63, 58, 0.14);
}
@media (max-width: 720px) {
  .itinerary-panel {
    padding: 18px;
  }
  .detail-card-heading {
    flex-direction: column;
  }
  .itinerary-heading-actions {
    width: 100%;
    justify-content: stretch;
  }
  .itinerary-day-filter {
    align-items: stretch;
    flex-direction: column;
    gap: 5px;
    margin-top: 14px;
  }
  .itinerary-day-filter-select {
    width: 100%;
  }
  .itinerary-expand-actions {
    flex: 1;
  }
  .itinerary-expand-actions :deep(.el-button) {
    flex: 1;
  }
  .itinerary-sort-full,
  .itinerary-add-full {
    display: none;
  }
  .itinerary-sort-short,
  .itinerary-add-short {
    display: inline;
  }
  .itinerary-sort-toggle,
  .coral-button {
    min-height: 40px;
    padding: 0 11px;
  }
  .itinerary-entry {
    grid-template-columns: 32px 59px 16px minmax(0, 1fr);
  }
  .itinerary-time {
    padding-top: 14px;
    font-size: 12px;
  }
  .itinerary-checkbox {
    padding-top: 14px;
  }
  .itinerary-dot {
    margin-top: 16px;
  }
  .itinerary-connector::after {
    top: 19px;
  }
  .itinerary-card {
    padding: 12px;
  }
  .itinerary-card-image {
    width: 44px;
    height: 44px;
    flex-basis: 44px;
  }
  .itinerary-card-heading strong {
    font-size: 15px;
  }
  .itinerary-collapse-button,
  .itinerary-more-button {
    width: 40px !important;
    min-width: 40px !important;
    height: 40px !important;
  }
  .itinerary-drag-handle {
    width: 40px;
    height: 40px;
    margin: -9px 0 0 -8px;
  }
  .free-activity-personal-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .free-activity-add-button {
    width: 100%;
    min-height: 40px;
  }
  .personal-itinerary-list {
    padding-left: 9px;
  }
  .personal-itinerary-entry {
    grid-template-columns: 43px 8px minmax(0, 1fr);
    gap: 6px;
  }
  .personal-itinerary-time {
    font-size: 10px;
  }
  .personal-itinerary-card {
    padding: 8px;
  }
  .personal-more-button {
    width: 40px !important;
    min-width: 40px !important;
    height: 40px !important;
  }
  .personal-itinerary-empty {
    align-items: flex-start;
    flex-direction: column;
    margin-left: 9px;
  }
  .personal-itinerary-empty :deep(.el-button) {
    padding-left: 0;
  }
}
@media (max-width: 390px) {
  .itinerary-panel {
    padding: 16px;
  }
  .itinerary-entry {
    grid-template-columns: 30px 53px 14px minmax(0, 1fr);
  }
  .itinerary-card {
    padding: 11px;
  }
  .itinerary-card-meta,
  .itinerary-location {
    font-size: 12px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .itinerary-card {
    transition: none;
  }
}
.itinerary-transport-route {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 20px minmax(0, 1fr);
  align-items: center;
  gap: 4px;
  margin: 1px 0 2px;
}
.itinerary-transport-stop {
  display: grid;
  position: relative;
  min-width: 0;
  gap: 2px;
  margin: 0;
  padding: 7px 20px 7px 8px;
  border: 1px solid #d9e8e7;
  border-radius: 9px;
  background: rgba(255, 255, 255, 0.6);
  color: #4f6964;
  line-height: 1.35;
}
.itinerary-transport-stop.is-linked {
  color: #276f65;
  text-decoration: none;
}
.itinerary-transport-stop.is-linked:hover,
.itinerary-transport-stop.is-linked:focus-visible {
  border-color: #86b9ae;
  background: #f7fcfa;
  outline: none;
}
.itinerary-transport-stop.is-linked:hover strong {
  text-decoration: underline;
}
.itinerary-transport-stop-label {
  color: #7c938d;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.5px;
}
.itinerary-transport-stop strong {
  overflow: hidden;
  color: #285750;
  font-size: 12px;
  line-height: 1.4;
  overflow-wrap: anywhere;
}
.itinerary-transport-stop .el-icon {
  position: absolute;
  right: 6px;
  bottom: 6px;
  font-size: 11px;
}
.itinerary-transport-arrow {
  display: grid;
  place-items: center;
  color: #45877c;
  font-size: 18px;
  font-weight: 800;
}
.personal-itinerary-card {
  transition:
    border-color 0.18s ease,
    box-shadow 0.18s ease,
    opacity 0.18s ease;
}
.personal-itinerary-card:hover,
.personal-itinerary-card:focus-within {
  border-color: #b4d6ca;
  box-shadow: 0 5px 14px rgba(18, 63, 58, 0.06);
}
.personal-itinerary-card.is-type-attraction {
  border-color: #cfe5da;
  background: #f8fcf9;
}
.personal-itinerary-card.is-type-food {
  border-color: #f0d8d0;
  background: #fffaf8;
}
.personal-itinerary-card.is-type-transport {
  border-color: #cfe2ea;
  background: #f7fbfd;
}
.personal-itinerary-card.is-type-stay {
  border-color: #e3d8ef;
  background: #fcfaff;
}
.personal-itinerary-card.is-type-shop {
  border-color: #eddfb9;
  background: #fffdf7;
}
.personal-itinerary-image {
  width: 44px;
  height: 44px;
  flex: 0 0 44px;
  border: 1px solid rgba(37, 86, 76, 0.12);
  border-radius: 8px;
  object-fit: cover;
}
.personal-itinerary-title {
  display: flex;
  align-items: flex-start;
  min-width: 0;
}
.personal-itinerary-title strong {
  display: block;
  min-width: 0;
  flex: 1;
}
.personal-itinerary-meta {
  display: flex !important;
  flex-wrap: wrap;
  align-items: center !important;
  gap: 4px !important;
  margin-top: 4px !important;
  color: #7f918b !important;
}
.personal-itinerary-meta .itinerary-type-chip {
  font-size: 10px;
}
.personal-itinerary-location {
  margin-top: 6px !important;
}
.personal-transport-route {
  margin-top: 7px;
}
.personal-transport-route .itinerary-transport-stop {
  background: rgba(255, 255, 255, 0.82);
}
@media (max-width: 720px) {
  .itinerary-transport-route {
    grid-template-columns: minmax(0, 1fr) 17px minmax(0, 1fr);
    gap: 3px;
  }
  .itinerary-transport-stop {
    padding: 6px 19px 6px 7px;
  }
  .itinerary-transport-stop strong {
    font-size: 11px;
  }
  .itinerary-transport-arrow {
    font-size: 16px;
  }
  .personal-itinerary-image {
    width: 40px;
    height: 40px;
    flex-basis: 40px;
  }
  .personal-itinerary-card {
    gap: 6px;
  }
  .personal-itinerary-title strong {
    font-size: 13px;
  }
  .personal-itinerary-location {
    font-size: 12px;
  }
}
@media (max-width: 390px) {
  .itinerary-transport-stop-label {
    font-size: 9px;
  }
  .itinerary-transport-stop strong {
    font-size: 10px;
  }
  .personal-itinerary-image {
    width: 36px;
    height: 36px;
    flex-basis: 36px;
  }
}
.itinerary-entry {
  grid-template-columns: 34px 62px 16px minmax(0, 1fr);
}
.itinerary-time {
  padding-right: 4px;
}
@media (max-width: 720px) {
  .itinerary-entry {
    grid-template-columns: 26px 45px 12px minmax(0, 1fr);
  }
  .itinerary-checkbox :deep(.el-checkbox) {
    width: 28px;
  }
}
@media (max-width: 390px) {
  .itinerary-entry {
    grid-template-columns: 25px 43px 11px minmax(0, 1fr);
  }
}
@media (max-width: 720px) {
  .itinerary-card-header {
    display: grid;
    grid-template-columns: 44px minmax(0, 1fr);
    align-items: start;
    gap: 8px;
  }
  .itinerary-card-image {
    grid-column: 1;
    grid-row: 1;
  }
  .itinerary-card-heading {
    grid-column: 2;
    grid-row: 1;
    gap: 4px;
  }
  .itinerary-card.is-free-card .itinerary-card-heading {
    grid-column: 1/-1;
  }
  .itinerary-card-controls {
    grid-column: 1/-1;
    grid-row: 2;
    justify-content: flex-end;
    margin-top: -4px;
  }
  .itinerary-card-body {
    margin-top: 3px;
  }
  .itinerary-drag-handle {
    width: 28px;
    height: 28px;
    margin: -4px 0 0 -5px;
  }
  .itinerary-card-heading strong {
    font-size: 15px;
    line-height: 1.42;
  }
}
@media (max-width: 720px) {
  .itinerary-card.is-free-card {
    padding: 12px;
  }
  .free-activity-personal-heading {
    gap: 8px;
    padding: 12px 0;
  }
  .personal-itinerary-list {
    padding-left: 7px;
  }
  .personal-itinerary-entry {
    grid-template-columns: 34px 8px minmax(0, 1fr);
    gap: 5px;
  }
  .personal-itinerary-time {
    padding-top: 13px;
    font-size: 11px;
  }
  .personal-itinerary-dot {
    margin-top: 17px;
  }
  .personal-itinerary-card {
    display: grid;
    grid-template-columns: 28px minmax(0, 1fr);
    gap: 8px;
    padding: 10px;
  }
  .personal-itinerary-card :deep(.el-checkbox) {
    grid-column: 1;
    grid-row: 1;
    margin: 2px 0 0;
  }
  .personal-itinerary-image {
    grid-column: 2;
    width: 46px;
    height: 46px;
    flex-basis: 46px;
  }
  .personal-itinerary-copy {
    grid-column: 2;
    min-width: 0;
  }
  .personal-itinerary-card :deep(.el-dropdown) {
    grid-column: 2;
    justify-self: end;
  }
  .personal-more-button {
    margin: 0;
  }
  .personal-itinerary-title strong {
    font-size: 14px;
    line-height: 1.48;
  }
  .personal-itinerary-meta {
    margin-top: 6px !important;
  }
  .personal-itinerary-location {
    margin-top: 7px !important;
  }
  .personal-transport-route {
    margin-top: 8px;
  }
  .personal-itinerary-note {
    margin-top: 6px !important;
  }
}
@media (max-width: 720px) {
  .itinerary-card.is-free-card { padding: 12px; }
  .free-activity-personal-heading { gap: 10px; padding: 12px 0 10px; }
  .free-activity-personal-heading > div { width: 100%; }
  .free-activity-personal-title-row { display: flex; align-items:baseline; justify-content:space-between; gap:10px; }
  .free-activity-personal-heading strong { font-size:14px; }
  .free-activity-personal-count { flex:0 0 auto; color:#80601d!important; font-size:12px!important; font-weight:800; }
  .free-activity-personal-private { display:inline-flex!important; align-items:center; gap:4px; margin-top:3px; color:#9a8764!important; font-size:11px!important; }
  .free-activity-personal-private .el-icon { font-size:12px; }
  .free-activity-add-button { width:100%; min-height:42px; }
  .personal-itinerary-list { gap:9px; padding:0; border-left:0; }
  .personal-itinerary-group-heading { display:flex; align-items:center; justify-content:space-between; min-width:0; padding:5px 1px 0; color:#80601d; font-size:12px; font-weight:800; }
  .personal-itinerary-group-heading span { white-space:nowrap; }
  .personal-itinerary-group-heading small { display:grid; width:20px; height:20px; place-items:center; border-radius:999px; background:#fff0cf; color:#8a621c; font-size:11px; }
  .personal-itinerary-entry { display:block; min-width:0; }
  .personal-itinerary-time, .personal-itinerary-dot { display:none; }
  .personal-itinerary-card { position:relative; display:block; min-width:0; padding:10px; border-color:#eadfca; background:rgba(255,255,255,.92); box-shadow:0 3px 10px rgba(119,87,31,.05); }
  .personal-itinerary-card :deep(.el-checkbox) { position:absolute; z-index:2; top:9px; left:9px; width:22px; height:22px; margin:0; padding:2px; border-radius:5px; background:rgba(255,255,255,.88); }
  .personal-itinerary-image { position:absolute; top:10px; left:10px; width:64px; height:64px; border-radius:9px; object-fit:cover; }
  .personal-itinerary-copy { display:block; min-width:0; min-height:64px; margin-left:74px; padding-right:30px; }
  .personal-itinerary-title { position:static; min-width:0; }
  .personal-itinerary-title strong { display:-webkit-box; overflow:hidden; min-width:0; color:#28473f; font-size:14px; line-height:1.45; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
  .personal-drag-handle { position:absolute; z-index:3; top:39px; left:13px; width:22px; height:22px; margin:0; background:rgba(255,255,255,.78); color:#8d6927; }
  .personal-itinerary-time-detail { display:block!important; margin:4px 0 0!important; color:#7b827c!important; font-size:12px!important; font-variant-numeric:tabular-nums; white-space:nowrap; }
  .personal-itinerary-meta { display:flex!important; align-items:center!important; gap:5px!important; margin:7px 0 0!important; white-space:nowrap; }
  .personal-itinerary-meta .itinerary-type-chip { flex:0 0 auto; }
  .personal-itinerary-note { margin-top:6px!important; }
  .personal-itinerary-location { display:inline-flex!important; max-width:100%; margin-top:7px!important; white-space:nowrap; }
  .personal-itinerary-location span { font-size:0; }
  .personal-itinerary-location span::after { content:'地圖'; font-size:12px; }
  .personal-transport-route { width:calc(100% + 74px); margin:9px 0 0 -74px; }
  .personal-itinerary-card :deep(.el-dropdown) { position:absolute; z-index:2; top:4px; right:3px; }
  .personal-more-button { width:36px!important; min-width:36px!important; height:36px!important; margin:0!important; }
}
@media (max-width: 720px) {
  .itinerary-entry { grid-template-columns: 22px 42px 10px minmax(0, 1fr); }
  .itinerary-checkbox { padding-top:13px; }
  .itinerary-checkbox :deep(.el-checkbox) { width:24px; height:24px; margin:-3px 0 0; }
  .itinerary-checkbox :deep(.el-checkbox__inner) { width:15px; height:15px; }
  .itinerary-time { padding:14px 2px 0 0; font-size:12px; white-space:nowrap; }
  .itinerary-connector::after { top:18px; }
  .itinerary-dot { width:8px; height:8px; margin-top:16px; box-shadow:0 0 0 3px #fff; }
  .itinerary-card:not(.is-free-card) { padding:12px; }
  .itinerary-card:not(.is-free-card) .itinerary-card-header { position:relative; display:grid; grid-template-columns:52px minmax(0, 1fr); gap:9px; min-width:0; }
  .itinerary-card:not(.is-free-card) .itinerary-card-image { grid-column:1; grid-row:1 / span 2; width:52px; height:52px; flex-basis:52px; }
  .itinerary-card:not(.is-free-card) .itinerary-card-heading { display:grid; grid-template-columns:minmax(0, 1fr); grid-template-rows:auto auto; grid-column:2; grid-row:1 / span 2; min-width:0; padding-right:0; }
  .itinerary-card:not(.is-free-card) .itinerary-card-heading > div { display:contents; }
  .itinerary-card:not(.is-free-card) .itinerary-scope-tag { grid-row:1; justify-self:start; margin:0 0 4px; }
  .itinerary-card:not(.is-free-card) .itinerary-card-heading strong { display:-webkit-box; grid-row:2; overflow:hidden; min-width:0; padding-right:0; color:#163b37; font-size:15px; line-height:1.42; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
  .itinerary-card:not(.is-free-card) .itinerary-card-controls { position:absolute; z-index:2; top:-5px; right:-6px; display:flex; gap:0; }
  .itinerary-card:not(.is-free-card) .itinerary-collapse-button, .itinerary-card:not(.is-free-card) .itinerary-more-button { width:36px!important; min-width:36px!important; height:36px!important; margin:0!important; }
  .itinerary-card:not(.is-free-card) .itinerary-drag-handle { position:absolute; z-index:3; top:28px; left:-60px; width:22px; height:22px; margin:0; background:rgba(255,255,255,.8); }
  .itinerary-card:not(.is-free-card) .itinerary-card-body { margin-top:10px; }
  .itinerary-card:not(.is-free-card) .itinerary-card-meta { gap:4px; margin:0 0 8px; color:#81918c; font-size:12px; }
  .itinerary-card:not(.is-free-card) .itinerary-type-chip { font-size:10px; }
  .itinerary-card:not(.is-free-card) .itinerary-transport-route { gap:5px; margin-top:4px; }
  .itinerary-card:not(.is-free-card) .itinerary-transport-stop { padding:7px 19px 7px 8px; border-color:#e3ece8; background:#f9fbfa; }
  .itinerary-card:not(.is-free-card) .itinerary-transport-stop strong { display:-webkit-box; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
  .itinerary-card:not(.is-free-card) .itinerary-transport-arrow { color:#81a99e; font-size:15px; }
}
@media (max-width: 390px) {
  .itinerary-entry { grid-template-columns:20px 40px 9px minmax(0, 1fr); }
  .itinerary-card:not(.is-free-card) .itinerary-card-header { grid-template-columns:48px minmax(0, 1fr); gap:8px; }
  .itinerary-card:not(.is-free-card) .itinerary-card-image { width:48px; height:48px; flex-basis:48px; }
  .itinerary-card:not(.is-free-card) .itinerary-transport-route { grid-template-columns:minmax(0, 1fr); gap:4px; }
  .itinerary-card:not(.is-free-card) .itinerary-transport-arrow { transform:rotate(90deg); min-height:13px; }
}
@media (max-width: 720px) {
  .itinerary-card:not(.is-free-card) .itinerary-card-controls { position:absolute!important; top:-4px!important; right:4px!important; left:auto!important; bottom:auto!important; grid-column:auto!important; grid-row:auto!important; margin:0!important; }
  .itinerary-card:not(.is-free-card) .itinerary-scope-tag { margin-right:74px; }
  .itinerary-card.is-free-card .itinerary-card-header { position:relative; }
  .itinerary-card.is-free-card .itinerary-card-controls { position:absolute!important; top:-4px!important; right:-4px!important; left:auto!important; bottom:auto!important; grid-column:auto!important; grid-row:auto!important; margin:0!important; }
  .itinerary-card.is-free-card .itinerary-scope-tag { margin-right:74px; }
  .itinerary-entry.is-free-activity .free-activity-marker { width:18px; height:18px; margin:0; font-size:14px; line-height:1; }
}
.itinerary-add{margin-left:0!important}.itinerary-mobile-toolbar{display:none}@media(max-width:720px){.itinerary-heading-actions>.itinerary-expand-actions,.itinerary-heading-actions>.itinerary-sort-toggle,.itinerary-heading-actions>.itinerary-add{display:none}.itinerary-mobile-toolbar{display:flex;align-items:center;gap:8px;width:100%;min-width:0;box-sizing:border-box}.itinerary-mobile-toolbar :deep(.el-button){min-height:44px;margin-left:0;padding:0 10px;border-radius:10px;font-size:14px;font-weight:700;white-space:nowrap}.itinerary-mobile-expand-toggle{flex:1;min-width:0;border-color:#d3e3dc;background:#f8fbf9;color:#416d62}.itinerary-mobile-expand-toggle span{overflow:hidden;text-overflow:ellipsis}.itinerary-mobile-sort,.itinerary-mobile-add{flex:0 0 auto}.itinerary-mobile-sort{min-width:68px;border-color:#bfd7cd;color:#2f7d70}.itinerary-mobile-add{min-width:66px}.itinerary-mobile-collapse-icon{transform:rotate(180deg)}}
.itinerary-group-toggle{min-height:40px;border-color:#c8dcd2;border-radius:10px;color:#2f7d70;font-weight:700}.itinerary-group-toggle.is-active{border-color:#b88125;background:#fff4d9;color:#80540f}.itinerary-grouping-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:14px 0 0;padding:10px 12px;border:1px solid #ead39b;border-radius:12px;background:#fffaf0;color:#775d27;font-size:13px}.itinerary-group-create{min-height:36px;border-color:#bd8730;background:#fff;color:#825b18;font-weight:700}.itinerary-card.is-itinerary-group-card{border-color:#e9c97c;background:#fffaf0}.is-itinerary-group .itinerary-dot{border-color:#d59d35;background:#fff8e8}.itinerary-group-summary{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:2px 0 10px;border-bottom:1px solid #f1dfb3}.itinerary-group-summary p{display:flex;flex-wrap:wrap;gap:4px 8px;margin:0;color:#7e6a42;font-size:12px}.itinerary-group-summary p strong{color:#5d4720;font-size:13px}.itinerary-group-summary a{display:inline-flex;align-items:center;gap:3px;color:#977026;font-size:12px;white-space:nowrap;text-decoration:none}.itinerary-group-members{display:grid;gap:7px;margin-top:10px}.itinerary-group-member{display:grid;grid-template-columns:22px 42px minmax(0,1fr) 36px;align-items:center;gap:9px;padding:8px;border:1px solid #eadfca;border-radius:10px;background:#fff}.itinerary-group-member>img,.itinerary-group-member-placeholder{display:grid;width:42px;height:42px;place-items:center;border-radius:8px;object-fit:cover;background:#f4ead5;color:#a07124;font-weight:800}.itinerary-group-member-copy{display:grid;min-width:0;gap:3px}.itinerary-group-member-copy strong{overflow:hidden;color:#244a43;font-size:14px;text-overflow:ellipsis;white-space:nowrap}.itinerary-group-member-copy small{display:flex;flex-wrap:wrap;gap:5px;color:#75857f;font-size:12px}.itinerary-group-member-copy em{padding:1px 6px;border-radius:999px;background:#eef5f0;color:#47776a;font-size:10px;font-style:normal;font-weight:700}@media(max-width:720px){.itinerary-group-toggle{display:none}.itinerary-grouping-bar{align-items:flex-start;flex-direction:column}.itinerary-group-create{width:100%;min-height:42px}.itinerary-group-summary{align-items:flex-start;flex-direction:column}.itinerary-group-member{grid-template-columns:20px 40px minmax(0,1fr) 34px;gap:7px}.itinerary-group-member>img,.itinerary-group-member-placeholder{width:40px;height:40px}}
@media (max-width: 420px) {
  .itinerary-transport-route {
    grid-template-columns: minmax(0, 1fr);
    gap: 5px;
  }
  .itinerary-transport-arrow {
    min-height: 14px;
    transform: rotate(90deg);
  }
}
@media (max-width:720px) { .itinerary-group-toggle { display:inline-flex; min-height:40px; margin:0; padding:0 10px; font-size:13px; white-space:nowrap; } }
.itinerary-group-member{align-items:start}.itinerary-group-member>:first-child{margin-top:10px}.itinerary-group-member>img,.itinerary-group-member>.itinerary-group-member-placeholder{margin-top:2px}.itinerary-group-member-copy{padding-top:4px}.itinerary-group-member-detail{display:grid;grid-column:2 / -1;min-width:0;gap:7px;padding-top:2px}.itinerary-group-member-detail .itinerary-note{margin:0}.itinerary-group-member-detail .itinerary-location{margin:0}.itinerary-group-member-detail .itinerary-time-warning{margin:0}.itinerary-group-member-detail .itinerary-shopping-button{justify-self:start;margin:0;padding:0;color:#2f7d70}.itinerary-group-member-detail .itinerary-transport-route{margin:0}.itinerary-group-member.is-completed{opacity:.66}.itinerary-group-member.is-completed .itinerary-group-member-copy strong{text-decoration:line-through}@media(max-width:420px){.itinerary-group-member-detail .itinerary-transport-route{grid-template-columns:minmax(0,1fr)}.itinerary-group-member-detail .itinerary-transport-arrow{transform:rotate(90deg)}}
@media(max-width:720px){.itinerary-group-member{position:relative;grid-template-columns:40px minmax(0,1fr) 34px;padding:8px}.itinerary-group-member>:first-child{position:absolute;z-index:2;top:9px;left:9px;margin:0;padding:0;border-radius:4px;background:rgba(255,255,255,.88)}.itinerary-group-member>img,.itinerary-group-member>.itinerary-group-member-placeholder{grid-column:1;grid-row:1;margin-top:0}.itinerary-group-member-copy{grid-column:2;grid-row:1;padding-top:3px}.itinerary-group-member :deep(.el-dropdown){grid-column:3;grid-row:1}.itinerary-group-member-detail{grid-column:1 / -1;padding-top:1px}}
@media(max-width:720px){.itinerary-group-member :deep(.el-checkbox){position:absolute!important;z-index:3;top:8px;left:8px;width:18px;height:18px;margin:0!important;padding:0!important;border-radius:4px;background:rgba(255,255,255,.92);line-height:18px}.itinerary-group-member :deep(.el-checkbox__input){display:grid;width:18px;height:18px;place-items:center}.itinerary-group-member :deep(.el-checkbox__inner){width:14px;height:14px}}
@media(max-width:720px){.itinerary-card.is-itinerary-group-card .itinerary-card-header{grid-template-columns:minmax(0,1fr);gap:0}.itinerary-card.is-itinerary-group-card .itinerary-card-heading{grid-column:1;grid-row:1 / span 2}.itinerary-card.is-itinerary-group-card .itinerary-scope-tag{margin-right:74px}}
.itinerary-card.is-itinerary-group-card{border-color:#a9cdd2;background:#f1f7f8}.is-itinerary-group .itinerary-dot{border-color:#5e9da7;background:#eff8f8}.itinerary-card.is-itinerary-group-card .itinerary-scope-tag{background:#ddeff1;color:#2f6d78}.itinerary-card.is-itinerary-group-card .itinerary-card-heading strong{color:#244f57}.itinerary-card.is-itinerary-group-card .itinerary-group-summary{border-bottom-color:#cfe2e5}.itinerary-card.is-itinerary-group-card .itinerary-group-summary p{color:#517980}.itinerary-card.is-itinerary-group-card .itinerary-group-summary p strong{color:#2f5f69}.itinerary-card.is-itinerary-group-card .itinerary-group-summary a{color:#347b86}.itinerary-card.is-itinerary-group-card .itinerary-group-member{border-color:#d2e3e5;background:#fff}.itinerary-card.is-itinerary-group-card .itinerary-group-member-placeholder{background:#e5f1f3;color:#2f6d78}
</style>
