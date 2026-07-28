interface Env {
  ALLOWED_ORIGIN: string
  FIREBASE_DATABASE_URL: string
  FIREBASE_WEB_API_KEY: string
  CLOUDINARY_CLOUD_NAME: string
  CLOUDINARY_API_KEY: string
  CLOUDINARY_API_SECRET: string
  FIREBASE_SERVICE_ACCOUNT_JSON: string
  GROQ_API_KEY: string
}

interface User { localId: string; email?: string; displayName?: string }
interface Member { role?: 'owner' | 'editor' | 'viewer' }
interface Invite { tripId: string; createdBy: string; role?: 'editor' | 'viewer'; enabled?: boolean; expiresAt?: number; maxUses?: number; usedCount?: number }
interface ExchangeRateRow { date?: string; base?: string; quote?: string; rate?: number }
interface TransitFareEstimateRequest {
  tripId?: string
  country?: string
  city?: string
  currency?: string
  date?: string
  title?: string
  departureName?: string
  departureLocation?: string
  departureMapUrl?: string
  destinationName?: string
  destinationLocation?: string
  destinationMapUrl?: string
  note?: string
}
interface TransitFareEstimateResult {
  amount: number
  currency: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  assumptions: string[]
  model: string
  estimatedAt: string
}

const enc = new TextEncoder()
const b64 = (value: Uint8Array | string) => btoa(typeof value === 'string' ? value : String.fromCharCode(...value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
const pem = (value: string) => Uint8Array.from(atob(value.replace(/-----(BEGIN|END) [A-Z ]+-----/g, '').replace(/\s/g, '')), (char) => char.charCodeAt(0)).buffer
const cors = (origin?: string | null): Record<string, string> => origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}
const out = (body: unknown, status: number, origin?: string | null, headers: Record<string, string> = {}) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers, ...cors(origin) } })

async function user(request: Request, env: Env): Promise<User> {
  const idToken = request.headers.get('Authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!idToken) throw new Error('Missing authentication token.')
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${env.FIREBASE_WEB_API_KEY}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken }) })
  const payload = await response.json() as { users?: User[] }
  if (!response.ok || !payload.users?.[0]) throw new Error('Invalid authentication token.')
  return payload.users[0]
}

async function token(env: Env): Promise<string> {
  const account = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT_JSON) as { client_email: string; private_key: string; token_uri?: string }
  const now = Math.floor(Date.now() / 1000)
  const header = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const audience = account.token_uri || 'https://oauth2.googleapis.com/token'
  const claims = b64(JSON.stringify({ iss: account.client_email, scope: 'https://www.googleapis.com/auth/firebase.database https://www.googleapis.com/auth/userinfo.email', aud: audience, iat: now, exp: now + 3600 }))
  const key = await crypto.subtle.importKey('pkcs8', pem(account.private_key), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  const signature = b64(new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${header}.${claims}`))))
  const response = await fetch(audience, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claims}.${signature}` }) })
  const payload = await response.json() as { access_token?: string }
  if (!response.ok || !payload.access_token) throw new Error('Firebase service authentication failed.')
  return payload.access_token
}

