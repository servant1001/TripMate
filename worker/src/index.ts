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
  source: 'rule' | 'ai'
  provider: string
  fareMode?: 'ticket' | 'ic'
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
  assumptions: string[]
  model: string
  estimatedAt: string
}

type FareMode = 'ticket' | 'ic'
type FareBracket = { maxStops: number; ticket: number; ic: number }

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

const TOKYO_METRO_FARE_BRACKETS: FareBracket[] = [
  { maxStops: 4, ticket: 180, ic: 178 },
  { maxStops: 8, ticket: 210, ic: 209 },
  { maxStops: 14, ticket: 260, ic: 252 },
  { maxStops: 20, ticket: 300, ic: 293 },
  { maxStops: Number.POSITIVE_INFINITY, ticket: 330, ic: 324 },
]

const TOEI_SUBWAY_FARE_BRACKETS: FareBracket[] = [
  { maxStops: 3, ticket: 180, ic: 178 },
  { maxStops: 7, ticket: 220, ic: 220 },
  { maxStops: 12, ticket: 280, ic: 272 },
  { maxStops: 17, ticket: 330, ic: 325 },
  { maxStops: 22, ticket: 380, ic: 377 },
  { maxStops: Number.POSITIVE_INFINITY, ticket: 430, ic: 430 },
]

const KEISEI_ACCESS_FIXED_FARES: Record<string, { ticket: number; ic: number }> = {
  '新鎌ヶ谷': { ticket: 910, ic: 906 },
  '新鎌谷': { ticket: 910, ic: 906 },
  '東松戸': { ticket: 940, ic: 936 },
  '青砥': { ticket: 1120, ic: 1110 },
  '日暮里': { ticket: 1240, ic: 1235 },
  '上野': { ticket: 1240, ic: 1235 },
  '京成上野': { ticket: 1240, ic: 1235 },
  '押上': { ticket: 1170, ic: 1162 },
  '浅草': { ticket: 1290, ic: 1276 },
  '浅草橋': { ticket: 1290, ic: 1276 },
  '東日本橋': { ticket: 1290, ic: 1276 },
  '人形町': { ticket: 1330, ic: 1318 },
  '日本橋': { ticket: 1330, ic: 1318 },
  '東銀座': { ticket: 1330, ic: 1318 },
  '新橋': { ticket: 1330, ic: 1318 },
  '品川': { ticket: 1520, ic: 1502 },
}

const TOKYO_METRO_LINES: Record<string, string[]> = {
  '半蔵門線': ['渋谷', '表参道', '青山一丁目', '永田町', '半蔵門', '九段下', '神保町', '大手町', '三越前', '水天宮前', '清澄白河', '住吉', '錦糸町', '押上'],
  '銀座線': ['浅草', '田原町', '稲荷町', '上野', '上野広小路', '末広町', '神田', '三越前', '日本橋', '京橋', '銀座', '新橋', '虎ノ門', '溜池山王', '赤坂見附', '青山一丁目', '外苑前', '表参道', '渋谷'],
  '日比谷線': ['北千住', '南千住', '三ノ輪', '入谷', '上野', '仲御徒町', '秋葉原', '小伝馬町', '人形町', '茅場町', '八丁堀', '築地', '東銀座', '銀座', '日比谷', '霞ケ関', '虎ノ門ヒルズ', '神谷町', '六本木', '広尾', '恵比寿', '中目黒'],
}

const TOEI_LINES: Record<string, string[]> = {
  '浅草線': ['西馬込', '馬込', '中延', '戸越', '五反田', '高輪台', '泉岳寺', '三田', '大門', '新橋', '東銀座', '宝町', '日本橋', '人形町', '東日本橋', '浅草橋', '蔵前', '浅草', '本所吾妻橋', '押上'],
}

