<script setup lang="ts">
import { reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import TripMembersSettlementCard from '../components/TripMembersSettlementCard.vue'
import { useTripStore } from '../stores/trip'
import type { Expense, Member, Settlement, Trip } from '../types'
import { participantsForExpense, payerSharesForExpense } from '../utils/expenseSplit'

type BalanceMember = Member & { balance: number }
type SettlementSuggestion = { fromId: string; toId: string; from: string; to: string; amount: number }

const props = defineProps<{
  trip: Trip
  balances: BalanceMember[]
  suggestions: SettlementSuggestion[]
  settlements: Settlement[]
  expenses: Expense[]
  canManage: boolean
  canEdit: boolean
  openManager: boolean
  memberName: (id: string) => string
}>()

const emit = defineEmits<{ 'update:openManager': [value: boolean] }>()

const store = useTripStore()
const managerOpen = ref(false)
const member = reactive({ name: '', email: '', role: 'editor' as Exclude<Member['role'], 'owner'> })

function memberPaid(memberId: string) {
  return props.expenses.reduce((sum, expense) => sum + (payerSharesForExpense(expense)[memberId] || 0), 0)
}

function openMemberManager() {
  if (!props.canManage) {
    ElMessage.warning('只有旅行建立者可以管理成員。')
    return
  }
  managerOpen.value = true
}

watch(
  () => props.openManager,
  (shouldOpen) => {
    if (!shouldOpen) return
    openMemberManager()
    emit('update:openManager', false)
  },
)

async function addMember() {
  if (!props.canManage) {
    ElMessage.warning('只有旅行建立者可以管理成員。')
    return
  }
  if (!member.name.trim() || !member.email.trim()) {
    ElMessage.warning('請填寫成員名稱與 Email。')
    return
  }

  try {
    await store.addMember(props.trip, {
      name: member.name.trim(),
      email: member.email.trim(),
      role: member.role,
    })
    Object.assign(member, { name: '', email: '', role: 'editor' })
    ElMessage.success('已新增旅行成員。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法新增成員。')
  }
}

async function removeMember(memberToRemove: Member) {
  if (!props.canManage) {
    ElMessage.warning('只有旅行建立者可以管理成員。')
    return
  }
  if (memberToRemove.id === props.trip.ownerId) {
    ElMessage.warning('旅行建立者無法被移除。')
    return
  }

  const participantIds = props.trip.members.map((entry) => entry.id)
  const hasExpense = props.expenses.some(
    (expense) => expense.payerId === memberToRemove.id || participantsForExpense(expense, participantIds).includes(memberToRemove.id),
  )
  const hasSettlement = props.settlements.some(
    (settlement) => settlement.fromId === memberToRemove.id || settlement.toId === memberToRemove.id,
  )
  if (hasExpense || hasSettlement) {
    ElMessage.warning('此成員已有支出或結算紀錄，請先完成帳務處理後再移除。')
    return
  }

  try {
    await ElMessageBox.confirm(
      `確定要將「${memberToRemove.name}」移出這趟旅行嗎？對方將無法再存取此旅行。`,
      '移除旅行成員',
      { confirmButtonText: '移除成員', cancelButtonText: '取消', type: 'warning' },
    )
    await store.removeMember(props.trip, memberToRemove.id)
    ElMessage.success('已移除旅行成員。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '無法移除旅行成員。')
    }
  }
}

async function copyInvite() {
  try {
    await navigator.clipboard.writeText(props.trip.inviteCode || '')
    ElMessage.success('邀請碼已複製。')
  } catch {
    ElMessage.error('無法複製邀請碼，請手動複製。')
  }
}

function localDate() {
  const date = new Date()
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

async function confirmSettlement(suggestion: SettlementSuggestion) {
  if (!props.canEdit) {
    ElMessage.warning('Viewer 僅能查看結算資料。')
    return
  }

  try {
    await ElMessageBox.confirm(
      `確認「${suggestion.from}」已支付 ${props.trip.currency} ${suggestion.amount.toFixed(0)} 給「${suggestion.to}」？`,
      '標記為已結算',
      { confirmButtonText: '確認結算', cancelButtonText: '取消', type: 'success' },
    )
    await store.addSettlement({
      tripId: props.trip.id,
      fromId: suggestion.fromId,
      toId: suggestion.toId,
      amount: suggestion.amount,
      date: localDate(),
      createdAt: Date.now(),
    })
    ElMessage.success('已記錄結算。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '無法記錄結算。')
    }
  }
}

async function undoSettlement(settlement: Settlement) {
  if (!props.canEdit) {
    ElMessage.warning('Viewer 僅能查看結算資料。')
    return
  }

  try {
    await ElMessageBox.confirm('確定要復原這筆結算嗎？', '復原結算', {
      confirmButtonText: '復原',
      cancelButtonText: '取消',
      type: 'warning',
    })
    await store.deleteSettlement(settlement)
    ElMessage.success('結算已復原。')
  } catch (error) {
    if (error !== 'cancel' && error !== 'close') {
      ElMessage.error(error instanceof Error ? error.message : '無法復原結算。')
    }
  }
}
</script>

<template>
  <section class="trip-members-view" aria-label="旅伴與結算">
    <TripMembersSettlementCard
      :trip="trip"
      :balances="balances"
      :suggestions="suggestions"
      :settlements="settlements"
      :can-manage-members="canManage"
      :can-edit-trip="canEdit"
      :member-paid="memberPaid"
      :member-name="memberName"
      @manage-members="openMemberManager"
      @copy-invite="copyInvite"
      @settle="confirmSettlement"
      @undo-settlement="undoSettlement"
    />

    <el-dialog v-model="managerOpen" title="成員管理" class="member-manager-dialog" width="min(92vw, 560px)">
      <section class="member-manager-current" aria-labelledby="current-members-title">
        <div class="member-manager-section-heading">
          <div><p>目前成員</p><h3 id="current-members-title">{{ trip.members.length }} 位旅伴</h3></div>
          <span>旅行建立者可邀請或移除成員</span>
        </div>
        <div class="member-manager-list">
          <article v-for="currentMemberEntry in trip.members" :key="currentMemberEntry.id" class="member-manager-row">
            <span class="member-manager-avatar" aria-hidden="true">{{ currentMemberEntry.name.slice(0, 1) }}</span>
            <div class="member-manager-copy"><strong>{{ currentMemberEntry.name }}</strong><span>{{ currentMemberEntry.email }}</span></div>
            <span class="member-manager-role" :class="`is-${currentMemberEntry.role}`">{{ currentMemberEntry.role === 'owner' ? '建立者' : currentMemberEntry.role === 'editor' ? '可編輯' : '唯讀' }}</span>
            <el-tooltip v-if="currentMemberEntry.id !== trip.ownerId" content="移除成員" placement="top">
              <el-button class="member-remove-button" text circle :aria-label="`移除 ${currentMemberEntry.name}`" @click="removeMember(currentMemberEntry)">×</el-button>
            </el-tooltip>
          </article>
        </div>
      </section>
      <el-divider />
      <section class="member-manager-invite" aria-labelledby="invite-member-title">
        <div><p>邀請旅伴</p><h3 id="invite-member-title">新增旅行成員</h3><span>對方需先使用此 Email 登入 TripMate。</span></div>
        <el-form label-position="top" @submit.prevent="addMember">
          <div class="member-manager-form-grid">
            <el-form-item label="名稱"><el-input v-model="member.name" autocomplete="name" /></el-form-item>
            <el-form-item label="Email"><el-input v-model="member.email" autocomplete="email" /></el-form-item>
          </div>
          <el-form-item label="權限">
            <el-select v-model="member.role"><el-option label="Editor — 可共同編輯" value="editor" /><el-option label="Viewer — 僅能查看" value="viewer" /></el-select>
          </el-form-item>
          <el-button class="member-invite-button" native-type="submit" type="primary">邀請加入</el-button>
        </el-form>
      </section>
      <template #footer><el-button @click="managerOpen = false">完成</el-button></template>
    </el-dialog>
  </section>
</template>

<style scoped>
.trip-members-view{display:grid;grid-column:1/-1;min-width:0}.member-manager-current,.member-manager-invite{display:grid;gap:16px}.member-manager-section-heading{display:flex;align-items:end;justify-content:space-between;gap:16px}.member-manager-section-heading>div,.member-manager-invite>div{display:grid;gap:2px}.member-manager-section-heading p,.member-manager-invite p{margin:0;color:#d1826e;font-size:11px;font-weight:800;letter-spacing:1.1px;text-transform:uppercase}.member-manager-section-heading h3,.member-manager-invite h3{margin:0;color:#173d37;font-size:17px;line-height:1.4}.member-manager-section-heading>span,.member-manager-invite>div>span{color:#71827c;font-size:12px;line-height:1.5}.member-manager-list{display:grid;overflow:hidden;border:1px solid #e1e9e4;border-radius:12px}.member-manager-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto 40px;align-items:center;gap:11px;padding:11px 12px;border-bottom:1px solid #edf1ee}.member-manager-row:last-child{border-bottom:0}.member-manager-avatar{display:grid;width:36px;height:36px;place-items:center;border-radius:50%;background:#dceee6;color:#216a5b;font-size:14px;font-weight:800}.member-manager-copy{display:grid;min-width:0;gap:2px}.member-manager-copy strong{overflow:hidden;color:#244a43;font-size:14px;text-overflow:ellipsis;white-space:nowrap}.member-manager-copy span{overflow:hidden;color:#71827c;font-size:12px;text-overflow:ellipsis;white-space:nowrap}.member-manager-role{padding:4px 8px;border-radius:999px;background:#f1f4f2;color:#687b74;font-size:12px;font-weight:700;white-space:nowrap}.member-manager-role.is-owner{background:#edf5ef;color:#2f7d70}.member-manager-role.is-editor{background:#eef5f5;color:#357072}.member-remove-button{width:40px!important;min-width:40px!important;height:40px!important;color:#c36358;font-size:22px}.member-remove-button:hover,.member-remove-button:focus-visible{background:#fdf0ed;color:#b64237}.member-manager-invite .el-form-item{margin-bottom:14px}.member-manager-form-grid{display:grid;grid-template-columns:1fr 1.25fr;gap:12px}.member-manager-invite .el-input,.member-manager-invite .el-select{width:100%}.member-invite-button{min-height:42px;border:0;border-radius:10px;background:#123f3a;color:#fff;font-weight:700}.member-invite-button:hover,.member-invite-button:focus-visible{background:#1d5a52;color:#fff}@media(max-width:600px){.member-manager-section-heading{align-items:start;flex-direction:column;gap:5px}.member-manager-row{grid-template-columns:38px minmax(0,1fr) auto}.member-manager-role{grid-column:2;justify-self:start}.member-remove-button{grid-column:3;grid-row:1/3}.member-manager-form-grid{grid-template-columns:1fr}.member-manager-dialog :deep(.el-dialog__body){padding:16px}.member-manager-dialog :deep(.el-dialog__footer){padding:12px 16px 18px}}
</style>
