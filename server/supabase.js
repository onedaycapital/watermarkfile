/**
 * Supabase client for backend only. Uses service role key.
 * If SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing, all functions no-op.
 */

import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

const url = (process.env.SUPABASE_URL || '').toString().trim()
const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').toString().trim()

let client = null
if (url && serviceRoleKey) {
  client = createClient(url, serviceRoleKey)
}

const BUCKET = 'watermarked-files'
const DEFAULT_LOGOS_PREFIX = 'default-logos'

/** Sanitize email for use in storage path (no @ or . or +) */
function sanitizeEmailForPath(email) {
  return String(email).toLowerCase().replace(/[@.+]/g, '_')
}

/**
 * Start of current month (UTC) as YYYY-MM-DD.
 */
function startOfCurrentMonth() {
  const d = new Date()
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-01`
}

/**
 * Check if email exists in user_stats (user has used the app / is "active").
 * @param {string} email
 * @returns {Promise<boolean>}
 */
export async function hasUserInStats(email) {
  if (!client || !email) return false
  try {
    const { data, error } = await client.from('user_stats').select('email').eq('email', email).maybeSingle()
    return !error && !!data
  } catch (err) {
    console.error('[supabase] hasUserInStats:', err.message)
    return false
  }
}

/**
 * Get user_stats for an email (for first-month-free and monthly limit checks).
 * @param {string} email
 * @returns {Promise<{ first_used_at: string | null, upload_count: number, max_uploads_per_month: number | null, usage_count_this_month: number, usage_period_start: string | null } | null>}
 */
export async function getUserStats(email) {
  if (!client || !email) return null
  try {
    const { data, error } = await client
      .from('user_stats')
      .select('first_used_at, upload_count, max_uploads_per_month, usage_count_this_month, usage_period_start')
      .eq('email', email)
      .maybeSingle()
    if (error || !data) return null
    return {
      first_used_at: data.first_used_at || null,
      upload_count: data.upload_count ?? 0,
      max_uploads_per_month: data.max_uploads_per_month ?? null,
      usage_count_this_month: data.usage_count_this_month ?? 0,
      usage_period_start: data.usage_period_start || null,
    }
  } catch (err) {
    console.error('[supabase] getUserStats:', err.message)
    return null
  }
}

/**
 * Check if user can process more files this month (within max_uploads_per_month if set).
 * @param {string} email
 * @param {number} [additionalCount=1] - files they want to process in this request
 * @returns {Promise<{ allowed: boolean, reason?: string }>}
 */
export async function checkMonthlyLimit(email, additionalCount = 1) {
  const stats = await getUserStats(email)
  if (!stats) return { allowed: true }
  const max = stats.max_uploads_per_month
  if (max == null) return { allowed: true }
  const periodStart = stats.usage_period_start || startOfCurrentMonth()
  const nowStart = startOfCurrentMonth()
  const countThisMonth = periodStart === nowStart ? stats.usage_count_this_month : 0
  if (countThisMonth + additionalCount > max) {
    return {
      allowed: false,
      reason: 'Monthly file limit reached. Subscribe or wait until next month to continue.',
    }
  }
  return { allowed: true }
}

/**
 * Upsert user_stats: set first_used_at on first use, increment upload_count and usage_count_this_month.
 * @param {string} email
 * @param {number} additionalCount
 */
export async function upsertUserStats(email, additionalCount = 1) {
  if (!client) return
  try {
    const now = new Date().toISOString()
    const periodStart = startOfCurrentMonth()
    const { data: existing } = await client
      .from('user_stats')
      .select('upload_count, first_used_at, usage_count_this_month, usage_period_start')
      .eq('email', email)
      .maybeSingle()

    const isNew = !existing
    const newUploadCount = (existing?.upload_count ?? 0) + additionalCount
    let usageCountThisMonth = existing?.usage_count_this_month ?? 0
    let usagePeriodStart = existing?.usage_period_start || periodStart
    if (usagePeriodStart !== periodStart) {
      usageCountThisMonth = 0
      usagePeriodStart = periodStart
    }
    usageCountThisMonth += additionalCount

    await client.from('user_stats').upsert(
      {
        email,
        upload_count: newUploadCount,
        last_uploaded_at: now,
        updated_at: now,
        ...(isNew ? { first_used_at: now } : {}),
        usage_count_this_month: usageCountThisMonth,
        usage_period_start: usagePeriodStart,
      },
      { onConflict: 'email' }
    )
  } catch (err) {
    console.error('[supabase] upsertUserStats:', err.message)
  }
}

/**
 * Upload a file buffer to Storage and record in uploads table.
 * @param {string} email
 * @param {string} fileName
 * @param {Buffer} buffer
 * @param {string} contentType
 */
export async function saveFileToStorage(email, fileName, buffer, contentType) {
  if (!client) return
  try {
    const date = new Date().toISOString().slice(0, 10) // yyyy-mm-dd
    const prefix = sanitizeEmailForPath(email)
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
    const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
    const storagePath = `${prefix}/${date}/${id}_${safeName}`

    const { error: uploadError } = await client.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: contentType || 'application/octet-stream',
      upsert: true,
    })
    if (uploadError) {
      console.error('[supabase] storage upload:', uploadError.message)
      return
    }

    await client.from('uploads').insert({
      email,
      file_name: fileName,
      storage_path: storagePath,
      file_size_bytes: buffer.length,
    })
  } catch (err) {
    console.error('[supabase] saveFileToStorage:', err.message)
  }
}

/**
 * Save a logo as an asset (and optionally set as default). Uses user_logo_assets table.
 * @param {string} email
 * @param {Buffer} buffer
 * @param {string} contentType
 * @param {{ setAsDefault?: boolean }} [opts]
 * @returns {Promise<string | null>} storage path or null
 */
export async function saveLogoAsset(email, buffer, contentType, opts = {}) {
  if (!client) throw new Error('Storage not configured')
  const setAsDefault = !!opts.setAsDefault
  try {
    const prefix = sanitizeEmailForPath(email)
    const ext = (contentType || '').toLowerCase().includes('png') ? 'png' : 'jpg'
    const id = crypto.randomUUID()
    const storagePath = `${DEFAULT_LOGOS_PREFIX}/${prefix}/assets/${id}.${ext}`
    const { error: uploadError } = await client.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: contentType || 'image/png',
      upsert: false,
    })
    if (uploadError) {
      console.error('[supabase] saveLogoAsset upload:', uploadError.message)
      const msg = uploadError.message || 'Storage upload failed'
      throw new Error(msg.includes('Bucket') ? 'Storage bucket missing or not configured. Check Supabase Storage.' : `Logo upload failed: ${msg}`)
    }
    // Insert with is_default: false so we never violate the unique constraint (one default per email).
    // If this should be the default, setDefaultLogo() will clear the previous default and set this one.
    const { error: insertError } = await client.from('user_logo_assets').insert({
      email: email.toLowerCase().trim(),
      storage_path: storagePath,
      is_default: false,
    })
    if (insertError) {
      console.error('[supabase] saveLogoAsset insert:', insertError.message)
      throw new Error(insertError.message?.includes('relation') ? 'Logo database table missing. Run docs/supabase-schema.sql in Supabase.' : `Could not register logo: ${insertError.message || 'database error'}`)
    }
    if (setAsDefault) {
      await setDefaultLogo(email, storagePath)
    }
    return storagePath
  } catch (err) {
    if (err instanceof Error) console.error('[supabase] saveLogoAsset:', err.message)
    throw err
  }
}

/**
 * List logo assets for an email (newest first). Includes legacy default (user_defaults.logo_storage_path) if not in assets table.
 * @param {string} email
 * @returns {Promise<{ id: string, storage_path: string, created_at: string | null, is_default: boolean }[]>}
 */
export async function listLogoAssets(email) {
  if (!client || !email) return []
  try {
    const normalized = email.toLowerCase().trim()
    const { data, error } = await client
      .from('user_logo_assets')
      .select('id, storage_path, created_at, is_default')
      .eq('email', normalized)
      .order('created_at', { ascending: false })
    if (error) {
      console.error('[supabase] listLogoAssets:', error.message)
      return []
    }
    const list = (data || []).map((row) => ({
      id: row.id,
      storage_path: row.storage_path,
      created_at: row.created_at,
      is_default: !!row.is_default,
    }))
    const defaults = await getUserDefaults(normalized)
    if (defaults?.logo_storage_path && !list.some((a) => a.storage_path === defaults.logo_storage_path)) {
      list.unshift({
        id: 'legacy',
        storage_path: defaults.logo_storage_path,
        created_at: null,
        is_default: true,
      })
    }
    return list
  } catch (err) {
    console.error('[supabase] listLogoAssets:', err.message)
    return []
  }
}

/**
 * Set a logo asset as the default for this email (updates user_defaults and user_logo_assets).
 * @param {string} email
 * @param {string} storagePath - must be an asset path for this email
 */
export async function setDefaultLogo(email, storagePath) {
  if (!client || !email || !storagePath) return
  try {
    const normalized = email.toLowerCase().trim()
    const { error: updateAssets } = await client
      .from('user_logo_assets')
      .update({ is_default: false })
      .eq('email', normalized)
    if (updateAssets) console.error('[supabase] setDefaultLogo clear:', updateAssets.message)
    const { error: setOne } = await client
      .from('user_logo_assets')
      .update({ is_default: true })
      .eq('email', normalized)
      .eq('storage_path', storagePath)
    if (setOne) console.error('[supabase] setDefaultLogo set:', setOne.message)
    const current = await getUserDefaults(normalized)
    await upsertUserDefaults(normalized, {
      mode: current?.mode || 'logo',
      text: current?.text ?? '',
      template: current?.template || 'diagonal-center',
      scope: current?.scope || 'all-pages',
      logo_storage_path: storagePath,
    })
  } catch (err) {
    console.error('[supabase] setDefaultLogo:', err.message)
  }
}

/**
 * Upload default logo to Storage and register as asset with setAsDefault.
 * Kept for backward compatibility; now uses saveLogoAsset.
 * @param {string} email
 * @param {Buffer} buffer
 * @param {string} contentType
 * @returns {Promise<string | null>} storage path or null
 */
export async function saveDefaultLogo(email, buffer, contentType) {
  return saveLogoAsset(email, buffer, contentType, { setAsDefault: true })
}

/**
 * Get a signed URL for a default logo (1h expiry).
 * @param {string} storagePath
 * @returns {Promise<string | null>}
 */
export async function getDefaultLogoSignedUrl(storagePath) {
  if (!client || !storagePath) return null
  try {
    const { data, error } = await client.storage.from(BUCKET).createSignedUrl(storagePath, 3600)
    if (error || !data?.signedUrl) return null
    return data.signedUrl
  } catch (err) {
    console.error('[supabase] getDefaultLogoSignedUrl:', err.message)
    return null
  }
}

/**
 * Download default logo from Storage (for same-origin serving; avoids CORS).
 * @param {string} storagePath
 * @returns {Promise<{ buffer: Buffer, contentType: string } | null>}
 */
export async function getDefaultLogoBuffer(storagePath) {
  if (!client || !storagePath) return null
  try {
    const { data, error } = await client.storage.from(BUCKET).download(storagePath)
    if (error || !data) return null
    const buffer = Buffer.from(await data.arrayBuffer())
    const contentType = storagePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg'
    return { buffer, contentType }
  } catch (err) {
    console.error('[supabase] getDefaultLogoBuffer:', err.message)
    return null
  }
}

/**
 * Get saved watermark defaults for an email (for email-in flow and API).
 * @param {string} email
 * @returns {Promise<{ mode: string, text: string, template: string, scope: string, logo_storage_path?: string } | null>}
 */
export async function getUserDefaults(email) {
  if (!client) return null
  try {
    const supabaseHost = url ? new URL(url).hostname : 'none'
    const { data, error } = await client.from('user_defaults').select('mode, text_value, template, scope, logo_storage_path, updated_at').ilike('email', email).maybeSingle()
    if (error) {
      console.error('[supabase] getUserDefaults error:', error.message, 'code:', error.code)
      return null
    }
    if (!data) {
      console.log('[supabase] getUserDefaults no row for email=', email, 'host=', supabaseHost)
      return null
    }
    return {
      mode: data.mode || 'text',
      text: data.text_value || '',
      template: data.template || 'diagonal-center',
      scope: data.scope || 'all-pages',
      logo_storage_path: data.logo_storage_path || undefined,
      updated_at: data.updated_at || undefined,
    }
  } catch (err) {
    console.error('[supabase] getUserDefaults:', err.message)
    return null
  }
}

/**
 * Upsert user_defaults for an email.
 * @param {string} email
 * @param {{ mode: string, text?: string, template: string, scope: string, logo_storage_path?: string }} defaults
 */
export async function upsertUserDefaults(email, defaults) {
  if (!client) return
  try {
    const now = new Date().toISOString()
    const row = {
      email,
      mode: defaults.mode === 'logo' ? 'logo' : 'text',
      text_value: defaults.text ?? '',
      template: defaults.template || 'diagonal-center',
      scope: defaults.scope || 'all-pages',
      updated_at: now,
    }
    if (defaults.logo_storage_path !== undefined) row.logo_storage_path = defaults.logo_storage_path || null
    await client.from('user_defaults').upsert(row, { onConflict: 'email' })
  } catch (err) {
    console.error('[supabase] upsertUserDefaults:', err.message)
  }
}

export function isSupabaseConfigured() {
  return !!client
}
