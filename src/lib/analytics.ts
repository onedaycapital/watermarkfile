/**
 * Amplitude analytics for WatermarkFile.
 * Set VITE_AMPLITUDE_API_KEY in .env (and in Vercel env) to enable.
 * Tracks: user identity, watermark runs, file types, downloads, email, defaults.
 */

import {
  init as amplitudeInit,
  track as amplitudeTrack,
  setUserId as amplitudeSetUserId,
  identify as amplitudeIdentify,
  Identify,
} from '@amplitude/analytics-browser'

const AMPLITUDE_KEY = (import.meta.env.VITE_AMPLITUDE_API_KEY ?? '').toString().trim()
const USER_ID_KEY = 'watermarkfile_amplitude_user_id'

let initialized = false

function getOrCreateUserId(): string {
  try {
    let id = localStorage.getItem(USER_ID_KEY)
    if (!id) {
      id = `anon_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
      localStorage.setItem(USER_ID_KEY, id)
    }
    return id
  } catch {
    return `anon_${Date.now()}`
  }
}

/**
 * Call once at app load. No-op if no API key.
 */
export function init(): void {
  if (!AMPLITUDE_KEY || initialized) return
  try {
    amplitudeInit(AMPLITUDE_KEY, undefined, {
      defaultTracking: { sessions: true, pageViews: true },
    })
    const userId = getOrCreateUserId()
    amplitudeSetUserId(userId)
    initialized = true
  } catch {
    // ignore
  }
}

/**
 * Track a named event with optional properties. No-op if Amplitude not initialized.
 */
export function track(eventName: string, properties?: Record<string, unknown>): void {
  if (!initialized) return
  try {
    amplitudeTrack(eventName, properties)
  } catch {
    // ignore
  }
}

/**
 * Set or update user identity (e.g. after email capture). Use hash if you don't want to store raw email in Amplitude.
 */
export function setUserId(userId: string | null): void {
  if (!initialized) return
  try {
    amplitudeSetUserId(userId ?? getOrCreateUserId())
  } catch {
    // ignore
  }
}

/**
 * Set user properties (e.g. total uploads, last file types). Merges with existing.
 */
export function identify(properties: Record<string, string | number | boolean | string[]>): void {
  if (!initialized) return
  try {
    const identifyObj = new Identify()
    for (const [key, value] of Object.entries(properties)) {
      identifyObj.set(key, value)
    }
    amplitudeIdentify(identifyObj)
  } catch {
    // ignore
  }
}

/**
 * Add to a numeric user property (e.g. total_uploads += 1).
 */
export function addUserProperty(key: string, value: number): void {
  if (!initialized) return
  try {
    const identifyObj = new Identify()
    identifyObj.add(key, value)
    amplitudeIdentify(identifyObj)
  } catch {
    // ignore
  }
}

// ——— Event names and helpers (for consistency and discovery in Amplitude) ———

export const AnalyticsEvents = {
  PageView: 'Page View',
  WatermarkStarted: 'Watermark Started',
  WatermarkCompleted: 'Watermark Completed',
  WatermarkFailed: 'Watermark Failed',
  FileSkippedSizeLimit: 'File Skipped (Size Limit)',
  DownloadClicked: 'Download Clicked',
  EmailCaptureOpened: 'Email Capture Opened',
  EmailCaptured: 'Email Captured',
  EmailSkipped: 'Email Skipped',
  EmailToggled: 'Email Toggled',
  SaveDefaultsClicked: 'Save Defaults Clicked',
  SaveDefaultsSuccess: 'Save Defaults Success',
  LoadDefaultsClicked: 'Load Defaults Clicked',
  LoadDefaultsSuccess: 'Load Defaults Success',
  LoadDefaultsFailed: 'Load Defaults Failed',
  StartOverClicked: 'Start Over Clicked',
  FilesSelected: 'Files Selected',
} as const

/** Get file extension from filename (e.g. .pdf, .jpg). */
export function getFileExtension(name: string): string {
  const match = /\.([^.]+)$/i.exec(name)
  return match ? `.${match[1].toLowerCase()}` : 'unknown'
}
