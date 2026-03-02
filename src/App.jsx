/**
 * App.jsx - CFC Orders Dashboard
 * v7.0.0 - Dark theme, table layout, metric cards, slide-in detail panel
 * 
 * Orchestrates:
 * - Login/auth
 * - Order loading + filtering
 * - Metric cards (clickable filters)
 * - Table layout with sortable columns
 * - Slide-in detail panel with AI Summary
 * - Shipping Manager, Email Panel
 * - Brain Chat (header button, Task 3)
 * - Sandbox/Live environment toggle
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import ShippingManager from './components/ShippingManager'
import EmailPanel from './components/EmailPanel'
import BrainChat from './components/BrainChat'

import { API_URL, APP_PASSWORD, IS_SANDBOX, OTHER_ENV_URL } from './config'

// ─── STATUS CONFIG ───────────────────────────────────────────────────────────
const STATUSES = [
  { key: 'needs_payment_link', label: 'Need Invoice', short: 'Invoice', badge: 'sb-invoice', card: 'mc-invoice' },
  { key: 'awaiting_payment',   label: 'Awaiting Pay', short: 'Pay',     badge: 'sb-pay',     card: 'mc-pay' },
  { key: 'needs_warehouse_order', label: 'Need to Order', short: 'Order', badge: 'sb-order', card: 'mc-order' },
  { key: 'awaiting_warehouse', label: 'At Warehouse', short: 'Warehouse', badge: 'sb-warehouse', card: 'mc-warehouse' },
  { key: 'needs_bol',         label: 'Need BOL',     short: 'BOL',     badge: 'sb-bol',     card: 'mc-bol' },
  { key: 'awaiting_shipment', label: 'Ready Ship',   short: 'Ship',    badge: 'sb-ship',    card: 'mc-ship' },
  { key: 'complete',          label: 'Complete',      short: 'Done',    badge: 'sb-complete', card: 'mc-complete' },
]

const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.key, s]))

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const fmtMoney = (v) => '$' + parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'

const formatAddress = (o) => {
  const parts = []
  if (o.street) parts.push(o.street)
  const csz = []
  if (o.city) csz.push(o.city)
  if (o.state) csz.push(o.zip_code ? `${o.state} ${o.zip_code}` : o.state)
  else if (o.zip_code) csz.push(o.zip_code)
  if (csz.length) parts.push(csz.join(', '))
  return parts.join(', ')
}

// ─── APP ─────────────────────────────────────────────────────────────────────
function App() {
  // Auth
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  // Data
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [statusFilter, setStatusFilter] = useState(null)
  const [showComplete, setShowComplete] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortCol, setSortCol] = useState('order_date')
  const [sortDir, setSortDir] = useState('desc')

  // Detail panel
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [panelTab, setPanelTab] = useState('details')
  const [comprehensiveSummary, setComprehensiveSummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)

  // Modals
  const [shippingModal, setShippingModal] = useState(null)
  const [emailOrder, setEmailOrder] = useState(null)

  // Brain Chat
  const [brainOpen, setBrainOpen] = useState(false)

  // ─── AUTH ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (localStorage.getItem('cfc_logged_in') === 'true') setIsLoggedIn(true)
  }, [])

  useEffect(() => { if (isLoggedIn) loadOrders() }, [isLoggedIn])

  const handleLogin = (e) => {
    e.preventDefault()
    if (password === APP_PASSWORD) {
      setIsLoggedIn(true)
      localStorage.setItem('cfc_logged_in', 'true')
      setLoginError('')
    } else {
      setLoginError('Incorrect password')
    }
  }

  const handleLogout = () => {
    setIsLoggedIn(false)
    localStorage.removeItem('cfc_logged_in')
  }

  // ─── DATA ───────────────────────────────────────────────────────────────
  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/orders?limit=200&include_complete=true`)
      const data = await res.json()
      if (data.orders) setOrders(data.orders)
    } catch (err) {
      console.error('Failed to load orders:', err)
    }
    setLoading(false)
  }, [])

  // ─── METRICS ────────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const c = {}
    STATUSES.forEach(s => { c[s.key] = 0 })
    orders.forEach(o => { if (c[o.current_status] !== undefined) c[o.current_status]++ })
    return c
  }, [orders])

  // ─── FILTERING + SORTING ────────────────────────────────────────────────
  const filteredOrders = useMemo(() => {
    let list = orders

    // Tab: active vs complete
    if (showComplete) {
      list = list.filter(o => o.current_status === 'complete')
    } else {
      list = list.filter(o => o.current_status !== 'complete')
    }

    // Metric card filter
    if (statusFilter) {
      list = list.filter(o => o.current_status === statusFilter)
    }

    // Search
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      list = list.filter(o =>
        String(o.order_id || '').toLowerCase().includes(q) ||
        (o.company_name || '').toLowerCase().includes(q) ||
        (o.customer_name || '').toLowerCase().includes(q) ||
        (o.email || '').toLowerCase().includes(q) ||
        (o.city || '').toLowerCase().includes(q)
      )
    }

    // Sort
    list = [...list].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol]
      if (sortCol === 'order_total' || sortCol === 'days_open') {
        av = parseFloat(av || 0); bv = parseFloat(bv || 0)
      } else {
        av = String(av || '').toLowerCase(); bv = String(bv || '').toLowerCase()
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

    return list
  }, [orders, showComplete, statusFilter, searchQuery, sortCol, sortDir])

  const handleSort = (col) => {
    if (sortCol === col) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortCol(col)
      setSortDir('asc')
    }
  }

  const handleMetricClick = (key) => {
    if (key === 'complete') {
      setShowComplete(true)
      setStatusFilter(null)
    } else {
      setShowComplete(false)
      setStatusFilter(statusFilter === key ? null : key)
    }
  }

  // ─── DETAIL PANEL ──────────────────────────────────────────────────────
  const openDetail = (order) => {
    setSelectedOrder(order)
    setPanelTab('details')
    setComprehensiveSummary('')
  }

  const closeDetail = () => {
    setSelectedOrder(null)
    setComprehensiveSummary('')
  }

  // ─── AI SUMMARY ─────────────────────────────────────────────────────────
  const generateSummary = async () => {
    if (!selectedOrder) return
    setSummaryLoading(true)
    setComprehensiveSummary('')
    try {
      const res = await fetch(`${API_URL}/orders/${selectedOrder.order_id}/comprehensive-summary`, { method: 'POST' })
      const data = await res.json()
      setComprehensiveSummary(data.summary || data.detail || 'No summary returned.')
    } catch (err) {
      setComprehensiveSummary('Failed to generate summary.')
    }
    setSummaryLoading(false)
  }

  // ─── SHIPPING ───────────────────────────────────────────────────────────
  const openShippingManager = (shipment, order) => {
    setShippingModal({
      shipment,
      orderId: order?.order_id || shipment.order_id,
      customerInfo: {
        name: order?.company_name || order?.customer_name || '',
        street: order?.street || '',
        city: order?.city || '',
        state: order?.state || '',
        zip: order?.zip_code || '',
        phone: order?.phone || '',
        email: order?.email || ''
      }
    })
  }

  const closeShippingManager = () => { setShippingModal(null); loadOrders() }

  // ─── EMAIL ──────────────────────────────────────────────────────────────
  const handleEmailSent = () => { setEmailOrder(null); loadOrders() }

  // ─── STATUS UPDATE ──────────────────────────────────────────────────────
  const updateStatus = async (orderId, value) => {
    try {
      await fetch(`${API_URL}/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_status: value })
      })
      loadOrders()
    } catch (err) {
      console.error('Failed to update:', err)
    }
  }

  // ─── RENDER: LOGIN ──────────────────────────────────────────────────────
  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <form className="login-form" onSubmit={handleLogin}>
          <h2>CFC Orders</h2>
          <input
            type="password" value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter password"
          />
          <button type="submit">Login</button>
          {loginError && <p className="error">{loginError}</p>}
        </form>
      </div>
    )
  }

  if (loading && orders.length === 0) {
    return <div className="loading">Loading orders...</div>
  }

  const activeCount = orders.filter(o => o.current_status !== 'complete').length
  const completeCount = counts.complete

  // ─── RENDER: MAIN ───────────────────────────────────────────────────────
  return (
    <div className="app">
      {/* ═══ HEADER ═══ */}
      <header className="app-header">
        <div className="header-left">
          <h1>CFC <span>Orders</span></h1>
          {IS_SANDBOX && <span className="env-badge env-sandbox">SANDBOX</span>}
        </div>
        <div className="header-actions">
          {/* Search in header */}
          <div className="search-box">
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>&#x1F50D;</span>
            <input
              type="text" placeholder="Search orders..."
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          {/* Brain Chat toggle - LEFT of Open Live */}
          <button onClick={() => setBrainOpen(v => !v)} title="Brain Chat"
            style={{
              background: brainOpen ? 'rgba(124,58,237,0.2)' : undefined,
              borderColor: brainOpen ? '#7c3aed' : undefined,
              color: brainOpen ? '#a78bfa' : undefined
            }}
          >
            &#x1F9E0; Brain
          </button>
          {/* Open Live / Open Sandbox */}
          <button onClick={() => window.open(OTHER_ENV_URL, '_blank')}
            style={{
              background: IS_SANDBOX ? 'rgba(16,185,129,0.12)' : 'rgba(245,158,11,0.12)',
              borderColor: IS_SANDBOX ? 'rgba(16,185,129,0.3)' : 'rgba(245,158,11,0.3)',
              color: IS_SANDBOX ? 'var(--success)' : 'var(--warning)'
            }}
          >
            {IS_SANDBOX ? '\u{1F7E2} Open Live' : '\u{1F9EA} Open Sandbox'}
          </button>
          <button onClick={loadOrders} disabled={loading}>
            {loading ? '...' : '\u{21BB} Refresh'}
          </button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="main-content">
        <div className="content-area">

          {/* ─── METRIC CARDS ─── */}
          <div className="metrics-row">
            {STATUSES.map(s => (
              <div
                key={s.key}
                className={`metric-card ${s.card}${statusFilter === s.key || (s.key === 'complete' && showComplete) ? ' active' : ''}`}
                onClick={() => handleMetricClick(s.key)}
              >
                <div className="metric-count">{counts[s.key]}</div>
                <div className="metric-label">{s.short}</div>
              </div>
            ))}
          </div>

          {/* ─── TABS ROW ─── */}
          <div className="tabs-row">
            <div className="tabs">
              <button
                className={`tab-btn${!showComplete ? ' active' : ''}`}
                onClick={() => { setShowComplete(false); setStatusFilter(null) }}
              >
                Active <span className="tab-count">{activeCount}</span>
              </button>
              <button
                className={`tab-btn${showComplete ? ' active' : ''}`}
                onClick={() => { setShowComplete(true); setStatusFilter(null) }}
              >
                Complete <span className="tab-count">{completeCount}</span>
              </button>
            </div>
            <div className="tab-actions">
              {statusFilter && (
                <button className="btn btn-sm" onClick={() => setStatusFilter(null)}>
                  Clear filter
                </button>
              )}
            </div>
          </div>

          {/* ─── ORDERS TABLE ─── */}
          {filteredOrders.length === 0 ? (
            <div className="empty">No orders found</div>
          ) : (
            <table className="orders-table">
              <thead>
                <tr>
                  <th onClick={() => handleSort('order_id')}>Order {sortCol === 'order_id' ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}</th>
                  <th onClick={() => handleSort('company_name')}>Customer {sortCol === 'company_name' ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}</th>
                  <th onClick={() => handleSort('current_status')}>Status</th>
                  <th onClick={() => handleSort('order_total')}>Total {sortCol === 'order_total' ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}</th>
                  <th onClick={() => handleSort('order_date')}>Date {sortCol === 'order_date' ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}</th>
                  <th onClick={() => handleSort('days_open')}>Age {sortCol === 'days_open' ? (sortDir === 'asc' ? '\u25B2' : '\u25BC') : ''}</th>
                  <th>Warehouse</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map(order => {
                  const st = STATUS_MAP[order.current_status] || {}
                  const days = parseInt(order.days_open || 0)
                  const ageClass = days > 14 ? 'age-danger' : days > 7 ? 'age-warn' : ''
                  const isSelected = selectedOrder?.order_id === order.order_id

                  // Extract first warehouse from shipments
                  const wh = order.shipments?.[0]?.warehouse || ''

                  return (
                    <tr key={order.order_id}
                      className={isSelected ? 'row-selected' : ''}
                      onClick={() => openDetail(order)}
                    >
                      <td><span className="order-id">#{order.order_id}</span></td>
                      <td>
                        <div className="customer-name">{order.company_name || order.customer_name || '—'}</div>
                        {order.city && <div className="customer-company">{order.city}{order.state ? `, ${order.state}` : ''}</div>}
                      </td>
                      <td>
                        <span className={`status-badge ${st.badge || ''}`}>
                          <span className="status-dot" />
                          {st.label || order.current_status}
                        </span>
                      </td>
                      <td><span className="amount">{fmtMoney(order.order_total)}</span></td>
                      <td style={{ color: 'var(--text-dim)', fontSize: '12px' }}>{fmtDate(order.order_date)}</td>
                      <td><span className={`age-cell ${ageClass}`}>{days}d</span></td>
                      <td>{wh && <span className="warehouse-tag">{wh}</span>}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ═══ DETAIL PANEL (slide-in from right) ═══ */}
        <div className={`detail-panel${selectedOrder ? ' open' : ''}`}>
          {selectedOrder && (
            <>
              {/* Panel Header */}
              <div className="panel-header">
                <h3>
                  <span className="order-id">#{selectedOrder.order_id}</span>
                  <span className="amount" style={{ marginLeft: '8px' }}>{fmtMoney(selectedOrder.order_total)}</span>
                </h3>
                <button className="panel-close" onClick={closeDetail}>{'\u00D7'}</button>
              </div>

              {/* Panel Tabs */}
              <div className="panel-tabs">
                <button className={`panel-tab${panelTab === 'details' ? ' active' : ''}`} onClick={() => setPanelTab('details')}>Details</button>
                <button className={`panel-tab${panelTab === 'ai' ? ' active' : ''}`} onClick={() => setPanelTab('ai')}>AI Summary</button>
                <button className={`panel-tab${panelTab === 'actions' ? ' active' : ''}`} onClick={() => setPanelTab('actions')}>Actions</button>
              </div>

              {/* Panel Content */}
              <div className="panel-content">

                {/* ── DETAILS TAB ── */}
                {panelTab === 'details' && (
                  <>
                    <div className="detail-section">
                      <h4>Customer</h4>
                      <div className="detail-row">
                        <span className="detail-label">Company</span>
                        <span className="detail-value">{selectedOrder.company_name || selectedOrder.customer_name || '—'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Email</span>
                        <span className="detail-value mono">{selectedOrder.email || '—'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Phone</span>
                        <span className="detail-value mono">{selectedOrder.phone || '—'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Address</span>
                        <span className="detail-value">{formatAddress(selectedOrder) || '—'}</span>
                      </div>
                    </div>

                    <div className="detail-section">
                      <h4>Order Info</h4>
                      <div className="detail-row">
                        <span className="detail-label">Status</span>
                        <span className={`status-badge ${STATUS_MAP[selectedOrder.current_status]?.badge || ''}`}>
                          <span className="status-dot" />
                          {STATUS_MAP[selectedOrder.current_status]?.label || selectedOrder.current_status}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Date</span>
                        <span className="detail-value">{fmtDate(selectedOrder.order_date)}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Days Open</span>
                        <span className="detail-value mono">{selectedOrder.days_open || 0}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Total</span>
                        <span className="detail-value mono" style={{ color: 'var(--success)' }}>{fmtMoney(selectedOrder.order_total)}</span>
                      </div>
                      {selectedOrder.notes && (
                        <div className="detail-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px' }}>
                          <span className="detail-label">Notes</span>
                          <span className="detail-value" style={{ fontSize: '12px', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{selectedOrder.notes}</span>
                        </div>
                      )}
                    </div>

                    {/* Shipments */}
                    {selectedOrder.shipments?.length > 0 && (
                      <div className="detail-section">
                        <h4>Shipments</h4>
                        {selectedOrder.shipments.map((s, i) => (
                          <div key={i} style={{
                            background: 'var(--bg-input)', borderRadius: '8px', padding: '10px 12px', marginBottom: '8px',
                            border: '1px solid var(--border)'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <span className="warehouse-tag">{s.warehouse || 'Unknown'}</span>
                              <span className="amount" style={{ fontSize: '12px' }}>{s.weight_lbs ? `${s.weight_lbs} lbs` : ''}</span>
                            </div>
                            {s.pro_number && (
                              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>PRO: <span className="mono">{s.pro_number}</span></div>
                            )}
                            <button className="btn btn-sm" style={{ marginTop: '8px', fontSize: '11px' }}
                              onClick={() => openShippingManager(s, selectedOrder)}
                            >
                              Manage Shipping
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Status change */}
                    <div className="detail-section">
                      <h4>Change Status</h4>
                      <select
                        value={selectedOrder.current_status}
                        onChange={e => {
                          updateStatus(selectedOrder.order_id, e.target.value)
                          setSelectedOrder({ ...selectedOrder, current_status: e.target.value })
                        }}
                        style={{
                          width: '100%', padding: '8px 10px', background: 'var(--bg-input)',
                          border: '1px solid var(--border)', borderRadius: '6px',
                          color: 'var(--text)', fontFamily: 'inherit', fontSize: '13px'
                        }}
                      >
                        {STATUSES.map(s => (
                          <option key={s.key} value={s.key}>{s.label}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* ── AI SUMMARY TAB ── */}
                {panelTab === 'ai' && (
                  <div className="detail-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <h4 style={{ margin: 0 }}>AI Analysis</h4>
                      <button className="btn btn-primary btn-sm" onClick={generateSummary} disabled={summaryLoading}>
                        {summaryLoading ? 'Generating...' : 'Generate Summary'}
                      </button>
                    </div>
                    <div style={{
                      background: 'var(--bg-input)', borderRadius: '8px', padding: '16px',
                      minHeight: '200px', border: '1px solid var(--border)'
                    }}>
                      {summaryLoading ? (
                        <div style={{ textAlign: 'center', paddingTop: '40px' }}>
                          <div style={{
                            width: '32px', height: '32px',
                            border: '3px solid var(--border)',
                            borderTop: '3px solid var(--accent)',
                            borderRadius: '50%',
                            animation: 'spin 1s linear infinite',
                            margin: '0 auto 12px'
                          }} />
                          <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>Analyzing order data...</div>
                        </div>
                      ) : comprehensiveSummary ? (
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '13px', color: 'var(--text)' }}>
                          {comprehensiveSummary}
                        </div>
                      ) : (
                        <div style={{ textAlign: 'center', paddingTop: '50px', color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.8' }}>
                          Click "Generate Summary" for a comprehensive<br />AI analysis of this order including<br />all history and communications.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* ── ACTIONS TAB ── */}
                {panelTab === 'actions' && (
                  <div className="detail-section">
                    <h4>Quick Actions</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button className="btn" onClick={() => setEmailOrder(selectedOrder)}>
                        &#x2709; Send Email
                      </button>
                      {selectedOrder.shipments?.length > 0 && (
                        <button className="btn" onClick={() => openShippingManager(selectedOrder.shipments[0], selectedOrder)}>
                          &#x1F69A; Shipping Manager
                        </button>
                      )}
                      <button className="btn btn-danger" onClick={() => {
                        if (confirm('Archive this order?')) updateStatus(selectedOrder.order_id, 'complete')
                      }}>
                        Archive Order
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ═══ BRAIN CHAT (triggered from header, panel overlays) ═══ */}
      <BrainChat isOpen={brainOpen} onClose={() => setBrainOpen(false)} />

      {/* ═══ EMAIL PANEL ═══ */}
      {emailOrder && (
        <EmailPanel
          orderId={emailOrder.order_id}
          customerEmail={emailOrder.email}
          onClose={() => setEmailOrder(null)}
          onSent={handleEmailSent}
        />
      )}

      {/* ═══ SHIPPING MANAGER MODAL ═══ */}
      {shippingModal && (
        <div className="modal-overlay shipping-modal-overlay" onClick={closeShippingManager}>
          <div className="modal shipping-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Shipping - {shippingModal.shipment.warehouse}</h2>
              <button className="modal-close" onClick={closeShippingManager}>{'\u00D7'}</button>
            </div>
            <div className="modal-body">
              <ShippingManager
                shipment={shippingModal.shipment}
                orderId={shippingModal.orderId}
                customerInfo={shippingModal.customerInfo}
                onClose={closeShippingManager}
                onUpdate={loadOrders}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
