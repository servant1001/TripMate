export interface ExchangeRateQuote {
  from: string
  to: string
  rate: number
  date: string
  provider: string
  cached?: boolean
}

const workerUrl = import.meta.env.VITE_WORKER_API_URL as string | undefined
const DAY_MS = 24 * 60 * 60 * 1000
const cache = new Map<string, { expiresAt: number; data?: ExchangeRateQuote; promise?: Promise<ExchangeRateQuote> }>()

function normalizeCurrency(value: string) {
  return value.trim().toUpperCase()
}

export async function getLatestExchangeRate(fromCurrency: string, toCurrency = 'TWD'): Promise<ExchangeRateQuote> {
  const from = normalizeCurrency(fromCurrency)
  const to = normalizeCurrency(toCurrency)
  if (!from || !to) throw new Error('缺少匯率查詢幣別。')
  if (from === to) {
    return {
      from,
      to,
      rate: 1,
      date: new Date().toISOString().slice(0, 10),
      provider: 'TripMate local cache',
      cached: true,
    }
  }
  if (!workerUrl) throw new Error('請先設定 Cloudflare Worker API。')
  const key = `${from}_${to}`
  const current = cache.get(key)
  if (current?.data && current.expiresAt > Date.now()) return current.data
  if (current?.promise) return current.promise

  const promise = fetch(`${workerUrl.replace(/\/$/, '')}/v1/exchange-rate?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`, {
    method: 'GET',
    headers: { Accept: 'application/json' },
  })
    .then(async (response) => {
      const payload = await response.json() as ExchangeRateQuote & { error?: string }
      if (!response.ok) throw new Error(payload.error || '無法取得最新參考匯率。')
      const data: ExchangeRateQuote = {
        from: normalizeCurrency(payload.from),
        to: normalizeCurrency(payload.to),
        rate: Number(payload.rate) || 0,
        date: payload.date,
        provider: payload.provider || 'Frankfurter',
        cached: payload.cached,
      }
      cache.set(key, { expiresAt: Date.now() + DAY_MS, data })
      return data
    })
    .catch((error) => {
      cache.delete(key)
      throw error
    })

  cache.set(key, { expiresAt: Date.now() + DAY_MS, promise })
  return promise
}
