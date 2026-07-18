<script setup lang="ts">
import { CircleCheck, CopyDocument, Money } from '@element-plus/icons-vue'
import type { Member, Settlement, Trip } from '../types'

type BalanceMember = Member & { balance: number }
type SettlementSuggestion = { fromId: string; toId: string; from: string; to: string; amount: number }

defineProps<{
  trip: Trip
  balances: BalanceMember[]
  suggestions: SettlementSuggestion[]
  settlements: Settlement[]
  canManageMembers: boolean
  canEditTrip: boolean
  memberPaid: (memberId: string) => number
  memberName: (memberId: string) => string
}>()

const emit = defineEmits<{
  manageMembers: []
  copyInvite: []
  settle: [suggestion: SettlementSuggestion]
  undoSettlement: [settlement: Settlement]
}>()

function roleName(role: Member['role']) { return role === 'owner' ? '建立者' : role === 'editor' ? '旅伴' : '檢視者' }
</script>

<template>
  <section id="members" class="trip-detail-card members-panel">
    <div class="detail-card-heading">
      <div><p class="section-kicker">COMPANIONS</p><h2>旅伴與結算</h2></div>
      <el-button v-if="canManageMembers" class="members-manage-button" @click="emit('manageMembers')">成員管理</el-button>
    </div>

    <div class="member-summary">
      <span><b>{{ trip.members.length }}</b> 位旅伴</span>
      <span><b>{{ trip.currency }} {{ balances.reduce((sum, member) => sum + memberPaid(member.id), 0).toLocaleString() }}</b> 總支出</span>
      <span :class="suggestions.length ? 'is-pending' : 'is-settled'"><el-icon><CircleCheck /></el-icon>{{ suggestions.length ? '尚有待結算款項' : '目前已結清' }}</span>
    </div>

    <div v-if="canManageMembers" class="invite-card">
      <div><span>旅行邀請碼</span><strong>{{ trip.inviteCode }}</strong></div>
      <el-button class="copy-invite-button" @click="emit('copyInvite')"><el-icon><CopyDocument /></el-icon>複製邀請碼</el-button>
    </div>

    <div class="member-list" :class="{ 'has-invite': canManageMembers }">
      <article v-for="member in balances" :key="member.id" class="member-row">
        <span class="member-avatar" aria-hidden="true">{{ member.name.slice(0, 1) }}</span>
        <div class="member-copy"><strong>{{ member.name }}</strong><span>{{ roleName(member.role) }}・已支付 {{ trip.currency }} {{ memberPaid(member.id).toLocaleString() }}</span></div>
        <b class="member-balance" :class="{ 'is-positive': member.balance > .01, 'is-negative': member.balance < -.01, 'is-zero': Math.abs(member.balance) <= .01 }">{{ member.balance > .01 ? `應收 ${trip.currency} ${member.balance.toFixed(0)}` : member.balance < -.01 ? `應付 ${trip.currency} ${Math.abs(member.balance).toFixed(0)}` : '已結清' }}</b>
      </article>
    </div>

    <section class="settlement-section">
      <div class="settlement-section-title"><el-icon><Money /></el-icon><h3>建議結算</h3></div>
      <div v-if="suggestions.length" class="settlement-list"><article v-for="suggestion in suggestions" :key="`${suggestion.fromId}-${suggestion.toId}`" class="settlement-row"><p><strong>{{ suggestion.from }}</strong><span>→</span><strong>{{ suggestion.to }}</strong><b>{{ trip.currency }} {{ suggestion.amount.toFixed(0) }}</b></p><el-button v-if="canEditTrip" class="settle-button" @click="emit('settle', suggestion)">標記為已結算</el-button></article></div>
      <div v-else class="settlement-clear"><el-icon><CircleCheck /></el-icon><span>目前沒有待結算款項。</span></div>
    </section>

    <section v-if="settlements.length" class="settlement-history"><h3>已結算紀錄</h3><article v-for="settlement in settlements" :key="settlement.id"><span>{{ settlement.date }}・{{ memberName(settlement.fromId) }} → {{ memberName(settlement.toId) }}</span><b>{{ trip.currency }} {{ settlement.amount.toFixed(0) }}</b><el-button v-if="canEditTrip" text size="small" class="undo-button" @click="emit('undoSettlement', settlement)">復原</el-button></article></section>
  </section>
</template>

