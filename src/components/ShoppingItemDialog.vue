<script setup lang="ts">
import type {
  ItineraryItem,
  ShoppingPriority,
  ShoppingStatus,
  ShoppingType,
  Trip,
} from '../types'

export type ShoppingItemDraft = {
  name: string
  description: string
  shoppingType: ShoppingType
  category: string
  priority: ShoppingPriority
  quantity: number
  unit: string
  estimatedUnitPrice: number
  actualUnitPrice: number
  currency: string
  requestedBy: string
  assignedTo: string
  giftRecipient: string
  storeName: string
  storeBranch: string
  location: string
  address: string
  mapUrl: string
  website: string
  note: string
  status: ShoppingStatus
  plannedDate: string
  itineraryItemId: string
}

const props = defineProps<{
  modelValue: boolean
  editing: boolean
  saving: boolean
  form: ShoppingItemDraft
  trip: Trip | null | undefined
  imageDisplay: string
  imageUrl: string
  participantIds: string[]
  itineraryItemIds: string[]
  selectedItineraries: ItineraryItem[]
}>()

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'update:imageUrl': [value: string]
  'update:participantIds': [value: string[]]
  selectImage: [event: Event]
  openItineraryPicker: []
  clearItinerary: []
  save: []
  closed: []
}>()

const shoppingCategories = [
  '藥妝',
  '食品',
  '零食',
  '伴手禮',
  '服飾',
  '鞋包',
  '美妝',
  '保養品',
  '電器',
  '玩具',
  '動漫',
  '文具',
  '生活用品',
  '收藏品',
  '嬰幼兒用品',
  '其他',
]
</script>