const STATION_ALIAS: Record<string, string> = {
  '淺草': '浅草',
  '淺草橋': '浅草橋',
  '淺草線': '浅草線',
  '半藏門': '半蔵門',
  '半藏門線': '半蔵門線',
  '澀谷': '渋谷',
  '錦系町': '錦糸町',
  '清澄白河站': '清澄白河',
  '錦糸町站': '錦糸町',
  '押上站': '押上',
  '京成上野站': '京成上野',
  '上野站': '上野',
  '成田機場第一航廈': '成田空港第1ターミナル',
  '成田機場第1航廈': '成田空港第1ターミナル',
  '成田機場第一候機樓': '成田空港第1ターミナル',
  '成田機場第1候機樓': '成田空港第1ターミナル',
  '成田機場第二航廈': '成田空港第2・第3ターミナル',
  '成田機場第2航廈': '成田空港第2・第3ターミナル',
  '成田機場第二候機樓': '成田空港第2・第3ターミナル',
  '成田機場第2候機樓': '成田空港第2・第3ターミナル',
  '成田機場第二第三航廈': '成田空港第2・第3ターミナル',
  '成田機場第2第3航廈': '成田空港第2・第3ターミナル',
  '成田機場第2・第3航廈': '成田空港第2・第3ターミナル',
  '成田機場第2第3候機樓': '成田空港第2・第3ターミナル',
  '成田機場第2・第3候機樓': '成田空港第2・第3ターミナル',
}

const AIRPORT_ALIASES = new Set(['成田空港第1ターミナル', '成田空港第2・第3ターミナル'])

