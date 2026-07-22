import type { InsuranceMemberStatus, InsuranceStatus, Trip } from '../types'

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
