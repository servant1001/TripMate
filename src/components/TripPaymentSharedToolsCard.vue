<script setup lang="ts">
import { computed } from 'vue'
import type { PaymentToolSummary } from '../types'
const props = defineProps<{ summaries: PaymentToolSummary[]; userId: string; memberName: (id: string) => string }>()
const shared = computed(() => props.summaries.filter((item) => item.ownerUserId !== props.userId))
const labels: Record<PaymentToolSummary['type'], string> = { credit_card: '信用卡', debit_card: '簽帳金融卡', electronic_payment: '電子支付', transport_card: '交通卡', cash: '現金', other: '其他' }
</script>

<template>
  <section v-if="shared.length" class="shared-tools panel">
    <header><div><p>SHARED TOOLS</p><h2>旅伴分享的支付工具</h2><span>只顯示旅伴主動公開的工具摘要，不包含交易、末四碼或餘額。</span></div><b>{{ shared.length }} 項</b></header>
    <div class="shared-grid"><article v-for="tool in shared" :key="tool.id"><span>{{ labels[tool.type] }}</span><strong>{{ tool.name }}</strong><p>{{ tool.issuer || '未提供發卡單位' }}</p><small>{{ memberName(tool.ownerUserId) }}・{{ tool.isActive ? '使用中' : '已停用' }}</small></article></div>
  </section>
</template>

<style scoped>
.shared-tools{grid-column:1/-1;padding:22px}.shared-tools header{display:flex;justify-content:space-between;gap:14px;padding-bottom:14px;border-bottom:1px solid #e1e8e3}.shared-tools p{margin:0;color:#d17661;font-size:11px;font-weight:800;letter-spacing:1px}.shared-tools h2{margin:3px 0;color:#163b37;font-size:18px}.shared-tools header span,.shared-tools article p,.shared-tools small{color:#6b7d78;font-size:12px}.shared-tools header b{height:max-content;padding:4px 8px;border-radius:99px;background:#eef5f0;color:#2f7d70;font-size:12px}.shared-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;margin-top:14px}.shared-grid article{display:grid;gap:4px;padding:13px;border:1px solid #e1e8e3;border-radius:12px;background:#fbfcfa}.shared-grid article>span{width:max-content;padding:3px 7px;border-radius:99px;background:#edf5f0;color:#2f7d70;font-size:11px}.shared-grid strong{color:#163b37;font-size:15px}.shared-grid article p{font-weight:600}@media(max-width:600px){.shared-tools{padding:16px}.shared-grid{grid-template-columns:1fr}}
</style>
