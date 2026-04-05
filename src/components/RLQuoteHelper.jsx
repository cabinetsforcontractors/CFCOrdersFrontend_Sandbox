/**
 * RLQuoteHelper.jsx
 * Complete RL Carriers quote and BOL helper
 * v5.9.2 - Liftgate toggle for commercial addresses; auto-quote uses R+L NET charge directly
 *
 * Auto-quote flow: validate address (Smarty) → R+L freight quote (NET = all-in price)
 * Manual flow: Open RL website, enter quote details manually (still works)
 *
 * liftgate prop: passed from parent when address is commercial and liftgate is needed
 */

import { useState } from 'react'
import { CustomerAddress, BillToAddress, CopyButton } from './CustomerAddress'
import { API_URL } from '../config'
import { apiFetch } from '../api'

const RLQuoteHelper = ({ shipmentId, data, onClose, onSave, onOpenRL, liftgate = false }) => {
  const [quoteNumber, setQuoteNumber] = useState(data.existing_quote?.quote_number || '')
  const [quotePrice, setQuotePrice] = useState(data.existing_quote?.quote_price || '')
  const [quoteUrl, setQuoteUrl] = useState(data.existing_quote?.quote_url || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(!!data.existing_quote?.quote_url)

  const [autoQuoting, setAutoQuoting] = useState(false)
  const [autoQuoteResult, setAutoQuoteResult] = useState(null)
  const [autoQuoteError, setAutoQuoteError] = useState(null)

  const customerPrice = quotePrice ? (parseFloat(quotePrice) + 50).toFixed(2) : null

  const combinedEmails = data.destination?.email
    ? `${data.destination.email}, cabinetsforcontractors@gmail.com`
    : 'cabinetsforcontractors@gmail.com'

  const handleAutoQuote = async () => {
    setAutoQuoting(true)
    setAutoQuoteError(null)
    setAutoQuoteResult(null)

    try {
      const payload = {
        origin_zip: data.origin_zip || '',
        dest_street: data.destination?.street || '',
        dest_city: data.destination?.city || '',
        dest_state: data.destination?.state || '',
        dest_zipcode: data.destination?.zip || '',
        weight: data.weight?.value || 0,
        freight_class: '85',
        customer_markup: 50.00,
        liftgate_required: liftgate,
      }

      const res = await apiFetch(`${API_URL}/proxy/auto-quote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
        throw new Error(errData.detail || `Quote failed (${res.status})`)
      }

      const result = await res.json()
      setAutoQuoteResult(result)

      if (result.success) {
        if (result.quote_number) setQuoteNumber(result.quote_number)
        if (result.carrier_price) setQuotePrice(String(result.carrier_price))
      }
    } catch (err) {
      console.error('Auto-quote failed:', err)
      setAutoQuoteError(err.message || 'Auto-quote failed. Try the manual method below.')
    }

    setAutoQuoting(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const params = new URLSearchParams()
      if (quoteNumber) params.append('rl_quote_number', quoteNumber)
      if (quotePrice) params.append('rl_quote_price', quotePrice)
      if (customerPrice) params.append('rl_customer_price', customerPrice)
      if (quoteUrl) params.append('quote_url', quoteUrl)

      await apiFetch(`${API_URL}/shipments/${shipmentId}?${params.toString()}`, {
        method: 'PATCH'
      })

      setSaved(true)
      if (onSave) onSave()
    } catch (err) {
      console.error('Failed to save RL quote:', err)
      alert('Failed to save quote. Please try again.')
    }
    setSaving(false)
  }

  const openRLSite = () => {
    if (onOpenRL) {
      onOpenRL()
    } else {
      const w = 800; const h = window.screen.height; const left = window.screen.width - w
      window.open('https://www.rlcarriers.com/freight/shipping/rate-quote', 'ShippingQuote', `width=${w},height=${h},left=${left},top=0,resizable=yes,scrollbars=yes`)
    }
  }

  const openSavedQuote = () => {
    if (quoteUrl) {
      const w = 800, h = window.screen.height, left = window.screen.width - w
      window.open(quoteUrl, 'ShippingQuote', `width=${w},height=${h},left=${left},top=0,resizable=yes,scrollbars=yes`)
    }
  }

  const handleChangeUrl = () => { setSaved(false) }

  const isCommercial = data.is_residential === false

  return (
    <div className="rl-helper">
      {/* Section 1: Quote Info */}
      <div className="rl-section quote-info">
        <h3>Quote Information</h3>

        <div className="info-grid">
          <CopyButton label="Origin ZIP" text={data.origin_zip} />
          <CopyButton label="Dest ZIP" text={data.destination?.zip} />

          <div className="copy-row">
            <span className="copy-label">Weight:</span>
            {data.weight?.value ? (
              <>
                <span className="copy-value"><strong>{data.weight.value} lbs</strong></span>
                <button className="copy-btn" onClick={() => navigator.clipboard.writeText(String(data.weight.value))}>📋</button>
                <span className="note">({data.weight.note})</span>
              </>
            ) : (
              <span className="warning">⚠️ {data.weight?.note || 'Enter weight manually'}</span>
            )}
          </div>

          <div className="copy-row">
            <span className="copy-label">Class:</span>
            <span className="copy-value"><strong>85</strong> (always)</span>
          </div>

          <CopyButton label="Commodity" text="RTA Cabinetry" />
        </div>

        {/* Commercial liftgate notice */}
        {isCommercial && (
          <div style={{
            background: '#EFF6FF',
            border: '1px solid #BFDBFE',
            borderRadius: '6px',
            padding: '8px 12px',
            marginTop: '10px',
            fontSize: '13px',
            color: '#1E40AF'
          }}>
            🏢 <strong>Commercial address.</strong> {liftgate
              ? 'Liftgate requested — included in quote.'
              : 'No liftgate — assumes customer has a dock or forklift.'}
          </div>
        )}

        {data.oversized?.detected && (
          <div className="oversized-warning">
            <strong>⚠️ Oversized Items - Check "Dimensions" box!</strong>
            <ul>
              {data.oversized.items.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
          <button
            className="btn btn-primary"
            onClick={handleAutoQuote}
            disabled={autoQuoting || !data.weight?.value}
            style={{
              backgroundColor: autoQuoting ? '#999' : '#4caf50',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: autoQuoting ? 'wait' : 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              flex: '1',
              minWidth: '180px'
            }}
          >
            {autoQuoting ? '⏳ Getting Quote...' : '⚡ Get Auto Quote'}
          </button>

          <button
            className="btn btn-secondary"
            onClick={openRLSite}
            style={{
              backgroundColor: '#2196f3',
              color: 'white',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '6px',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px'
            }}
          >
            Manual RL →
          </button>
        </div>

        {autoQuoteError && (
          <div style={{
            marginTop: '10px', padding: '10px 14px',
            backgroundColor: '#fff3cd', border: '1px solid #ffc107',
            borderRadius: '6px', color: '#856404', fontSize: '13px'
          }}>
            ⚠️ {autoQuoteError}
          </div>
        )}

        {autoQuoteResult?.success && (
          <div style={{
            marginTop: '10px', padding: '12px 14px',
            backgroundColor: '#d4edda', border: '1px solid #28a745',
            borderRadius: '6px', fontSize: '13px', color: '#111'
          }}>
            <strong style={{ color: '#111' }}>✅ Auto Quote Complete</strong>
            <div style={{ marginTop: '6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
              <span>Carrier Price (R+L NET):</span>
              <strong>${autoQuoteResult.carrier_price}</strong>
              <span>Customer Price (+$50):</span>
              <strong style={{ color: '#155724' }}>${autoQuoteResult.customer_price}</strong>
              {autoQuoteResult.service_days && (
                <>
                  <span>Transit Days:</span>
                  <strong>{autoQuoteResult.service_days}</strong>
                </>
              )}
              {autoQuoteResult.quote_number && (
                <>
                  <span>Quote #:</span>
                  <strong>{autoQuoteResult.quote_number}</strong>
                </>
              )}
              <span>Residential:</span>
              <span>{autoQuoteResult.is_residential ? 'Yes' : 'No (Commercial)'}</span>
              {autoQuoteResult.liftgate_required && (
                <>
                  <span>Liftgate:</span>
                  <span>Requested</span>
                </>
              )}
            </div>

            {autoQuoteResult.validated_address?.address && (
              <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #c3e6cb' }}>
                <strong>Validated Address:</strong>
                <div style={{ fontSize: '12px', marginTop: '4px', color: '#155724' }}>
                  {autoQuoteResult.validated_address.address?.delivery_line_1 || autoQuoteResult.validated_address.address?.street || ''}
                  {autoQuoteResult.validated_address.address?.city && `, ${autoQuoteResult.validated_address.address.city}`}
                  {autoQuoteResult.validated_address.address?.state && ` ${autoQuoteResult.validated_address.address.state}`}
                  {' '}
                  {autoQuoteResult.validated_address.address?.zipcode || autoQuoteResult.validated_address.address?.zip || ''}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Section 2: Enter Quote Results */}
      <div className="rl-section quote-entry">
        <h3>Quote Details {autoQuoteResult?.success && <span style={{ fontSize: '12px', color: '#4caf50', fontWeight: 'normal' }}>(auto-filled)</span>}</h3>

        <div className="input-grid">
          <div className="input-group">
            <label>Quote Number:</label>
            <input type="text" value={quoteNumber} onChange={(e) => setQuoteNumber(e.target.value)} placeholder="e.g., 62310338" />
          </div>
          <div className="input-group">
            <label>Quote Price ($):</label>
            <input type="number" step="0.01" value={quotePrice} onChange={(e) => setQuotePrice(e.target.value)} placeholder="e.g., 179.38" />
          </div>
          <div className="input-group">
            <label>Customer Price (+$50):</label>
            <input type="text" readOnly value={customerPrice ? `$${customerPrice}` : 'Auto-calculated'} className="calculated" />
          </div>
        </div>

        <div className="input-group full-width">
          <label>Quote URL (from Recent Activity):</label>
          <div className="url-input-row">
            <input
              type="text"
              value={quoteUrl}
              onChange={(e) => setQuoteUrl(e.target.value)}
              placeholder="https://www.rlcarriers.com/freight/shipping/rate-quote?id=..."
              disabled={saved}
            />
          </div>
        </div>

        <div className="button-row">
          {saved ? (
            <>
              <button className="btn btn-success" onClick={openSavedQuote}>Open Quote</button>
              <button className="btn btn-secondary" onClick={handleChangeUrl}>Change URL</button>
            </>
          ) : (
            <button className="btn btn-success" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save Quote'}
            </button>
          )}
        </div>
      </div>

      {/* Section 3: BOL Helper */}
      <div className="rl-section bol-helper">
        <h3>BOL Helper - Copy for RL Form</h3>
        <div className="address-section">
          <h4>Ship To (Customer)</h4>
          <CopyButton label="Company/Name" text={data.destination?.name} />
          <CopyButton label="Street" text={data.destination?.street} />
          <CopyButton label="City" text={data.destination?.city} />
          <CopyButton label="State" text={data.destination?.state} />
          <CopyButton label="ZIP" text={data.destination?.zip} />
          <CopyButton label="Phone" text={data.destination?.phone} />
          <CopyButton label="Email" text={data.destination?.email} />
        </div>
        <BillToAddress />
        <div className="address-section">
          <h4>Email Notifications</h4>
          <CopyButton label="Both Emails" text={combinedEmails} />
        </div>
      </div>
    </div>
  )
}

export default RLQuoteHelper
