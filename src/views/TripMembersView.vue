<script setup lang="ts">
import TripMembersSettlementCard from '../components/TripMembersSettlementCard.vue'
import type { Member, Settlement, Trip } from '../types'
type BalanceMember = Member & { balance: number }
type SettlementSuggestion = { fromId: string; toId: string; from: string; to: string; amount: number }
defineProps<{ trip: Trip; balances: BalanceMember[]; suggestions: SettlementSuggestion[]; settlements: Settlement[]; canManage: boolean; canEdit: boolean; openMemberManager: () => void; memberPaid: (id: string) => number; memberName: (id: string) => string }>()
const emit = defineEmits<{ copyInvite: []; settle: [suggestion: SettlementSuggestion]; undoSettlement: [settlement: Settlement] }>()
</script>
<template><section class="trip-members-view" aria-label="旅伴與結算"><TripMembersSettlementCard :trip="trip" :balances="balances" :suggestions="suggestions" :settlements="settlements" :can-manage-members="canManage" :can-edit-trip="canEdit" :open-member-manager="openMemberManager" :member-paid="memberPaid" :member-name="memberName" @copy-invite="emit('copyInvite')" @settle="emit('settle', $event)" @undo-settlement="emit('undoSettlement', $event)" /></section></template>
<style scoped>.trip-members-view{display:grid;grid-column:1/-1;min-width:0}</style>
