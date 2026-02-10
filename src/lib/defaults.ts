import type { WatermarkMode, Template, Scope } from '../types'

export const DEFAULTS_STORAGE_KEY = 'watermarkfile_defaults'

export interface StoredDefaults {
  mode: WatermarkMode
  text?: string
  template: Template
  scope: Scope
  /** Set when loaded from API; used to show default logo and create a File for the next watermark */
  logo_url?: string
  /** Email for the user whose defaults these are; used to fetch default logo when mode is logo */
  email?: string
}

export function getStoredDefaults(): StoredDefaults | null {
  try {
    const raw = localStorage.getItem(DEFAULTS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (!parsed || typeof parsed.mode !== 'string' || typeof parsed.template !== 'string' || typeof parsed.scope !== 'string') return null
    const mode = parsed.mode as WatermarkMode
    const template = parsed.template as Template
    const scope = parsed.scope as Scope
    if (!['text', 'logo'].includes(mode) || !['diagonal-center', 'repeating-pattern', 'footer-tag'].includes(template) || !['all-pages', 'first-page-only'].includes(scope)) return null
    return {
      mode,
      text: typeof parsed.text === 'string' ? parsed.text : undefined,
      template,
      scope,
    }
  } catch {
    return null
  }
}

export function setStoredDefaults(defaults: StoredDefaults): void {
  try {
    localStorage.setItem(DEFAULTS_STORAGE_KEY, JSON.stringify(defaults))
  } catch {
    // ignore
  }
}
