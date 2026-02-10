/**
 * Persistent store for magic-link auth and user stats.
 * Uses JSON file so data survives server restarts. Path: server/data/auth-store.json
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const STORE_PATH = path.join(__dirname, 'data', 'auth-store.json')

const DEFAULT_STORE = {
  magicLinkTokens: {}, // token -> { email, expiresAt, usedAt }
  pendingDeliveries: {}, // email -> { items: [{ token, name }], createdAt }
  userStats: {}, // email -> { upload_count, failed_count, fail_reasons: [], success_download_count, last_activity_at }
}

function load() {
  try {
    const dir = path.dirname(STORE_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    if (!fs.existsSync(STORE_PATH)) return { ...DEFAULT_STORE }
    const raw = fs.readFileSync(STORE_PATH, 'utf8')
    const data = JSON.parse(raw)
    return {
      magicLinkTokens: data.magicLinkTokens ?? {},
      pendingDeliveries: data.pendingDeliveries ?? {},
      userStats: data.userStats ?? {},
    }
  } catch {
    return { ...DEFAULT_STORE }
  }
}

function save(store) {
  try {
    const dir = path.dirname(STORE_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2), 'utf8')
  } catch (err) {
    console.error('[store] save failed:', err.message)
  }
}

let memory = load()

export function getStore() {
  return memory
}

export function persist() {
  save(memory)
}

export function getMagicToken(token) {
  return memory.magicLinkTokens[token] ?? null
}

export function setMagicToken(token, { email, expiresAt }) {
  memory.magicLinkTokens[token] = { email, expiresAt, usedAt: null }
  persist()
}

export function useMagicToken(token) {
  const t = memory.magicLinkTokens[token]
  if (!t) return null
  t.usedAt = Date.now()
  persist()
  return t
}

export function setPendingDelivery(email, items) {
  memory.pendingDeliveries[email] = { items, createdAt: Date.now() }
  persist()
}

export function getPendingDelivery(email) {
  return memory.pendingDeliveries[email] ?? null
}

export function clearPendingDelivery(email) {
  delete memory.pendingDeliveries[email]
  persist()
}

function ensureUserStats(email) {
  if (!memory.userStats[email]) {
    memory.userStats[email] = {
      upload_count: 0,
      failed_count: 0,
      fail_reasons: [],
      success_download_count: 0,
      last_activity_at: null,
    }
  }
  return memory.userStats[email]
}

export function recordUploadBatch(email, { successCount, errorCount, failReasons = [] }) {
  const s = ensureUserStats(email)
  s.upload_count += successCount + errorCount
  s.failed_count += errorCount
  s.fail_reasons.push(...failReasons)
  s.last_activity_at = Date.now()
  persist()
}

export function recordSuccessDownloads(email, count) {
  const s = ensureUserStats(email)
  s.success_download_count += count
  s.last_activity_at = Date.now()
  persist()
}

export function getUserStats(email) {
  return memory.userStats[email] ?? null
}

// Clean expired magic tokens periodically
export function cleanupExpiredTokens() {
  const now = Date.now()
  const maxAge = 24 * 60 * 60 * 1000 // 24h
  let changed = false
  for (const [token, data] of Object.entries(memory.magicLinkTokens)) {
    if (data.usedAt || (data.expiresAt && now > data.expiresAt + maxAge)) {
      delete memory.magicLinkTokens[token]
      changed = true
    }
  }
  if (changed) persist()
}
