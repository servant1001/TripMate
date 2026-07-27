<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import TripInsuranceCard from '../components/TripInsuranceCard.vue'
import { deleteTripImage, getInsuranceAttachmentUrl, uploadInsuranceAttachment } from '../services/cloudinary'
import { useTripStore } from '../stores/trip'
import type { InsuranceAttachment, InsuranceStatusSummary, TravelInsurance, Trip } from '../types'
import { memberInsuranceStatus, validateCoveragePeriod } from '../utils/insuranceCoverage'

type InsuranceSavePayload = Omit<TravelInsurance, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<TravelInsurance, 'createdAt'>>

const props = defineProps<{
  trip: Trip
  insurance?: TravelInsurance
  statuses: Record<string, InsuranceStatusSummary>
  userId: string
  canEdit: boolean
  memberName: (id: string) => string
}>()

const store = useTripStore()
const saving = ref(false)

async function saveInsurance(payload: InsuranceSavePayload, files: File[]) {
  if (!props.canEdit) {
    ElMessage.warning('Viewer 僅能查看旅行保險狀態。')
    return
  }

  saving.value = true
  try {
    const previousAttachments = [...(props.insurance?.attachments || [])]
    const attachments = [...(payload.attachments || [])]

    for (const file of files) {
      attachments.push(await uploadInsuranceAttachment(file, props.trip.id))
    }

    const coverage = validateCoveragePeriod(payload.coverageStartAt, payload.coverageEndAt, props.trip)
    await store.saveInsurance(
      { ...payload, attachments },
      { status: memberInsuranceStatus(payload.status, coverage), coverageStatus: coverage },
    )

    await Promise.all(
      previousAttachments
        .filter((attachment) => attachment.publicId && !attachments.some((next) => next.publicId === attachment.publicId))
        .map((attachment) => deleteTripImage(attachment.publicId!, 'insurance', props.trip.id)),
    )
    ElMessage.success('保險資料已安全儲存。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法儲存保險資料。')
  } finally {
    saving.value = false
  }
}

async function removeInsurance(insurance: TravelInsurance) {
  try {
    await store.deleteInsurance(insurance)
    await Promise.allSettled(
      (insurance.attachments || [])
        .filter((attachment) => attachment.publicId)
        .map((attachment) => deleteTripImage(attachment.publicId!, 'insurance', insurance.tripId)),
    )
    ElMessage.success('保險資料已刪除。')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法刪除保險資料。')
  }
}

async function openInsuranceAttachment(attachment: InsuranceAttachment) {
  const ownerId = props.insurance?.userId || props.userId
  try {
    const url = await getInsuranceAttachmentUrl(attachment, props.trip.id, ownerId)
    window.open(url, '_blank', 'noopener,noreferrer')
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '無法安全開啟附件。')
  }
}
</script>

<template>
  <section class="trip-insurance-view" aria-label="旅行保險">
    <TripInsuranceCard
      :trip="trip"
      :insurance="insurance"
      :statuses="statuses"
      :user-id="userId"
      :member-name="memberName"
      :can-edit="canEdit"
      :saving="saving"
      @save="saveInsurance"
      @remove="removeInsurance"
      @open-attachment="openInsuranceAttachment"
    />
  </section>
</template>

<style scoped>
.trip-insurance-view{display:grid;grid-column:1/-1;min-width:0}
</style>
