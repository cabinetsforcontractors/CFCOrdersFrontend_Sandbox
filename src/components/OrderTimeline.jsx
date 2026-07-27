/**
 * OrderTimeline.jsx — Beat 5 (2026-07-27)
 * One order's whole story on one screen: DB events + every ledgered email
 * that mentions the order, merged chronologically by the backend
 * (GET /orders/{id}/timeline — b2bwave_sync ticks pre-filtered server-side).
 * Rendered inline as a detail-panel tab.
 */

import { useState, useEffect } from 'react'
import { API_URL } from '../config'
import { apiFetch } from '../api'

const KIND_ICONS = {
  'email-inbox': '📥',   // mail that came to us
  'email-sent': '📤',    // mail we sent
}

const EVENT_ICONS = {
  payment_received: '💰',
  tracking_stamped: '🚚',
  tracking_captured: '🚚',
  manual_tracking_stamped: '🚚',
  storefront_ping: '🔔',
  supplier_dispatch: '🏭',
  email_sent: '✉️',
  email_send_failed: '⚠️',
  status_change: '🏷️',
  b2bwave_status_set: '🏷️',
  b2bwave_status_skipped: '🏷️',
  daylight_probill_registered: '🚛',
  daylight_picked_up: '🚛',
  bol_created: '📋',
}

const iconFor = (entry) =>
  KIND_ICONS[entry.kind] || EVENT_ICONS[entry.title] || '⚙️'

const fmtWhen = (iso) => {
  if (!iso) return '?'
  const d = new Date(iso)
  if (isNaN(d)) return iso.slice(0, 16)
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

const OrderTimeline = ({ orderId }) => {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    setEntries(null)
    setError(null)
    apiFetch(`${API_URL}/orders/${orderId}/timeline`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => { if (alive) setEntries(data.timeline || []) })
      .catch((e) => { if (alive) setError(e.message) })
    return () => { alive = false }
  }, [orderId])

  return (
    <div className="detail-section">
      <h4>🕒 Timeline — the whole story, oldest first</h4>
      {error && (
        <div style={{ color: '#d32f2f', padding: '10px 0', fontSize: '13px' }}>
          Timeline failed to load: {error}
        </div>
      )}
      {!error && entries === null && (
        <div style={{ color: '#666', padding: '10px 0', fontSize: '13px' }}>Loading…</div>
      )}
      {entries && entries.length === 0 && (
        <div style={{ color: '#666', padding: '10px 0', fontSize: '13px' }}>
          No events or emails recorded for this order yet.
        </div>
      )}
      {entries && entries.map((e, i) => (
        <div
          key={i}
          style={{
            display: 'flex', gap: '10px', padding: '7px 0',
            borderBottom: '1px solid #f0f0f0', alignItems: 'flex-start',
          }}
        >
          <div style={{ fontSize: '15px', lineHeight: '20px' }}>{iconFor(e)}</div>
          <div style={{
            minWidth: '88px', color: '#888', fontSize: '11px',
            lineHeight: '20px', flexShrink: 0,
          }}>
            {fmtWhen(e.at)}
          </div>
          <div style={{ fontSize: '13px', minWidth: 0 }}>
            <div style={{ fontWeight: 600, wordBreak: 'break-word' }}>{e.title}</div>
            {e.detail && (
              <div style={{ color: '#777', fontSize: '12px', marginTop: '2px', wordBreak: 'break-word' }}>
                {e.detail}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default OrderTimeline
