/**
 * API base URL for production when frontend and API are on different origins.
 * Set VITE_API_BASE_URL in Vercel (e.g. https://your-api.railway.app) if you deploy API separately.
 * Leave unset when frontend and API are same origin (e.g. full app on Vercel).
 */
const base = (import.meta.env.VITE_API_BASE_URL ?? '').toString().trim().replace(/\/$/, '')

export function apiUrl(path: string): string {
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}