<template>
  <el-dialog
    :model-value="modelValue"
    :title="editing ? '編輯購物項目' : '新增購物項目'"
    class="shopping-dialog"
    width="min(92vw, 640px)"
    @update:model-value="emit('update:modelValue', $event)"
    @closed="emit('closed')"
  >
    <el-form label-position="top">
      <el-form-item label="商品圖片（選填）">
        <div class="shopping-upload-control">
          <img v-if="imageDisplay" :src="imageDisplay" alt="商品圖片預覽" />
          <div v-else class="shopping-upload-placeholder" aria-hidden="true">✦</div>
          <div class="shopping-upload-actions">
            <label class="shopping-upload-file-button" for="shopping-image-file">
              {{ imageDisplay ? '更換圖片' : '選擇圖片' }}
            </label>
            <input
              id="shopping-image-file"
              type="file"
              accept="image/*"
              @change="emit('selectImage', $event)"
            />
            <small>可上傳圖片檔（上限 10 MB），儲存時會上傳到 Cloudinary。</small>
          </div>
        </div>
      </el-form-item>

      <el-form-item label="商品圖片網址（選填）">
        <el-input
          :model-value="imageUrl"
          placeholder="https://example.com/product-image.jpg"
          @update:model-value="emit('update:imageUrl', $event)"
        />
        <small>可直接貼上公開圖片網址；若同時選擇圖片檔，會優先使用上傳檔案。</small>
      </el-form-item>

      <div class="two-col">
        <el-form-item label="商品名稱">
          <el-input v-model="form.name" placeholder="例如：東京香蕉蛋糕" maxlength="80" />
        </el-form-item>
        <el-form-item label="購物類型">
          <el-select v-model="form.shoppingType">
            <el-option label="個人購物" value="personal" />
            <el-option label="代購商品" value="proxy" />
            <el-option label="共同採買" value="shared" />
            <el-option label="伴手禮" value="gift" />
          </el-select>
        </el-form-item>
      </div>

      <div class="three-col">
        <el-form-item label="分類">
          <el-select v-model="form.category" allow-create filterable default-first-option>
            <el-option
              v-for="category in shoppingCategories"
              :key="category"
              :label="category"
              :value="category"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="優先順序">
          <el-select v-model="form.priority">
            <el-option label="高優先" value="high" />
            <el-option label="一般" value="medium" />
            <el-option label="低優先" value="low" />
          </el-select>
        </el-form-item>
        <el-form-item label="狀態">
          <el-select v-model="form.status">
            <el-option label="想買" value="wishlist" />
            <el-option label="已規劃" value="planned" />
            <el-option label="已購買" value="purchased" />
            <el-option label="缺貨" value="unavailable" />
            <el-option label="已取消" value="cancelled" />
          </el-select>
        </el-form-item>
      </div>

      <div class="three-col">
        <el-form-item label="數量">
          <el-input-number v-model="form.quantity" :min="1" :max="99" controls-position="right" />
        </el-form-item>
        <el-form-item label="單位">
          <el-input v-model="form.unit" placeholder="件、盒、包" />
        </el-form-item>
        <el-form-item label="幣別">
          <el-select v-model="form.currency">
            <el-option label="JPY" value="JPY" />
            <el-option label="TWD" value="TWD" />
            <el-option label="USD" value="USD" />
          </el-select>
        </el-form-item>
      </div>

      <div class="two-col">
        <el-form-item label="預估單價">
          <el-input-number v-model="form.estimatedUnitPrice" :min="0" :step="100" controls-position="right" />
        </el-form-item>
        <el-form-item label="實際單價（選填）">
          <el-input-number v-model="form.actualUnitPrice" :min="0" :step="100" controls-position="right" />
        </el-form-item>
      </div>

      <div class="two-col">
        <el-form-item label="預計購買日期（選填）">
          <el-date-picker
            v-model="form.plannedDate"
            type="date"
            value-format="YYYY-MM-DD"
            placeholder="選擇日期"
          />
        </el-form-item>
        <el-form-item label="關聯行程（可多選）">
          <div class="shopping-itinerary-picker-control">
            <div class="shopping-itinerary-picker-copy">
              <strong>
                {{
                  selectedItineraries.length
                    ? `已關聯 ${selectedItineraries.length} 個行程`
                    : '尚未關聯行程'
                }}
              </strong>
              <span>
                {{
                  selectedItineraries.length
                    ? selectedItineraries.map((entry) => entry.title).join('、')
                    : '先選擇第幾天，再勾選該日行程'
                }}
              </span>
            </div>
            <div class="shopping-itinerary-picker-actions">
              <el-button
                v-if="itineraryItemIds.length"
                text
                class="shopping-itinerary-clear"
                @click="emit('clearItinerary')"
              >
                清除
              </el-button>
              <el-button class="shopping-itinerary-picker-button" @click="emit('openItineraryPicker')">
                {{ itineraryItemIds.length ? '調整行程' : '選擇行程' }}
              </el-button>
            </div>
          </div>
        </el-form-item>
      </div>

      <div class="two-col">
        <el-form-item label="負責購買人">
          <el-select v-model="form.assignedTo" clearable placeholder="尚未分派">
            <el-option
              v-for="member in trip?.members || []"
              :key="member.id"
              :label="member.name"
              :value="member.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="購買地點／商店">
          <el-input v-model="form.storeName" placeholder="例如：唐吉訶德新宿店" />
        </el-form-item>
      </div>

      <div class="two-col">
        <el-form-item label="分店（選填）">
          <el-input v-model="form.storeBranch" placeholder="例如：東口店・3F" />
        </el-form-item>
        <el-form-item label="Google Maps 地點網址（選填）">
          <el-input v-model="form.mapUrl" placeholder="貼上 Google Maps 或 maps.app.goo.gl 分享網址" />
          <small>清單上的地圖按鈕會直接開啟此地點。</small>
        </el-form-item>
      </div>

      <el-form-item v-if="form.shoppingType === 'shared'" label="共同採買分攤旅伴">
        <el-checkbox-group
          :model-value="participantIds"
          class="shopping-participants"
          @update:model-value="emit('update:participantIds', $event)"
        >
          <el-checkbox v-for="member in trip?.members || []" :key="member.id" :label="member.id">
            {{ member.name }}
          </el-checkbox>
        </el-checkbox-group>
        <small>轉成開銷時會沿用這些旅伴進行平均分攤。</small>
      </el-form-item>

      <div v-if="form.shoppingType === 'proxy' || form.shoppingType === 'gift'" class="two-col">
        <el-form-item v-if="form.shoppingType === 'proxy'" label="委託人">
          <el-input v-model="form.requestedBy" placeholder="例如：小美" />
        </el-form-item>
        <el-form-item v-else label="贈送對象">
          <el-input v-model="form.giftRecipient" placeholder="例如：家人、同事" />
        </el-form-item>
        <el-form-item label="商品網址（選填）">
          <el-input v-model="form.website" placeholder="https://example.com" />
        </el-form-item>
      </div>

      <el-form-item label="商品說明／備註（選填）">
        <el-input
          v-model="form.note"
          type="textarea"
          :rows="3"
          maxlength="240"
          show-word-limit
          placeholder="規格、顏色、限購資訊或購買注意事項"
        />
      </el-form-item>
    </el-form>

    <template #footer>
      <el-button :disabled="saving" @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="saving" @click="emit('save')">
        {{ editing ? '儲存變更' : '新增商品' }}
      </el-button>
    </template>
  </el-dialog>
</template>
