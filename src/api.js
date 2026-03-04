/**
 * api.js — CFC Orders central fetch helper
 * v1.0.0 - Phase 5C: inject X-Admin-Token on every request
 *
 * All write endpoints (PATCH, DELETE, POST) now require X-Admin-Token
 * via Depends(require_admin) on the backend (Phase 5 hardening).
 * We inject it on ALL requests for simplicity — harmless on GETs.
 *
 * Token rotation (JWT, Option C) will update ADMIN_TOKEN here only.
 */

const ADMIN_TOKEN = 'CFC2025'

/**
 * apiFetch(url, options)
 * Drop-in replacement for fetch() that always includes X-Admin-Token.
 *
 * Usage:
 *   const res = await apiFetch(`${API_URL}/orders/123`, {
 *     method: 'PATCH',
 *     headers: { 'Content-Type': 'application/json' },
 *     body: JSON.stringify({ current_status: 'complete' })
 *   })
 *
 * The X-Admin-Token header is merged with any caller-supplied headers.
 * Caller headers take precedence for everything EXCEPT X-Admin-Token.
 */
export async function apiFetch(url, options = {}) {
  const headers = {
    ...options.headers,
    'X-Admin-Token': ADMIN_TOKEN,
  }
  return fetch(url, { ...options, headers })
}
