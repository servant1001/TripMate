import { auth } from './firebase'

export interface UploadSignature { timestamp: number; signature: string; apiKey: string; cloudName: string; folder: string }
const workerUrl = import.meta.env.VITE_WORKER_API_URL as string | undefined
async function api<T>(path: string, body: Record<string, string> = {}): Promise<T> {
  if (!workerUrl || !auth?.currentUser) throw new Error('請先登入並設定 Cloudflare Worker API。')
  const token = await auth.currentUser.getIdToken()
  const response = await fetch(workerUrl.replace(/\/$/, '') + path, { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const payload = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || '服務暫時無法使用。')
  return payload
}
export async function joinTripByInviteCode(code: string): Promise<{ tripId: string }> { return api('/v1/trips/join', { code }) }
export async function uploadTripImage(file: File, kind: 'cover' | 'album' | 'shopping' = 'cover'): Promise<string> {
  const data = await api<UploadSignature>('/v1/cloudinary/signature', { kind })
  const form = new FormData(); form.append('file', file); form.append('api_key', data.apiKey); form.append('timestamp', String(data.timestamp)); form.append('signature', data.signature); form.append('folder', data.folder)
  const response = await fetch('https://api.cloudinary.com/v1_1/' + data.cloudName + '/image/upload', { method: 'POST', body: form })
  if (!response.ok) throw new Error('圖片上傳失敗。')
  return (await response.json() as { secure_url: string }).secure_url
}
export const uploadTripCover = (file: File) => uploadTripImage(file, 'cover')
