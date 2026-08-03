import type { InsuranceMemberStatus, InsuranceStatus, InsuranceStatusSummary, TravelInsurance, Trip } from '../types'

export type CoverageValidationStatus = 'complete' | 'starts_late' | 'ends_early' | 'outside_trip' | 'expired' | 'invalid'

export function validateCoveragePeriod(startAt: number, endAt: number, trip: Pick<Trip, 'startDate' | 'endDate'>): CoverageValidationStatus {
  if (!Number.isFinite(startAt) || !Number.isFinite(endAt) || endAt < startAt) return 'invalid'
  const tripStart = new Date(`${trip.startDate}T00:00:00`).getTime()
  const tripEnd = new Date(`${trip.endDate}T23:59:59`).getTime()
  if (!Number.isFinite(tripStart) || !Number.isFinite(tripEnd)) return 'invalid'
  if (endAt < Date.now()) return 'expired'
  if (startAt > tripEnd || endAt < tripStart) return 'outside_trip'
  if (startAt > tripStart) return 'starts_late'
  if (endAt < tripEnd) return 'ends_early'
  return 'complete'
}

export function memberInsuranceStatus(status: InsuranceStatus, coverage: CoverageValidationStatus): InsuranceMemberStatus {
  if (status === 'cancelled') return 'cancelled'
  if (status === 'expired' || coverage === 'expired') return 'expired'
  if (status === 'draft') return 'draft'
  return coverage === 'complete' ? 'covered' : 'coverage_gap'
}

export const coverageLabel: Record<CoverageValidationStatus, string> = { complete: '保障完整', starts_late: '開始較晚', ends_early: '結束較早', outside_trip: '未涵蓋旅行', expired: '已過期', invalid: '期間設定有誤' }

export function formatCoverageAmount(value?: number) {
  const amount = Number(value || 0)
  if (!amount) return '0'
  if (amount < 10000) return amount.toLocaleString()
  const wanAmount = amount / 10000
  const formatted = Number.isInteger(wanAmount) ? String(wanAmount) : wanAmount.toFixed(1).replace(/\.0$/, '')
  return `${formatted}萬`
}

const insuranceStatusPriority: Record<InsuranceMemberStatus, number> = {
  covered: 5,
  coverage_gap: 4,
  draft: 3,
  expired: 2,
  cancelled: 1,
  not_provided: 0,
}

export function summarizeInsurancePolicies(
  policies: TravelInsurance[],
  trip: Pick<Trip, 'startDate' | 'endDate'>,
): Omit<InsuranceStatusSummary, 'userId'> | null {
  if (!policies.length) return null

  const evaluated = policies.map((policy) => {
    const coverageStatus = validateCoveragePeriod(policy.coverageStartAt, policy.coverageEndAt, trip)
    return {
      policy,
      coverageStatus,
      status: memberInsuranceStatus(policy.status, coverageStatus),
    }
  })

  evaluated.sort((left, right) => {
    const priorityDiff = insuranceStatusPriority[right.status] - insuranceStatusPriority[left.status]
    if (priorityDiff !== 0) return priorityDiff
    return (right.policy.updatedAt || 0) - (left.policy.updatedAt || 0)
  })

  const lead = evaluated[0]
  const visiblePolicies = policies.filter((policy) => policy.visibility !== 'private')
  const visibility = policies.some((policy) => policy.visibility === 'trip_members')
    ? 'trip_members'
    : policies.some((policy) => policy.visibility === 'status_only')
      ? 'status_only'
      : 'private'

  return {
    status: lead.status,
    coverageStatus: lead.coverageStatus,
    providerName: visiblePolicies.length === 0
      ? undefined
      : visiblePolicies.length === 1
        ? visiblePolicies[0].providerName
        : `已提供 ${visiblePolicies.length} 張保單`,
    visibility,
    updatedAt: Math.max(...policies.map((policy) => policy.updatedAt || 0)),
  }
}