async function db<T>(env: Env, path: string, method: 'GET' | 'PATCH', body?: unknown): Promise<T> {
  const response = await fetch(`${env.FIREBASE_DATABASE_URL.replace(/\/$/, '')}/${path}.json`, { method, headers: { Authorization: `Bearer ${await token(env)}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  if (!response.ok) throw new Error('Firebase database request failed.')
  return response.json() as Promise<T>
}

async function sha1(value: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-1', enc.encode(value))
  return [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}
async function deliverySignature(value: string): Promise<string> { return `s--${b64(new Uint8Array(await crypto.subtle.digest('SHA-1', enc.encode(value)))).slice(0, 8)}--` }

function validTripId(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value) }
async function assertTripMember(env: Env, tripId: string, uid: string): Promise<Member> {
  if (!validTripId(tripId)) throw new Error('Invalid trip identifier.')
  const member = await db<Member | null>(env, `tripMembers/${tripId}/${uid}`, 'GET')
  if (!member?.role) throw new Error('You are not a member of this trip.')
  return member
}
function uploadFolder(kind: 'cover' | 'album' | 'shopping' | 'expense' | 'insurance', uid: string, tripId?: string): string { return tripId ? `tripmate/trips/${tripId}/${kind === 'cover' ? 'covers' : kind}${kind === 'insurance' ? `/${uid}` : ''}` : `tripmate/users/${uid}/covers` }
function isManagedAsset(publicId: string, folder: string): boolean { return publicId.startsWith(`${folder}/`) && !publicId.includes('..') && /^[A-Za-z0-9_/-]+$/.test(publicId) }
function validCurrency(value: unknown): value is string { return typeof value === 'string' && /^[A-Z]{3}$/.test(value.trim().toUpperCase()) }
function clean(value: unknown): string { return typeof value === 'string' ? value.trim() : '' }
function extractJsonObject(value: string): string {
  const trimmed = value.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) return trimmed
  const start = trimmed.indexOf('{')
  const end = trimmed.lastIndexOf('}')
  if (start < 0 || end <= start) throw new Error('AI 回應格式無法解析。')
  return trimmed.slice(start, end + 1)
}

async function estimateTransitFareWithGroq(env: Env, input: Required<Pick<TransitFareEstimateRequest, 'country' | 'city' | 'currency' | 'title' | 'departureName' | 'destinationName'>> & TransitFareEstimateRequest): Promise<TransitFareEstimateResult> {
  if (!clean(env.GROQ_API_KEY)) throw new Error('Groq API key 尚未設定。')
  const prompt = [
    '你是旅行票價估算助理，請根據使用者提供的交通資訊，估算單程成人大眾運輸票價。',
    '請優先以當地常見的地鐵、電車、捷運、機場快線、公車等公開票價常識做合理估算。',
    '不要捏造不存在的精確官方資料；若無法完全確認，請保守估算並在 assumptions 說明。',
    '只回傳 JSON，不要加上 markdown code block。',
    'JSON schema: {"amount": number, "currency": string, "confidence": "high"|"medium"|"low", "reasoning": string, "assumptions": string[] }',
    `旅行國家：${input.country}`,
    `旅行城市：${input.city}`,
    `行程日期：${clean(input.date) || '未提供'}`,
    `幣別：${input.currency}`,
    `行程名稱：${input.title}`,
    `出發地名稱：${input.departureName}`,
    `出發地補充：${clean(input.departureLocation) || clean(input.departureMapUrl) || '未提供'}`,
    `抵達地名稱：${input.destinationName}`,
    `抵達地補充：${clean(input.destinationLocation) || clean(input.destinationMapUrl) || '未提供'}`,
    `備註：${clean(input.note) || '未提供'}`,
    'amount 請回傳數字，不要加貨幣符號；currency 請維持輸入幣別。',
  ].join('\n')
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.2,
      max_tokens: 500,
      messages: [
        { role: 'system', content: '你是謹慎的旅遊交通票價估算助理。只輸出 JSON 物件。' },
        { role: 'user', content: prompt },
      ],
    }),
  })
  const payload = await response.json() as {
    error?: { message?: string }
    choices?: Array<{ message?: { content?: string } }>
  }
  const content = payload.choices?.[0]?.message?.content
  if (!response.ok || !content) throw new Error(payload.error?.message || 'Groq 票價估算暫時無法使用。')
  const parsed = JSON.parse(extractJsonObject(content)) as Partial<TransitFareEstimateResult>
  const amount = typeof parsed.amount === 'number' ? parsed.amount : Number(parsed.amount)
  const confidence = parsed.confidence === 'high' || parsed.confidence === 'low' ? parsed.confidence : 'medium'
  const currency = clean(parsed.currency || input.currency).toUpperCase()
  if (!Number.isFinite(amount) || amount <= 0 || !validCurrency(currency)) throw new Error('AI 票價估算結果格式不正確。')
  return {
    amount: Math.round(amount * 100) / 100,
    currency,
    confidence,
    reasoning: clean(parsed.reasoning) || '依據路線型態與城市常見大眾運輸費率估算。',
    assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions.map((item) => clean(item)).filter(Boolean).slice(0, 5) : [],
    model: 'llama-3.3-70b-versatile',
    estimatedAt: new Date().toISOString(),
  }
}

async function latestExchangeRate(request: Request, origin: string | null): Promise<Response> {
  const url = new URL(request.url)
  const from = url.searchParams.get('from')?.trim().toUpperCase() || ''
  const to = url.searchParams.get('to')?.trim().toUpperCase() || 'TWD'
  if (!validCurrency(from) || !validCurrency(to)) return out({ error: '請提供有效的三碼幣別。' }, 400, origin)
  const cacheControl = { 'Cache-Control': 'public, max-age=86400' }
  if (from === to) {
    return out({ from, to, rate: 1, date: new Date().toISOString().slice(0, 10), provider: 'TripMate local cache', cached: true }, 200, origin, cacheControl)
  }
  const cacheUrl = new URL(url.origin)
  cacheUrl.pathname = '/__tripmate_cache/exchange-rate'
  cacheUrl.searchParams.set('from', from)
  cacheUrl.searchParams.set('to', to)
  const cacheKey = new Request(cacheUrl.toString(), { method: 'GET' })
  const cache = await caches.open('tripmate-exchange')
  const cached = await cache.match(cacheKey)
  if (cached) {
    const payload = await cached.json()
    return out({ ...(payload as Record<string, unknown>), cached: true }, 200, origin, cacheControl)
  }
  const remote = await fetch(`https://api.frankfurter.dev/v2/rates?base=${from}&quotes=${to}`, { headers: { Accept: 'application/json' } })
  const payload = await remote.json() as ExchangeRateRow[]
  const row = Array.isArray(payload) ? payload[0] : undefined
  if (!remote.ok || !row?.date || !(typeof row.rate === 'number' && Number.isFinite(row.rate) && row.rate > 0)) {
    throw new Error('目前無法取得最新參考匯率。')
  }
  const result = { from, to, rate: row.rate, date: row.date, provider: 'Frankfurter', cached: false }
  await cache.put(cacheKey, new Response(JSON.stringify(result), { headers: { 'Content-Type': 'application/json', ...cacheControl } }))
  return out(result, 200, origin, cacheControl)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    const allowed = Boolean(origin && env.ALLOWED_ORIGIN.split(',').map((value) => value.trim()).includes(origin))
    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: allowed && origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', Vary: 'Origin' } : {} })
    if (!allowed) return out({ error: 'Origin is not allowed.' }, 403)
    const path = new URL(request.url).pathname
    if (path === '/v1/exchange-rate') {
      if (request.method !== 'GET') return out({ error: 'Method not allowed.' }, 405, origin)
      return latestExchangeRate(request, origin)
    }
    if (request.method !== 'POST') return out({ error: 'Method not allowed.' }, 405, origin)
    try {
      const me = await user(request, env)
      if (path === '/v1/cloudinary/signature') {
        const body = await request.json() as { kind?: string; tripId?: string }
        const kind = body.kind === 'album' || body.kind === 'shopping' || body.kind === 'expense' || body.kind === 'insurance' ? body.kind : 'cover'
        if (body.tripId) await assertTripMember(env, body.tripId, me.localId)
        if ((kind === 'album' || kind === 'shopping' || kind === 'expense' || kind === 'insurance') && !body.tripId) return out({ error: 'Trip identifier is required for this upload.' }, 400, origin)
        const folder = uploadFolder(kind, me.localId, body.tripId)
        const timestamp = Math.floor(Date.now() / 1000)
        return out({ timestamp, signature: await sha1(`folder=${folder}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`), apiKey: env.CLOUDINARY_API_KEY, cloudName: env.CLOUDINARY_CLOUD_NAME, folder }, 200, origin)
      }
      if (path === '/v1/cloudinary/delete') {
        const body = await request.json() as { publicId?: string; kind?: string; tripId?: string }
        const kind = body.kind === 'album' || body.kind === 'shopping' || body.kind === 'expense' || body.kind === 'insurance' ? body.kind : 'cover'
        if (!body.publicId) return out({ error: 'Cloudinary public ID is required.' }, 400, origin)
        if (body.tripId) await assertTripMember(env, body.tripId, me.localId)
        if ((kind === 'album' || kind === 'shopping' || kind === 'expense' || kind === 'insurance') && !body.tripId) return out({ error: 'Trip identifier is required for this asset.' }, 400, origin)
        const folder = uploadFolder(kind, me.localId, body.tripId)
        if (!isManagedAsset(body.publicId, folder)) return out({ error: 'This asset is outside your permitted folder.' }, 403, origin)
        const timestamp = Math.floor(Date.now() / 1000)
        const signature = await sha1(`invalidate=true&public_id=${body.publicId}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`)
        const response = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/destroy`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ public_id: body.publicId, timestamp: String(timestamp), api_key: env.CLOUDINARY_API_KEY, signature, invalidate: 'true' }) })
        const result = await response.json() as { result?: string }
        if (!response.ok || (result.result && result.result !== 'ok' && result.result !== 'not found')) throw new Error('Cloudinary asset deletion failed.')
        return out({ result: result.result || 'ok' }, 200, origin)
      }
      if (path === '/v1/cloudinary/insurance-delivery') {
        const body = await request.json() as { tripId?: string; ownerId?: string; publicId?: string; resourceType?: 'image' | 'raw'; format?: string; version?: string }
        if (!body.tripId || !body.ownerId || !body.publicId || !body.format || !validTripId(body.tripId)) return out({ error: 'Invalid attachment request.' }, 400, origin)
        await assertTripMember(env, body.tripId, me.localId)
        const policy = await db<{ visibility?: string } | null>(env, `travelInsurances/${body.tripId}/${body.ownerId}`, 'GET')
        if (!policy || (me.localId !== body.ownerId && policy.visibility !== 'trip_members')) return out({ error: 'You are not allowed to view this attachment.' }, 403, origin)
        const resourceType = body.resourceType === 'raw' ? 'raw' : 'image'; const version = /^\d+$/.test(body.version || '') ? `v${body.version}/` : ''; const target = `${version}${body.publicId}.${body.format}`
        return out({ url: `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/authenticated/${await deliverySignature(`${target}${env.CLOUDINARY_API_SECRET}`)}/${target}` }, 200, origin)
      }
      if (path === '/v1/trips/join') {
        const body = await request.json() as { code?: string }
        const code = body.code?.trim().toUpperCase()
        if (!code) return out({ error: 'Invite code is required.' }, 400, origin)
        const invite = await db<Invite | null>(env, `tripInvites/${code}`, 'GET')
        if (!invite || invite.enabled === false || (invite.expiresAt && invite.expiresAt < Date.now()) || (invite.maxUses && (invite.usedCount || 0) >= invite.maxUses)) return out({ error: 'Invite code is invalid or expired.' }, 404, origin)
        const trip = await db<{ ownerId?: string } | null>(env, `trips/${invite.tripId}`, 'GET')
        if (!trip || trip.ownerId !== invite.createdBy) return out({ error: 'Invite verification failed.' }, 403, origin)
        await db(env, '', 'PATCH', { [`tripMembers/${invite.tripId}/${me.localId}`]: { name: me.displayName || me.email?.split('@')[0] || 'Companion', email: me.email || '', role: invite.role || 'editor', joinedAt: Date.now() }, [`userTrips/${me.localId}/${invite.tripId}`]: true, [`tripInvites/${code}/usedCount`]: (invite.usedCount || 0) + 1 })
        return out({ tripId: invite.tripId }, 200, origin)
      }
      if (path === '/v1/ai/transit-fare-estimate') {
        const body = await request.json() as TransitFareEstimateRequest
        const tripId = clean(body.tripId)
        const country = clean(body.country)
        const city = clean(body.city)
        const currency = clean(body.currency).toUpperCase()
        const title = clean(body.title)
        const departureName = clean(body.departureName || body.departureLocation || title)
        const destinationName = clean(body.destinationName || body.destinationLocation)
        if (!tripId || !country || !city || !validCurrency(currency) || !title) return out({ error: '請提供完整的旅行與交通資訊。' }, 400, origin)
        if (!departureName || !destinationName) return out({ error: '估算交通票價前，請先設定出發地與抵達地。' }, 400, origin)
        await assertTripMember(env, tripId, me.localId)
        const result = await estimateTransitFareWithGroq(env, {
          ...body,
          country,
          city,
          currency,
          title,
          departureName,
          destinationName,
        })
        return out(result, 200, origin)
      }
      return out({ error: 'Route not found.' }, 404, origin)
    } catch (error) { return out({ error: error instanceof Error ? error.message : 'Worker error.' }, 401, origin) }
  },
} satisfies ExportedHandler<Env>
