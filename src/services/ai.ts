import { auth } from './firebase'
import type { TransportFareConfidence } from '../types'

const workerUrl = import.meta.env.VITE_WORKER_API_URL as string | undefined

export interface TransitFareEstimateInput {
  tripId: string
  country: string
  city: string
  currency: string
  date?: string
  title: string
  departureName?: string
  departureLocation?: string
  departureMapUrl?: string
  destinationName?: string
  destinationLocation?: string
  destinationMapUrl?: string
  note?: string
}

export interface TransitFareEstimateResult {
  amount: number
  currency: string
  confidence: TransportFareConfidence
  reasoning: string
  assumptions: string[]
  model: string
  estimatedAt: string
}

export async function estimateTransitFare(input: TransitFareEstimateInput): Promise<TransitFareEstimateResult> {
  if (!workerUrl || !auth?.currentUser) throw new Error('請先登入並設定 Cloudflare Worker API。')
  const token = await auth.currentUser.getIdToken()
  const response = await fetch(`${workerUrl.replace(/\/$/, '')}/v1/ai/transit-fare-estimate`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  const payload = await response.json() as TransitFareEstimateResult & { error?: string }
  if (!response.ok) throw new Error(payload.error || 'AI 票價估算暫時無法使用。')
  return payload
}
