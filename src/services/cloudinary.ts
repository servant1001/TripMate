import { auth } from './firebase'
import type { InsuranceAttachment } from '../types'

export interface UploadSignature { timestamp: number; signature: string; apiKey: string; cloudName: string; folder: string }
type AssetKind = 'cover' | 'album' | 'shopping' | 'expense' | 'insurance'
const workerUrl = import.meta.env.VITE_WORKER_API_URL as string | undefined

async function api<T>(path: string, body: Record<string, string> = {}): Promise<T> {
  if (!workerUrl || !auth?.currentUser) throw new Error('請先登入並設定 Cloudflare Worker API。')
  const token = await auth.currentUser.getIdToken()
  const response = await fetch(`${workerUrl.replace(/\/$/, '')}${path}`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const payload = await response.json() as T & { error?: string }
  if (!response.ok) throw new Error(payload.error || '服務暫時無法使用。')
  return payload
}

export async function joinTripByInviteCode(code: string): Promise<{ tripId: string }> { return api('/v1/trips/join', { code }) }
export async function uploadTripImage(file: File, kind: AssetKind = 'cover', tripId?: string): Promise<string> {
  const data = await api<UploadSignature>('/v1/cloudinary/signature', { kind, ...(tripId ? { tripId } : {}) })
  const form = new FormData()
  form.append('file', file)
  form.append('api_key', data.apiKey)
  form.append('timestamp', String(data.timestamp))
  form.append('signature', data.signature)
  form.append('folder', data.folder)
  const response = await fetch(`https://api.cloudinary.com/v1_1/${data.cloudName}/image/upload`, { method: 'POST', body: form })
  if (!response.ok) throw new Error('圖片上傳失敗。')
  return (await response.json() as { secure_url: string }).secure_url
}
export async function uploadInsuranceAttachment(file: File, tripId: string): Promise<InsuranceAttachment> {
  if (file.size > 10 * 1024 * 1024) throw new Error('附件大小不可超過 10 MB。')
  if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(file.type)) throw new Error('僅支援 JPG、PNG、WebP 與 PDF 附件。')
  const data = await api<UploadSignature>('/v1/cloudinary/signature', { kind: 'insurance', tripId })
  const form = new FormData(); form.append('file', file); form.append('api_key', data.apiKey); form.append('timestamp', String(data.timestamp)); form.append('signature', data.signature); form.append('folder', data.folder); form.append('type', 'authenticated')
  const resourceType = file.type === 'application/pdf' ? 'raw' : 'image'
  const response = await fetch(`https://api.cloudinary.com/v1_1/${data.cloudName}/${resourceType}/authenticated`, { method: 'POST', body: form })
  if (!response.ok) throw new Error('保單附件上傳失敗。')
  const result = await response.json() as { public_id: string; secure_url: string; resource_type: 'image' | 'raw'; format: string; version?: number; bytes: number; original_filename?: string }
  return { publicId: result.public_id, secureUrl: result.secure_url, resourceType: result.resource_type, format: result.format, version: result.version, bytes: result.bytes, originalFilename: result.original_filename || file.name, folder: data.folder, uploadedBy: auth?.currentUser?.uid || '', createdAt: Date.now() }
}
export async function getInsuranceAttachmentUrl(attachment: InsuranceAttachment, tripId: string, ownerId: string): Promise<string> { const result = await api<{ url: string }>('/v1/cloudinary/insurance-delivery', { tripId, ownerId, publicId: attachment.publicId || '', resourceType: attachment.resourceType, format: attachment.format, version: String(attachment.version || '') }); return result.url }
/** Deletes only assets in TripMate-managed Cloudinary folders. */
export async function deleteTripImage(publicId: string, kind: AssetKind, tripId?: string): Promise<void> { await api('/v1/cloudinary/delete', { publicId, kind, ...(tripId ? { tripId } : {}) }) }
export const uploadTripCover = (file: File, tripId?: string) => uploadTripImage(file, 'cover', tripId)
