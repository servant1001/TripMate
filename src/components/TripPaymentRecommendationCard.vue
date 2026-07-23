<script setup lang="ts">
import { computed, ref } from 'vue'
import type { PaymentTool, RewardRule, Trip } from '../types'
import { calculateTransactionReward, selectApplicableRule } from '../utils/paymentRewards'

const props = defineProps<{ trip: Trip; tools: PaymentTool[]; rules: RewardRule[]; userId: string }>()
const amount = ref(0)
const currency = ref(props.trip.currency)
const category = ref('購物')
const tools = computed(() => props.tools.filter((tool) => tool.ownerUserId === props.userId && tool.isActive))
const results = computed(() => tools.value.map((tool) => { const rule = selectApplicableRule(props.rules.filter((item) => item.paymentToolId === tool.id), { amount: amount.value, date: new Date().toISOString().slice(0, 10), currency: currency.value, category: category.value }); const calculation = calculateTransactionReward({ amount: amount.value, rate: rule?.totalRate || 0, feeRate: tool.foreignTransactionFeeRate }); return { tool, rule, net: calculation.estimatedNetRewardAmount, rate: calculation.estimatedNetRewardRate } }).sort((a, b) => b.net - a.net || b.rate - a.rate))
</script>

<template>
  <section v-if="tools.length" class="payment-recommend panel">
    <header><div><p>SMART PICK</p><h2>推薦支付工具</h2><span>依你已設定的回饋規則與海外手續費試算，不會自動建立交易。</span></div></header>
    <div class="recommend-inputs"><el-input-number v-model="amount" :min="0" controls-position="right" placeholder="預計金額"/><el-input v-model="currency" placeholder="幣別"/><el-input v-model="category" placeholder="消費分類"/></div>
    <div v-if="amount > 0" class="recommend-list"><article v-for="(item, index) in results.slice(0, 3)" :key="item.tool.id"><b>{{ index === 0 ? '建議使用' : `備選 ${index + 1}` }}</b><strong>{{ item.tool.name }}</strong><span>{{ item.rule ? `${item.rule.name}・預估淨回饋 ${trip.currency} ${item.net.toLocaleString()}` : '目前沒有符合的回饋規則' }}</span></article></div><p v-else class="recommend-empty">輸入預計金額後，即可比較已啟用工具的預估淨回饋。</p>
  </section>
</template>

<style scoped>
.payment-recommend{grid-column:1/-1;padding:20px}.payment-recommend header p{margin:0;color:#df765f;font-size:11px;font-weight:800;letter-spacing:1px}.payment-recommend h2{margin:3px 0;color:#163b37;font-size:18px}.payment-recommend header span,.recommend-empty{color:#6b7d78;font-size:13px}.recommend-inputs{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin-top:14px}.recommend-list{display:grid;gap:8px;margin-top:12px}.recommend-list article{display:grid;grid-template-columns:auto minmax(0,1fr);gap:3px 10px;align-items:center;padding:11px;border:1px solid #dce8e2;border-radius:10px;background:#fbfcfa}.recommend-list b{grid-row:span 2;padding:4px 7px;border-radius:99px;background:#eaf4ef;color:#2f7d70;font-size:11px}.recommend-list strong{color:#163b37;font-size:14px}.recommend-list span{color:#6b7d78;font-size:12px}.recommend-empty{margin:12px 0 0}@media(max-width:600px){.payment-recommend{padding:16px}.recommend-inputs{grid-template-columns:1fr}.recommend-list article{grid-template-columns:1fr}.recommend-list b{width:max-content;grid-row:auto}}
</style>