function normalizeStationText(value: string): string {
  let normalized = clean(value)
    .replace(/[（）()]/g, ' ')
    .replace(/東京Metro|TokyoMetro|Toei Subway|都營地鐵|都営地下鉄|東京メトロ|京成Access特快|ACCESS特快|JR東日本|JR/gi, ' ')
    .replace(/[－–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  if (normalized.includes('-')) normalized = normalized.split('-')[0]?.trim() || normalized
  normalized = normalized.replace(/駅$/u, '').trim()
  normalized = normalized.replace(/[第候機樓楼]/g, (char) => (char === '樓' ? '楼' : char))
  const compact = normalized.replace(/\s+/g, '')
  return STATION_ALIAS[compact] || STATION_ALIAS[normalized] || normalized
}

function normalizeLineText(value: string): string {
  const normalized = clean(value).replace(/\s+/g, '')
  if (/半[藏蔵]門線/.test(normalized)) return '半蔵門線'
  if (/(銀座線)/.test(normalized)) return '銀座線'
  if (/(日比谷線)/.test(normalized)) return '日比谷線'
  if (/(浅草線|淺草線)/.test(normalized)) return '浅草線'
  return ''
}

function detectLineName(input: TransitFareEstimateRequest): string {
  const joined = [
    input.title,
    input.departureName,
    input.departureLocation,
    input.destinationName,
    input.destinationLocation,
  ].map((value) => clean(value)).join(' ')
  return normalizeLineText(joined)
}

function detectFareMode(input: TransitFareEstimateRequest): FareMode {
  const joined = [
    input.title,
    input.note,
    input.departureName,
    input.destinationName,
  ].map((value) => clean(value).toLowerCase()).join(' ')
  return /pasmo|suica|ic|交通卡|ic卡/.test(joined) ? 'ic' : 'ticket'
}

function fareFromBrackets(brackets: FareBracket[], stops: number, mode: FareMode) {
  const match = brackets.find((item) => stops <= item.maxStops) || brackets[brackets.length - 1]
  return mode === 'ic' ? match.ic : match.ticket
}

function estimateFromLineStops(line: string[], from: string, to: string) {
  const fromIndex = line.findIndex((item) => item === from)
  const toIndex = line.findIndex((item) => item === to)
  if (fromIndex < 0 || toIndex < 0) return null
  return Math.abs(fromIndex - toIndex)
}

function buildRuleResult(amount: number, currency: string, provider: string, fareMode: FareMode, confidence: 'high' | 'medium' | 'low', reasoning: string, assumptions: string[], model: string): TransitFareEstimateResult {
  return {
    amount,
    currency,
    source: 'rule',
    provider,
    fareMode,
    confidence,
    reasoning,
    assumptions,
    model,
    estimatedAt: new Date().toISOString(),
  }
}

function estimateTransitFareByOfficialRules(input: Required<Pick<TransitFareEstimateRequest, 'country' | 'city' | 'currency' | 'title' | 'departureName' | 'destinationName'>> & TransitFareEstimateRequest): TransitFareEstimateResult | null {
  const fareMode = detectFareMode(input)
  const departure = normalizeStationText(input.departureName)
  const destination = normalizeStationText(input.destinationName)
  const lineName = detectLineName(input)
  const ticketLabel = fareMode === 'ic' ? 'IC 卡票價' : '車票票價'

  const nonAirport = AIRPORT_ALIASES.has(departure) ? destination : AIRPORT_ALIASES.has(destination) ? departure : ''
  if ((AIRPORT_ALIASES.has(departure) || AIRPORT_ALIASES.has(destination)) && nonAirport && KEISEI_ACCESS_FIXED_FARES[nonAirport]) {
    const fare = KEISEI_ACCESS_FIXED_FARES[nonAirport]
    const amount = fareMode === 'ic' ? fare.ic : fare.ticket
    return buildRuleResult(
      amount,
      input.currency,
      '京成 ACCESS 特快官方票價表',
      fareMode,
      'high',
      `根據京成 ACCESS 特快官方主要車站票價表，${nonAirport} 往返成田機場適用 ${ticketLabel} ${amount} ${input.currency}。`,
      [
        '目前優先使用你提供路線可對應的京成官方固定票價。',
        '若行程文字未標示 IC 卡，系統預設以車票票價估算。',
      ],
      'official-rule:keisei-access',
    )
  }

  if (lineName && TOKYO_METRO_LINES[lineName]) {
    const stops = estimateFromLineStops(TOKYO_METRO_LINES[lineName], departure, destination)
    if (stops != null) {
      const amount = fareFromBrackets(TOKYO_METRO_FARE_BRACKETS, stops, fareMode)
      return buildRuleResult(
        amount,
        input.currency,
        'Tokyo Metro 官方票價級距',
        fareMode,
        stops <= 1 ? 'high' : 'medium',
        `根據 Tokyo Metro 官方票價級距，並以 ${lineName} 同線 ${stops} 站的站數近似乘車距離，推定適用 ${ticketLabel} ${amount} ${input.currency}。`,
        [
          'Tokyo Metro 官方以乘車距離區間計價。',
          '目前第一版以同線站數近似距離；未直接串接官方轉乘查詢服務。',
          fareMode === 'ticket' ? '目前預設採用車票票價；若實際使用 PASMO / Suica，票價通常會略低。': '已依 IC 卡票價估算。',
        ],
        'official-rule:tokyo-metro',
      )
    }
  }

  if (lineName && TOEI_LINES[lineName]) {
    const stops = estimateFromLineStops(TOEI_LINES[lineName], departure, destination)
    if (stops != null) {
      const amount = fareFromBrackets(TOEI_SUBWAY_FARE_BRACKETS, stops, fareMode)
      return buildRuleResult(
        amount,
        input.currency,
        '都營地鐵官方票價級距',
        fareMode,
        stops <= 1 ? 'high' : 'medium',
        `根據都營地鐵官方票價級距，並以 ${lineName} 同線 ${stops} 站的站數近似乘車距離，推定適用 ${ticketLabel} ${amount} ${input.currency}。`,
        [
          '都營地鐵官方以最短路徑距離計價。',
          '目前第一版以同線站數近似距離；特殊轉乘例外尚未細拆。',
          fareMode === 'ticket' ? '目前預設採用車票票價；若實際使用 IC 卡，票價可能略低。': '已依 IC 卡票價估算。',
        ],
        'official-rule:toei-subway',
      )
    }
  }

  return null
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
    source: 'ai',
    provider: 'Groq AI 票價估算',
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
  const forceRefresh = url.searchParams.get('refresh') === '1'
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
  if (!forceRefresh) {
    const cached = await cache.match(cacheKey)
    if (cached) {
      const payload = await cached.json()
      return out({ ...(payload as Record<string, unknown>), cached: true }, 200, origin, cacheControl)
    }
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
        const normalizedInput = {
          ...body,
          country,
          city,
          currency,
          title,
          departureName,
          destinationName,
        }
        const result = estimateTransitFareByOfficialRules(normalizedInput) || await estimateTransitFareWithGroq(env, normalizedInput)
        return out(result, 200, origin)
      }
      return out({ error: 'Route not found.' }, 404, origin)
    } catch (error) { return out({ error: error instanceof Error ? error.message : 'Worker error.' }, 401, origin) }
  },
} satisfies ExportedHandler<Env>
