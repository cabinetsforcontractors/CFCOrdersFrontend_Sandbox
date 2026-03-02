/**
 * OrderCard.jsx
 * Display a single order with status, customer info, shipments
 * v5.12.0 - Phase 4: Email button for customer communications
 */

import { useState } from 'react'
import ShipmentRow from './ShipmentRow'
import { API_URL } from '../config'

const STATUS_MAP = {
  'needs_payment_link': { label: '1-Need Invoice', color: '#f44336' },
  'awaiting_payment': { label: '2-Awaiting Pay', color: '#ff9800' },
  'needs_warehouse_order': { label: '3-Need to Order', color: '#9c27b0' },
  'awaiting_warehouse': { label: '4-At Warehouse', color: '#2196f3' },
  'needs_bol': { label: '5-Need BOL', color: '#00bcd4' },
  'awaiting_shipment': { label: '6-Ready Ship', color: '#4caf50' },
  'complete': { label: 'Complete', color: '#9e9e9e' }
}

const STATUS_OPTIONS = [
  { value: 'needs_payment_link', label: '1-Need Invoice' },
  { value: 'awaiting_payment', label: '2-Awaiting Pay' },
  { value: 'needs_warehouse_order', label: '3-Need to Order' },
  { value: 'awaiting_warehouse', label: '4-At Warehouse' },
  { value: 'needs_bol', label: '5-Need BOL' },
  { value: 'awaiting_shipment', label: '6-Ready Ship' },
  { value: 'complete', label: 'Complete' }
]

// Shipment-level status colors for warehouse pills
const SHIPMENT_STATUS_COLORS = {
  'needs_order': { color: '#f44336', label: 'Need to Order' },      // Red
  'at_warehouse': { color: '#9c27b0', label: 'At Warehouse' },      // Purple
  'needs_bol': { color: '#00bcd4', label: 'Need BOL' },             // Cyan
  'ready_ship': { color: '#4caf50', label: 'Ready to Ship' },       // Green
  'shipped': { color: '#607d8b', label: 'Shipped' },                // Blue-gray
  'delivered': { color: '#9e9e9e', label: 'Delivered' }             // Gray
}

// Alert background colors
const ALERT_BACKGROUNDS = {
  'warning': '#FFFACD',   // Light yellow
  'critical': '#FFB6C1'   // Light pink/red
}

// Alert type labels
const ALERT_TYPE_LABELS = {
  'out_of_stock': '\u26a0\ufe0f OUT OF STOCK',
  'backorder': '\u26a0\ufe0f BACKORDER',
  'inventory_issue': '\u26a0\ufe0f INVENTORY ISSUE',
  'no_action_after_payment': '\u23f0 NO ACTION - PAID',
  'shipped_no_payment': '\ud83d\udcb0 SHIPPED - NO PAYMENT',
  'no_response': '\ud83d\udce7 NO WAREHOUSE RESPONSE',
  'not_available': '\u26a0\ufe0f NOT AVAILABLE',
  'discontinued': '\u26a0\ufe0f DISCONTINUED'
}

