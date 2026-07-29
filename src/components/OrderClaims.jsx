/**
 * OrderClaims.jsx — Replacement requests (claims) for one order
 * (William 2026-07-29: "record the results and open with a link in the
 * orders app").
 *
 * Shows the order's filed claims (GET /claims?order_id= [admin]) with
 * status controls, and an "Open claim form" button that fetches the
 * tokenized per-order form link (GET /orders/{id}/claims-link) — the same
 * link the delivered email carries, so William can file or walk a customer
 * through it.
 */

import { useState, useEffect } from 'react'
import { API_URL } from '../config'
import { apiFetch } from '../api'

/** Authenticated image: fetches photo bytes with admin headers, renders a
 *  thumbnail that opens full-size in a new tab. */
const AuthImg = ({ src }) => {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    let objUrl = null
    apiFetch(src)
      .then((r) => (r.ok ? r.blob() : null))
      .then((b) => { if (b) { objUrl = URL.createObjectURL(b); setUrl(objUrl) } })
      .catch(() => {})
    return () => { if (objUrl) URL.revokeObjectURL(objUrl) }
  }, [src])
  if (!url) return <div style={{ width: 74, height: 74, background: '#f1f5f9', borderRadius: 6 }} />
  return (
    <a href={url} target="_blank" rel="noreferrer">
      <img src={url} alt="" style={{ width: 74, height: 74, objectFit: 'cover', borderRadius: 6, border: '1px solid #e2e8f0' }} />
    </a>
  )
}

const ISSUE_LABELS = {
  freight_damage_bol: 'Freight damage (BOL noted)',
  freight_damage_nobol: 'Freight damage (NOT on BOL)',
  defect: 'Manufacturing defect',
  missing: 'Missing item',
  wrong_item: 'Wrong item',
}

const STATUS_COLORS = {
  new: '#d97706',
  reviewing: '#2563eb',
  approved: '#059669',
  denied: '#dc2626',
  resolved: '#6b7280',
}

const STATUSES = ['new', 'reviewing', 'approved', 'denied', 'resolved']

const OrderClaims = ({ orderId }) => {
  const [claims, setClaims] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)
  const [deliveryPhotos, setDeliveryPhotos] = useState([])
  const [openPhotos, setOpenPhotos] = useState({})   // claim id -> photo meta list

  const load = () => {
    apiFetch(`${API_URL}/claims?order_id=${orderId}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((data) => setClaims(data.claims || []))
      .catch((e) => setError(e.message))
    apiFetch(`${API_URL}/delivery-photos/${orderId}/list`)
      .then((r) => (r.ok ? r.json() : { photos: [] }))
      .then((data) => setDeliveryPhotos(data.photos || []))
      .catch(() => {})
  }

  useEffect(() => {
    setClaims(null)
    setError(null)
    setDeliveryPhotos([])
    setOpenPhotos({})
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId])

  const togglePhotos = (claimId) => {
    if (openPhotos[claimId]) {
      setOpenPhotos((p) => ({ ...p, [claimId]: null }))
      return
    }
    apiFetch(`${API_URL}/claims/${claimId}/detail`)
      .then((r) => r.json())
      .then((data) => setOpenPhotos((p) => ({ ...p, [claimId]: (data.claim || {}).photos || [] })))
      .catch(() => {})
  }

  const openForm = () => {
    setBusy(true)
    apiFetch(`${API_URL}/orders/${orderId}/claims-link`)
      .then((r) => r.json())
      .then((data) => { if (data.url) window.open(data.url, '_blank') })
      .finally(() => setBusy(false))
  }

  const setStatus = (reqId, status) => {
    apiFetch(`${API_URL}/claims/${reqId}/status?status=${status}`, { method: 'PATCH' })
      .then(() => load())
  }

  return (
    <div className="detail-section">
      <h4>🧾 Replacement requests</h4>
      <button
        onClick={openForm}
        disabled={busy}
        style={{
          background: '#1D4ED8', color: '#fff', border: 'none',
          borderRadius: '6px', padding: '8px 16px', fontSize: '13px',
          fontWeight: 600, cursor: 'pointer', marginBottom: '12px',
        }}
      >
        {busy ? 'Opening…' : 'Open claim form ↗'}
      </button>
      {error && (
        <div style={{ color: '#d32f2f', padding: '10px 0', fontSize: '13px' }}>
          Claims failed to load: {error}
        </div>
      )}
      {!error && claims === null && (
        <div style={{ color: '#666', padding: '10px 0', fontSize: '13px' }}>Loading…</div>
      )}
      {claims && claims.length === 0 && (
        <div style={{ color: '#666', padding: '10px 0', fontSize: '13px' }}>
          No replacement requests filed for this order.
        </div>
      )}
      {claims && claims.map((c) => (
        <div
          key={c.id}
          style={{
            border: '1px solid #e2e8f0', borderRadius: '8px',
            padding: '10px 12px', marginBottom: '10px', fontSize: '13px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>
              #{c.id} — {c.contact_name || 'no name'}
              <span style={{ color: '#888', fontWeight: 400 }}> · {String(c.created_at).slice(0, 16)}</span>
            </div>
            <select
              value={c.status}
              onChange={(e) => setStatus(c.id, e.target.value)}
              style={{
                color: STATUS_COLORS[c.status] || '#333', fontWeight: 700,
                border: '1px solid #cbd5e0', borderRadius: '5px',
                padding: '3px 6px', fontSize: '12px',
              }}
            >
              {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div style={{ color: '#555', marginTop: '4px' }}>
            BOL noted: <strong>{c.bol_noted || '?'}</strong> ·{' '}
            <button
              onClick={() => togglePhotos(c.id)}
              style={{ background: 'none', border: 'none', color: '#1D4ED8', cursor: 'pointer', fontWeight: 600, padding: 0 }}
            >
              {openPhotos[c.id] ? 'hide' : 'show'} photos ({c.photo_count})
            </button>
          </div>
          {(c.lines || []).map((l, i) => (
            <div key={i} style={{ marginTop: '3px', color: '#333' }}>
              <strong>{l.sku}</strong> ×{l.qty} — {ISSUE_LABELS[l.issue] || l.issue}
              {l.note ? <span style={{ color: '#777' }}> ({l.note})</span> : null}
            </div>
          ))}
          {openPhotos[c.id] && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {openPhotos[c.id].length === 0 && (
                <span style={{ color: '#888', fontSize: '12px' }}>No photos on this claim.</span>
              )}
              {openPhotos[c.id].map((p) => (
                <AuthImg key={p.id} src={`${API_URL}/claims/photo/${p.id}`} />
              ))}
            </div>
          )}
        </div>
      ))}
      <h4 style={{ marginTop: '18px' }}>📷 At-delivery photos ({deliveryPhotos.length})</h4>
      {deliveryPhotos.length === 0 && (
        <div style={{ color: '#666', fontSize: '13px' }}>
          None uploaded — the customer gets the phone upload link in every delivery email.
        </div>
      )}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        {deliveryPhotos.map((p) => (
          <AuthImg key={p.id} src={`${API_URL}/delivery-photos/photo/${p.id}`} />
        ))}
      </div>
    </div>
  )
}

export default OrderClaims