<style scoped>
.trip-detail-card{border:1px solid #e1e8e3;border-radius:16px;background:#fff;box-shadow:0 8px 24px rgba(18,63,58,.06)}.members-panel{padding:24px}.detail-card-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding-bottom:17px;border-bottom:1px solid #e8eeea}.section-kicker{margin:0 0 4px;color:#d1826e;font-size:11px;font-weight:800;letter-spacing:1.4px}.detail-card-heading h2{margin:0;color:#163b37;font-size:20px;line-height:1.35}.members-manage-button,.copy-invite-button{min-height:40px;border-color:#cfe0d7;border-radius:10px;background:#fff;color:#22534a;font-weight:700}.members-manage-button:hover,.copy-invite-button:hover,.members-manage-button:focus-visible,.copy-invite-button:focus-visible{border-color:#9fc5b6;background:#eef5f0;color:#123f3a}.member-summary{display:flex;flex-wrap:wrap;gap:8px 20px;padding:14px 0;color:#6b7d78;font-size:13px;line-height:1.5}.member-summary span{display:inline-flex;align-items:center;gap:4px}.member-summary b{color:#244a43;font-size:14px}.member-summary .is-pending{color:#9a6d17}.member-summary .is-settled{color:#2f7d70}.invite-card{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:14px 16px;border:1px solid #f2dfac;border-radius:12px;background:#fffaf0}.invite-card>div{display:grid;gap:3px}.invite-card span{color:#8c6b2d;font-size:12px;font-weight:700}.invite-card strong{color:#4b5137;font-size:20px;letter-spacing:1.5px}.copy-invite-button .el-icon{margin-right:5px}.member-list{display:grid;gap:3px;padding-top:8px}.member-list.has-invite{margin-top:8px}.member-row{display:grid;grid-template-columns:38px minmax(0,1fr) auto;align-items:center;gap:11px;padding:12px 0;border-bottom:1px solid #edf1ee}.member-avatar{display:grid;width:36px;height:36px;place-items:center;border-radius:50%;background:#dbece4;color:#1e6655;font-size:14px;font-weight:800}.member-copy{display:grid;min-width:0;gap:3px}.member-copy strong{overflow-wrap:anywhere;color:#244a43;font-size:15px}.member-copy span{color:#71827c;font-size:13px;line-height:1.4}.member-balance{padding:5px 8px;border-radius:999px;font-size:13px;white-space:nowrap}.member-balance.is-positive{background:#edf7f1;color:#2f7d70}.member-balance.is-negative{background:#fff1ef;color:#d9544d}.member-balance.is-zero{background:#f1f4f2;color:#71827c}.settlement-section{margin-top:19px;padding:15px;border-radius:12px;background:#eef5f0}.settlement-section-title{display:flex;align-items:center;gap:6px;color:#275a50}.settlement-section-title h3,.settlement-history h3{margin:0;font-size:15px}.settlement-list{display:grid;gap:8px;margin-top:10px}.settlement-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:11px 12px;border:1px solid #d9e7df;border-radius:10px;background:#fff}.settlement-row p{display:flex;flex-wrap:wrap;align-items:center;gap:7px;margin:0;color:#244a43;font-size:14px;line-height:1.45}.settlement-row p span{color:#77958b}.settlement-row p b{margin-left:4px;color:#123f3a;white-space:nowrap}.settle-button{min-height:38px;border:0;border-radius:9px;background:#2f7d70;color:#fff;font-weight:700;white-space:nowrap}.settle-button:hover,.settle-button:focus-visible{background:#216a5d;color:#fff}.settlement-clear{display:flex;align-items:center;gap:6px;margin-top:10px;color:#548073;font-size:14px}.settlement-history{display:grid;gap:8px;margin-top:18px}.settlement-history article{display:flex;align-items:center;gap:10px;padding:9px 0;border-top:1px solid #edf1ee;color:#6b7d78;font-size:13px}.settlement-history article span{min-width:0;flex:1}.settlement-history b{color:#315f53;white-space:nowrap}.undo-button{color:#9c6a37}@media(max-width:720px){.members-panel{padding:18px}.member-summary{gap:6px 14px}.invite-card{align-items:flex-start;flex-direction:column}.copy-invite-button{width:100%}.member-row{align-items:start;grid-template-columns:38px minmax(0,1fr)}.member-balance{grid-column:2;justify-self:start}.settlement-row{align-items:flex-start;flex-direction:column}.settle-button{width:100%}.settlement-history article{align-items:flex-start;flex-wrap:wrap}.settlement-history article span{flex-basis:100%}}@media(max-width:390px){.members-panel{padding:16px}.member-summary{align-items:flex-start;flex-direction:column}.members-manage-button{min-height:40px;padding:0 10px;font-size:12px}}
</style>
