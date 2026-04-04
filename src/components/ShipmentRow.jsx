/**
 * ShipmentRow.jsx
 * Display a single warehouse shipment with status, method, and actions
 * v5.9.4 - apiFetch throughout, Shippo added to METHOD_OPTIONS
 */

import { useState } from 'react'
import { API_URL } from '../config'
import { apiFetch } from '../api'

const STATUS_OPTIONS = [
  { value: 'needs_order',  label: 'Pending' },
  { value: 'at_warehouse', label: 'At Warehouse' },
  { value: 'needs_bol',    label: 'Needs BOL' },
  { value: 'ready_ship',   label: 'Ready Ship' },
  { value: 'shipped',      label: 'Shipped' },
  { value: 'delivered',    label: 'Delivered' },
]

const METHOD_OPTIONS = [
  { value: '',           label: 'Select...' },
  { value: 'LTL',        label: 'LTL' },
  { value: 'Shippo',     label: 'Shippo (UPS/USPS)' },
  { value: 'Pirateship', label: 'Pirateship' },
  { value: 'Pickup',     label: 'Pickup' },
  { value: 'BoxTruck',   label: 'BoxTruck' },
  { value: 'LiDelivery', label: 'Li Delivery' },
]

const ShipmentRow = ({ shipment, order, onOpenShippingManager, onUpdate }) => {
  const [updating, setUpdating] = useState(false)
  const [showTrackingInput, setShowTrackingInput] = useState(false)
  const [trackingNumber, setTrackingNumber] = useState(shipment.tracking_number || '')
  const [sendStatus, setSendStatus] = useState(null) // 'sending' | 'success' | 'error'

  const handleStatusChange = async (e) => {
    const newStatus = e.target.value
    setUpdating(true)
    try {
      await apiFetch(`${API_URL}/shipments/${shipment.shipment_id}?status=${newStatus}`, { method: 'PATCH' })
      if (onUpdate) onUpdate()
    } catch (err) { console.error('Failed to update status:', err) }
    setUpdating(false)
  }

  const handleMethodChange = async (e) => {
    const newMethod = e.target.value
    setUpdating(true)
    try {
      await apiFetch(`${API_URL}/shipments/${shipment.shipment_id}?ship_method=${newMethod}`, { method: 'PATCH' })
      if (onUpdate) onUpdate()
      if (newMethod && newMethod !== 'Pickup') {
        onOpenShippingManager(shipment, order)
      }
    } catch (err) { console.error('Failed to update method:', err) }
    setUpdating(false)
  }

  const handleSaveAndSendTracking = async () => {
    if (!trackingNumber.trim()) return
    const orderId = order?.order_id || shipment.order_id
    setUpdating(true)
    setSendStatus('sending')
    try {
      const url = `${API_URL}/orders/${orderId}/send-tracking?tracking_number=${encodeURIComponent(trackingNumber)}&shipment_id=${shipment.shipment_id}`
      const response = await apiFetch(url, { method: 'POST' })
      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(errorText || 'Failed to send tracking')
      }
      setSendStatus('success')
      await apiFetch(`${API_URL}/shipments/${shipment.shipment_id}?status=shipped`, { method: 'PATCH' })
      if (onUpdate) onUpdate()
      setTimeout(() => { setShowTrackingInput(false); setSendStatus(null) }, 2000)
    } catch (err) {
      console.error('Failed to send tracking:', err)
      setSendStatus('error')
      alert('Failed to send tracking: ' + err.message)
    }
    setUpdating(false)
  }

  const handleSaveOnly = async () => {
    if (!trackingNumber.trim()) return
    setUpdating(true)
    try {
      await apiFetch(`${API_URL}/shipments/${shipment.shipment_id}?tracking_number=${encodeURIComponent(trackingNumber)}`, { method: 'PATCH' })
      await apiFetch(`${API_URL}/shipments/${shipment.shipment_id}?status=shipped`, { method: 'PATCH' })
      if (onUpdate) onUpdate()
      setShowTrackingInput(false)
    } catch (err) {
      console.error('Failed to save tracking:', err)
      alert('Failed to save tracking')
    }
    setUpdating(false)
  }

  const getShippingCost = () => {
    const cost =
      Number(shipment.rl_customer_price) ||
      Number(shipment.li_customer_price) ||
      Number(shipment.ps_quote_price) ||
      Number(shipment.customer_price) ||
      0
    return cost > 0 ? `$${cost.toFixed(2)}` : ''
  }

  const shippingCost = getShippingCost()
  const hasQuoteInfo = shipment.rl_quote_number || shipment.rl_quote_price || shipment.li_quote_price || shipment.quote_price || shipment.rl_customer_price || shipment.li_customer_price
  const showTrackButton = shipment.ship_method !== 'Pickup' && shipment.ship_method !== 'LiDelivery'

  return (
    <div className={`shipment-row${updating ? ' updating' : ''}`}>
      <div className="shipment-warehouse">
        <strong>{shipment.warehouse}</strong>
        {shippingCost && <span style={{ color: 'var(--success)', marginLeft: '8px' }}>— {shippingCost}</span>}
        {shipment.weight && <span style={{ color: 'var(--text-muted)', marginLeft: '6px', fontSize: '11px' }}>({shipment.weight} lbs)</span>}
      </div>

      <div className="shipment-controls">
        <select value={shipment.status || 'needs_order'} onChange={handleStatusChange} style={{ minWidth: '110px' }}>
          {STATUS_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>

        <select value={shipment.ship_method || ''} onChange={handleMethodChange} style={{ minWidth: '130px' }}>
          {METHOD_OPTIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
        </select>

        <button
          className={`btn btn-sm${hasQuoteInfo ? ' btn-primary' : ''}`}
          onClick={() => onOpenShippingManager(shipment, order)}
          style={hasQuoteInfo ? {} : {}}
        >
          {hasQuoteInfo ? '✅ Shipping' : 'Shipping'}
        </button>

        {showTrackButton && (
          shipment.tracking_number ? (
            <button className="btn btn-sm" onClick={() => setShowTrackingInput(true)}
              style={{ background: 'rgba(37,99,235,0.10)', borderColor: 'rgba(37,99,235,0.3)', color: '#2563EB' }}
              title={shipment.tracking_number}>
              📦 {shipment.tracking_number.slice(-6)}
            </button>
          ) : (
            <button className="btn btn-sm" onClick={() => setShowTrackingInput(true)}>+ Track</button>
          )
        )}
      </div>

      {showTrackingInput && (
        <div style={{ marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="text"
            value={trackingNumber}
            onChange={(e) => setTrackingNumber(e.target.value)}
            placeholder="Enter tracking / PRO number..."
            autoFocus
            style={{ flex: 1, padding: '6px 8px', border: '1px solid var(--border)', borderRadius: '6px', fontFamily: 'inherit', fontSize: '13px', minWidth: '180px' }}
          />
          <button
            className="btn btn-sm btn-primary"
            onClick={handleSaveAndSendTracking}
            disabled={updating || sendStatus === 'sending'}
            style={{ minWidth: '110px', background: sendStatus === 'success' ? 'var(--success)' : undefined }}
          >
            {sendStatus === 'sending' ? '📧 Sending...' : sendStatus === 'success' ? '✓ Sent!' : '📧 Save & Email'}
          </button>
          <button className="btn btn-sm" onClick={handleSaveOnly} disabled={updating} style={{ color: 'var(--text-dim)' }} title="Save tracking without emailing customer">
            Save Only
          </button>
          <button className="btn btn-sm" onClick={() => { setShowTrackingInput(false); setSendStatus(null) }}>✕</button>
        </div>
      )}
    </div>
  )
}

export default ShipmentRow
