/**
 * Magic-link auth state (verified = completed magic link once).
 * Stored in localStorage so we don't ask again.
 */

export const EMAIL_STORAGE_KEY = 'watermarkfile_email'
export const VERIFIED_STORAGE_KEY = 'watermarkfile_verified'

export function getStoredEmail(): string | null {
  try {
    const e = localStorage.getItem(EMAIL_STORAGE_KEY)
    return e?.trim() || null
  } catch {
    return null
  }
}

export function getIsVerified(): boolean {
  try {
    return localStorage.getItem(VERIFIED_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

export function setVerified(email: string): void {
  try {
    localStorage.setItem(EMAIL_STORAGE_KEY, email.trim().toLowerCase())
    localStorage.setItem(VERIFIED_STORAGE_KEY, 'true')
  } catch {
    // ignore
  }
}

export function getMagicTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null
  const params = new URLSearchParams(window.location.search)
  return params.get('magic')?.trim() || null
}

export function clearMagicFromUrl(): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.delete('magic')
  const newUrl = url.pathname + url.search || '/'
  window.history.replaceState({}, '', newUrl)
}
