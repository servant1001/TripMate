// Deploy this handler on Cloudflare Workers. CLOUDINARY_API_SECRET stays server-side.
export interface Env { CLOUDINARY_API_KEY: string; CLOUDINARY_API_SECRET: string; CLOUDINARY_CLOUD_NAME: string; ALLOWED_ORIGIN: string }
export default { async fetch(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })
  if (request.headers.get('Origin') !== env.ALLOWED_ORIGIN) return new Response('Forbidden', { status: 403 })
  // Verify Firebase ID token and trip membership here before issuing a signature.
  const timestamp = Math.floor(Date.now() / 1000); const folder = 'tripmate/covers'
  const source = `folder=${folder}&timestamp=${timestamp}${env.CLOUDINARY_API_SECRET}`
  const hash = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(source))
  const signature = [...new Uint8Array(hash)].map((x) => x.toString(16).padStart(2, '0')).join('')
  return Response.json({ timestamp, signature, apiKey: env.CLOUDINARY_API_KEY, cloudName: env.CLOUDINARY_CLOUD_NAME, folder }, { headers: { 'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN } })
} }
