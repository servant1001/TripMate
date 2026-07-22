interface Env {
  ALLOWED_ORIGIN: string
  FIREBASE_DATABASE_URL: string
  FIREBASE_WEB_API_KEY: string
  CLOUDINARY_CLOUD_NAME: string
  CLOUDINARY_API_KEY: string
  CLOUDINARY_API_SECRET: string
  FIREBASE_SERVICE_ACCOUNT_JSON: string
}

interface User { localId: string; email?: string; displayName?: string }
interface Member { role?: 'owner' | 'editor' | 'viewer' }
interface Invite { tripId: string; createdBy: string; role?: 'editor' | 'viewer'; enabled?: boolean; expiresAt?: number; maxUses?: number; usedCount?: number }

const enc = new TextEncoder()
const b64 = (value: Uint8Array | string) => btoa(typeof value === 'string' ? value : String.fromCharCode(...value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
const pem = (value: string) => Uint8Array.from(atob(value.replace(/-----(BEGIN|END) [A-Z ]+-----/g, '').replace(/\s/g, '')), (char) => char.charCodeAt(0)).buffer
const out = (body: unknown, status: number, origin?: string | null) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...(origin ? { 'Access-Control-Allow-Origin': origin, Vary: 'Origin' } : {}) } })

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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const origin = request.headers.get('Origin')
    const allowed = Boolean(origin && env.ALLOWED_ORIGIN.split(',').map((value) => value.trim()).includes(origin))
    if (request.method === 'OPTIONS') return new Response(null, { status: allowed ? 204 : 403, headers: allowed && origin ? { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': 'Authorization, Content-Type', 'Access-Control-Allow-Methods': 'POST, OPTIONS', Vary: 'Origin' } : {} })
    if (!allowed) return out({ error: 'Origin is not allowed.' }, 403)
    if (request.method !== 'POST') return out({ error: 'Method not allowed.' }, 405, origin)
    try {
      const me = await user(request, env)
      const path = new URL(request.url).pathname
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
      return out({ error: 'Route not found.' }, 404, origin)
    } catch (error) { return out({ error: error instanceof Error ? error.message : 'Worker error.' }, 401, origin) }
  },
} satisfies ExportedHandler<Env>