const getAgeLabel = (orderDate) => {
  if (!orderDate) return ''
  const created = new Date(orderDate)
  const today = new Date()
  created.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.floor((today - created) / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return 'Today'
  if (diffDays === 1) return '1 Day'
  return `${diffDays} Days`
}

const OrderCard = ({ order, onOpenDetail, onOpenShippingManager, onOpenEmail, onUpdate }) => {
  if (!order) return null
  
  const [isUpdating, setIsUpdating] = useState(false)
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notes, setNotes] = useState(order?.notes || '')
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  
  const status = STATUS_MAP[order.current_status] || STATUS_MAP['needs_payment_link']

  // Customer info
  const customerName = order.company_name || order.customer_name || 'Unknown'
  
  // Format address: City, State ZIP on one line
  const cityStateZip = [
    order.city,
    order.state ? `${order.state}${order.zip_code ? ' ' + order.zip_code : ''}` : order.zip_code
  ].filter(Boolean).join(', ')
  
  // Street address (separate line)
  const streetAddress = order.street || ''

  // Format order date
  const orderDate = order.order_date
    ? new Date(order.order_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    : ''

  // Get warehouses
  const warehouses = [
    order.warehouse_1,
    order.warehouse_2,
    order.warehouse_3,
    order.warehouse_4
  ].filter(Boolean)

  // Format order total
  const orderTotal = parseFloat(order.order_total || 0)
  const totalDisplay = orderTotal > 0
    ? `$${orderTotal.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    : ''

  // Calculate shipping totals
  const shippingTotals = (order.shipments || []).reduce(
    (acc, shipment) => {
      const customerCharge =
        Number(shipment.rl_customer_price) ||
        Number(shipment.li_customer_price) ||
        Number(shipment.customer_price) ||
        Number(shipment.ps_quote_price) ||
        0

      const cost =
        Number(shipment.rl_quote_price) ||
        Number(shipment.li_quote_price) ||
        Number(shipment.quote_price) ||
        Number(shipment.ps_quote_price) ||
        0

      acc.customerCharge += customerCharge
      acc.profit += customerCharge - cost
      return acc
    },
    { customerCharge: 0, profit: 0 }
  )

  // Handle status change - use set-status endpoint
  const handleStatusChange = async (e) => {
    e.stopPropagation()
    const newStatus = e.target.value
    if (newStatus === order.current_status) return

    setIsUpdating(true)
    try {
      const res = await fetch(
        `${API_URL}/orders/${order.order_id}/set-status?status=${newStatus}&source=web_ui`,
        { method: 'PATCH' }
      )

      if (!res.ok) {
        const msg = await res.text()
        throw new Error(msg)
      }

      if (onUpdate) onUpdate()
    } catch (err) {
      alert('Status update failed: ' + err.message)
    } finally {
      setIsUpdating(false)
    }
  }

  // Format AI summary - clean up
  const formatAISummary = (summary) => {
    if (!summary) return ''
    return summary.replace(/\n{2,}/g, '\n').trim()
  }

  // Save notes
  const handleSaveNotes = async () => {
    setIsSavingNotes(true)
    try {
      const res = await fetch(`${API_URL}/orders/${order.order_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes })
      })
      if (!res.ok) throw new Error('Failed to save notes')
      setIsEditingNotes(false)
      if (onUpdate) onUpdate()
    } catch (err) {
      alert('Failed to save notes')
    } finally {
      setIsSavingNotes(false)
    }
  }

  // Calculate days until archive for shipped orders
  const getShippedDaysRemaining = () => {
    const shippedShipments = (order.shipments || []).filter(s => s.status === 'shipped' && s.clock_started_at)
    if (shippedShipments.length === 0) return null
    
    // Get the most recent clock start
    const latestClock = shippedShipments.reduce((latest, s) => {
      const clockDate = new Date(s.clock_started_at)
      return clockDate > latest ? clockDate : latest
    }, new Date(0))
    
    const daysSince = Math.floor((new Date() - latestClock) / (1000 * 60 * 60 * 24))
    return Math.max(0, 5 - daysSince)
  }

  const daysRemaining = getShippedDaysRemaining()
  const alertBackground = order.alert_level ? ALERT_BACKGROUNDS[order.alert_level] : null
  const alertLabel = order.alert_type ? ALERT_TYPE_LABELS[order.alert_type] : null

  return (
    <div 
      className="order-card" 
      style={{ 
        borderLeftColor: status.color,
        backgroundColor: alertBackground || undefined
      }}
    >
      {/* Alert Banner */}
      {alertLabel && (
        <div style={{
          backgroundColor: order.alert_level === 'critical' ? '#d32f2f' : '#f57c00',
          color: 'white',
          padding: '4px 12px',
          fontSize: '12px',
          fontWeight: 'bold',
          marginBottom: '8px',
          borderRadius: '4px'
        }}>
          {alertLabel}
        </div>
      )}
      
      {/* Header */}
      <div className="order-header">
        <div className="order-id" onClick={() => onOpenDetail(order)}>
          #{order.order_id}
        </div>
        {orderDate && <div className="order-date">{orderDate}</div>}

        <div className="order-header-right">
          <select
            className="status-dropdown"
            value={order.current_status || 'needs_payment_link'}
            onChange={handleStatusChange}
            onClick={(e) => e.stopPropagation()}
            disabled={isUpdating}
            style={{
              backgroundColor: status.color + '20',
              color: status.color,
              borderColor: status.color
            }}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <span className="order-age-pill">
            {getAgeLabel(order.order_date)}
          </span>
        </div>
      </div>

      {/* Body */}
      <div className="order-body" onClick={() => onOpenDetail(order)}>
        <div className="customer-info">
          <div className="customer-name">{customerName}</div>
          {cityStateZip && <div className="customer-location">{cityStateZip}</div>}
          {streetAddress && (
            <div className="customer-street" style={{ fontSize: '12px', color: '#666' }}>
              {streetAddress}
            </div>
          )}
        </div>

        <div className="order-financials">
          {totalDisplay && <div className="order-total">Order: {totalDisplay}</div>}

          {shippingTotals && shippingTotals.customerCharge > 0 && (
            <div className="shipping-summary">
              <span className="ship-charge">Ship: ${shippingTotals.customerCharge.toFixed(2)}</span>
              {shippingTotals.profit !== 0 && (
                <span className={`ship-profit ${shippingTotals.profit >= 0 ? 'positive' : 'negative'}`}>
                  ({shippingTotals.profit >= 0 ? '+' : ''}${shippingTotals.profit.toFixed(2)})
                </span>
              )}
            </div>
          )}

          {totalDisplay && shippingTotals && shippingTotals.customerCharge > 0 && (
            <div className="grand-total">
              Total: ${(orderTotal + shippingTotals.customerCharge).toFixed(2)}
            </div>
          )}
        </div>

        {warehouses.length > 0 && (
          <div className="warehouses">
            {warehouses.map((wh, i) => {
              // Find the shipment for this warehouse to get its status
              const shipment = order.shipments?.find(s => s.warehouse === wh)
              const shipmentStatus = shipment?.status || 'needs_order'
              const statusInfo = SHIPMENT_STATUS_COLORS[shipmentStatus] || SHIPMENT_STATUS_COLORS['needs_order']
              
              // Calculate days remaining for this shipment's clock
              let clockDays = null
              if (shipment?.status === 'shipped' && shipment?.clock_started_at) {
                const clockDate = new Date(shipment.clock_started_at)
                const daysSince = Math.floor((new Date() - clockDate) / (1000 * 60 * 60 * 24))
                clockDays = Math.max(0, 5 - daysSince)
              }
              
              return (
                <span 
                  key={i} 
                  className="warehouse-tag"
                  title={statusInfo.label + (clockDays !== null ? ` (${clockDays} days to archive)` : '')}
                  style={{
                    backgroundColor: statusInfo.color + '20',
                    color: statusInfo.color,
                    border: `1px solid ${statusInfo.color}`,
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: '500',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  {wh}
                  {clockDays !== null && (
                    <span style={{ 
                      fontSize: '10px',
                      color: clockDays <= 1 ? '#4caf50' : clockDays <= 3 ? '#ff9800' : '#607d8b'
                    }}>
                      ⏱{clockDays}d
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        )}
      </div>

      {/* Shipments */}
      {order.shipments && order.shipments.length > 0 && (
        <div className="order-shipments">
          {(order.shipments || []).map((shipment, i) =>
            <ShipmentRow
              key={shipment.shipment_id || i}
              shipment={shipment}
              order={order}
              onOpenShippingManager={onOpenShippingManager}
              onUpdate={onUpdate}
            />
          )}
        </div>
      )}

      {/* Comments - styled box */}
      {order.comments && (
        <div style={{ 
          backgroundColor: '#fff3e0', 
          padding: '8px 12px', 
          borderRadius: '4px',
          marginTop: '8px',
          borderLeft: '3px solid #ff9800'
        }}>
          <strong style={{ color: '#e65100' }}>Customer: </strong>
          <span>{order.comments}</span>
        </div>
      )}

      {/* Internal Notes - Purple, Editable */}
      <div style={{ 
        backgroundColor: '#f3e5f5', 
        padding: '8px 12px', 
        borderRadius: '4px',
        marginTop: '8px',
        borderLeft: '3px solid #9c27b0'
      }}>
        {isEditingNotes ? (
          <div onClick={(e) => e.stopPropagation()}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add internal notes..."
              rows={3}
              style={{ 
                width: '100%', 
                marginBottom: '8px', 
                padding: '6px', 
                borderRadius: '4px', 
                border: '1px solid #9c27b0', 
                fontSize: '13px', 
                fontFamily: 'inherit', 
                resize: 'vertical', 
                boxSizing: 'border-box' 
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button 
                onClick={handleSaveNotes} 
                disabled={isSavingNotes} 
                style={{ 
                  backgroundColor: '#4caf50', 
                  color: 'white', 
                  border: 'none', 
                  padding: '4px 12px', 
                  borderRadius: '4px', 
                  cursor: 'pointer', 
                  fontSize: '12px' 
                }}
              >
                {isSavingNotes ? 'Saving...' : 'Save'}
              </button>
              <button 
                onClick={() => { setIsEditingNotes(false); setNotes(order.notes || ''); }} 
                disabled={isSavingNotes} 
                style={{ 
                  backgroundColor: '#9e9e9e', 
                  color: 'white', 
                  border: 'none', 
                  padding: '4px 12px', 
                  borderRadius: '4px', 
                  cursor: 'pointer', 
                  fontSize: '12px' 
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div onClick={(e) => e.stopPropagation()}>
            {order.notes ? (
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px' }}>
                <div><strong style={{ color: '#7b1fa2' }}>Notes:</strong> {order.notes}</div>
                <button 
                  onClick={() => setIsEditingNotes(true)} 
                  style={{ 
                    backgroundColor: '#9c27b0', 
                    color: 'white', 
                    border: 'none', 
                    padding: '2px 8px', 
                    borderRadius: '4px', 
                    cursor: 'pointer', 
                    fontSize: '11px', 
                    flexShrink: 0 
                  }}
                >
                  Edit
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setIsEditingNotes(true)} 
                style={{ 
                  backgroundColor: '#9c27b0', 
                  color: 'white', 
                  border: 'none', 
                  padding: '4px 12px', 
                  borderRadius: '4px', 
                  cursor: 'pointer', 
                  fontSize: '12px' 
                }}
              >
                + Add Note
              </button>
            )}
          </div>
        )}
      </div>

      {/* Email Button - Phase 4 */}
      {onOpenEmail && (
        <div style={{ marginTop: '8px' }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => onOpenEmail(order)}
            style={{
              backgroundColor: '#1976d2',
              color: 'white',
              border: 'none',
              padding: '6px 14px',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: '500',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            📧 Email Customer
          </button>
        </div>
      )}

      {/* AI Summary */}
      {order.ai_summary && (
        <div style={{ 
          backgroundColor: '#f5f5f5', 
          padding: '8px 12px', 
          borderRadius: '4px',
          marginTop: '8px',
          borderLeft: '3px solid #667eea',
          fontSize: '13px'
        }}>
          <strong style={{ color: '#667eea' }}>AI Summary:</strong>
          <div style={{ whiteSpace: 'pre-line', marginTop: '4px' }}>
            {formatAISummary(order.ai_summary)}
          </div>
        </div>
      )}
    </div>
  )
}

export default OrderCard
