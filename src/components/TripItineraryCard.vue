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

function activityKind(entry: ItineraryItem) {
  return entry.activityKind || "shared";
}
function isFreeActivity(entry: ItineraryItem) {
  return activityKind(entry) === "free";
}
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
        onEnd: ({ oldIndex, newIndex }) => {
          if (oldIndex != null && newIndex != null && oldIndex !== newIndex)
            emit("sort", { date: day.date, oldIndex, newIndex });
        },
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
          onEnd: ({ oldIndex, newIndex }) => {
            if (oldIndex != null && newIndex != null && oldIndex !== newIndex)
              emit("sortPersonal", { parentId: group.id, oldIndex, newIndex });
          },
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
}
function sharedLabel(entry: ItineraryItem) {
  return isFreeActivity(entry) ? "自由活動" : "共用行程";
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
          <el-button text @click="expandAll">展開全部</el-button
          ><el-button text @click="collapseAll">收合全部</el-button>
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
          ></template
        >
        <span v-else class="readonly-chip">唯讀</span>
      </div>
    </div>

    <div v-if="days.length" class="itinerary-timeline">
      <section
        v-for="(day, dayIndex) in days"
        :key="day.date"
        class="itinerary-day"
        :aria-label="formatDate(day.date)"
      >
        <div class="day-heading">
          <span>DAY {{ dayIndex + 1 }}</span>
          <h3>{{ formatDate(day.date) }}</h3>
        </div>
        <div
          class="itinerary-list"
          :ref="
            (element) =>
              registerSortableList(`day:${day.date}`, element as Element | null)
          "
        >
          <article
            v-for="(entry, entryIndex) in day.entries"
            :key="entry.id"
            class="itinerary-entry"
            :class="[
              {
                'is-completed': entry.completed,
                'is-sortable-enabled': sortingEnabled && canEditTrip,
                'is-free-activity': isFreeActivity(entry),
              },
            ]"
          >
            <div class="itinerary-checkbox">
              <el-checkbox
                v-if="!isFreeActivity(entry)"
                :model-value="entry.completed"
                :disabled="!canEditTrip"
                :aria-label="`將「${entry.title}」標示為${entry.completed ? '未完成' : '已完成'}`"
                @change="emit('toggle', entry)"
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
                        ><el-dropdown-item command="add-after"
                          >在此後新增行程</el-dropdown-item
                        ><el-dropdown-item command="edit"
                          >編輯{{
                            isFreeActivity(entry) ? "自由活動" : "行程"
                          }}</el-dropdown-item
                        ><el-dropdown-item
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
                <template v-if="!isFreeActivity(entry)"
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
                <template v-else
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
                      v-for="personal in personalEntries(entry)"
                      :key="personal.id"
                      class="personal-itinerary-entry"
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
                            v-if="personal.note"
                            class="personal-itinerary-note"
                          >
                            {{ personal.note }}
                          </p>
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
  padding: 2px;
  border: 1px solid #dce8e2;
  border-radius: 10px;
  background: #fafcfb;
}
.itinerary-expand-actions :deep(.el-button) {
  min-height: 36px;
  padding: 0 9px;
  color: #527369;
  font-size: 12px;
  font-weight: 700;
}
.itinerary-expand-actions :deep(.el-button + .el-button) {
  margin-left: 0;
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
  height: 26px;
  place-items: center;
  margin: 8px 0 0;
  color: #8d6927;
  font-size: 16px;
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
</style>
