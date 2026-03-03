/**
 * App.jsx - CFC Orders Dashboard
 * v7.2.1 - Click-to-close detail panel from content area + stopPropagation on row clicks
 * 
 * Tab layout (left to right):
 *   All | Inactive | Invoice | Pay | Order | Warehouse | BOL | Ship | Done
 * 
 * "All" = all orders NOT in Done tab (active + inactive lifecycle)
 * "Inactive" = orders with lifecycle_status === 'inactive' (7+ days no customer email)
 * "Done" = complete orders (includes canceled with indicator)
 * 
 * Orchestrates:
 * - Login/auth
 * - Order loading + filtering
 * - Metric cards (clickable filters)
 * - Table layout with sortable columns
 * - Slide-in detail panel with AI Summary
 * - Alerts system (header badge + dropdown + per-order)
 * - Shipping Manager, Email Panel
 * - Brain Chat (header button)
 * - Sandbox/Live environment toggle
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import ShippingManager from './components/ShippingManager'
import EmailPanel from './components/EmailPanel'
import BrainChat from './components/BrainChat'

import { API_URL, APP_PASSWORD, IS_SANDBOX, OTHER_ENV_URL } from './config'

// ─── STATUS CONFIG ───────────────────────────────────────
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

// Active statuses (everything except complete)
const ACTIVE_STATUS_KEYS = STATUSES.filter(s => s.key !== 'complete').map(s => s.key)

// ─── ALERT TYPE LABELS ──────────────────────────────────
const ALERT_LABELS = {
  needs_invoice: { label: 'Needs Invoice', icon: '\ud83d\udccb' },
  awaiting_payment_long: { label: 'Awaiting Payment', icon: '\ud83d\udcb0' },
  needs_warehouse_order: { label: 'Needs Warehouse Order', icon: '\ud83c\udfed' },
  at_warehouse_long: { label: 'At Warehouse Too Long', icon: '\u23f3' },
  needs_bol: { label: 'Needs BOL', icon: '\ud83d\udcc4' },
  ready_ship_long: { label: 'Ready to Ship Too Long', icon: '\ud83d\ude9b' },
  tracking_not_sent: { label: 'Tracking Not Sent', icon: '\ud83d\udcec' },
  delivery_confirm_needed: { label: 'Needs Delivery Confirm', icon: '\u2705' },
}

// ─── HELPERS ─────────────────────────────────────────────
const fmtMoney = (v) => '$' + parseFloat(v || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '\u2014'
const fmtDateTime = (d) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '\u2014'

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

// ─── APP ─────────────────────────────────────────────────
function App() {
  // Auth
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')

  // Data
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  // Filters — activeTab: 'all' | 'inactive' | 'done'
  const [activeTab, setActiveTab] = useState('all')
  const [statusFilter, setStatusFilter] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortCol, setSortCol] = useState('order_date')
  const [sortDir, setSortDir] = useState('desc')

  // Lifecycle summary from backend
  const [lifecycleSummary, setLifecycleSummary] = useState({ active: 0, inactive: 0, canceled: 0, total: 0 })

  // Detail panel
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [panelTab, setPanelTab] = useState('details')
  const [comprehensiveSummary, setComprehensiveSummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)

  // Alerts
  const [alertSummary, setAlertSummary] = useState({ total_unresolved: 0, by_type: {} })
  const [allAlerts, setAllAlerts] = useState([])
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [orderAlerts, setOrderAlerts] = useState([])
  const [checkingAlerts, setCheckingAlerts] = useState(false)
  const alertsRef = useRef(null)

  // Modals
  const [shippingModal, setShippingModal] = useState(null)
  const [emailOrder, setEmailOrder] = useState(null)

  // Brain Chat
  const [brainOpen, setBrainOpen] = useState(false)

  // ─── AUTH ──────────────────────────────────────────────
  useEffect(() => {
    if (localStorage.getItem('cfc_logged_in') === 'true') setIsLoggedIn(true)
  }, [])

  useEffect(() => { if (isLoggedIn) { loadOrders(); loadAlertSummary(); loadLifecycleSummary() } }, [isLoggedIn])

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

  // ─── DATA ──────────────────────────────────────────────
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

  // ─── LIFECYCLE SUMMARY ────────────────────────────────
  const loadLifecycleSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/lifecycle/summary`)
      const data = await res.json()
      if (data.success !== false) {
        setLifecycleSummary({
          active: data.active || 0,
          inactive: data.inactive || 0,
          canceled: data.canceled || 0,
          total: data.total || 0,
        })
      }
    } catch (err) {
      // Lifecycle endpoint may not exist yet — gracefully degrade
      console.log('Lifecycle summary not available:', err.message)
    }
  }, [])

  // ─── ALERTS ───────────────────────────────────────────
  const loadAlertSummary = useCallback(async () => {
    try {
      const res = await fetch(`${API_URL}/alerts/summary`)
      const data = await res.json()
      if (data.success) {
        setAlertSummary({ total_unresolved: data.total_unresolved, by_type: data.by_type })
      }
    } catch (err) {
      console.error('Failed to load alert summary:', err)
    }
  }, [])

  const loadAllAlerts = useCallback(async () => {
    setAlertsLoading(true)
    try {
      const res = await fetch(`${API_URL}/alerts/`)
      const data = await res.json()
      if (data.success) setAllAlerts(data.alerts || [])
    } catch (err) {
      console.error('Failed to load alerts:', err)
    }
    setAlertsLoading(false)
  }, [])

  const loadOrderAlerts = useCallback(async (orderId) => {
    try {
      const res = await fetch(`${API_URL}/alerts/?order_id=${orderId}`)
      const data = await res.json()
      if (data.success) setOrderAlerts(data.alerts || [])
    } catch (err) {
      console.error('Failed to load order alerts:', err)
      setOrderAlerts([])
    }
  }, [])

  const resolveAlert = async (alertId) => {
    try {
      const res = await fetch(`${API_URL}/alerts/${alertId}/resolve`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        loadAllAlerts()
        loadAlertSummary()
        if (selectedOrder) loadOrderAlerts(selectedOrder.order_id)
      }
    } catch (err) {
      console.error('Failed to resolve alert:', err)
    }
  }

  const runAlertCheck = async () => {
    setCheckingAlerts(true)
    try {
      const res = await fetch(`${API_URL}/alerts/check-all`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        loadAllAlerts()
        loadAlertSummary()
      }
    } catch (err) {
      console.error('Failed to run alert check:', err)
    }
    setCheckingAlerts(false)
  }

  const toggleAlerts = () => {
    if (!alertsOpen) loadAllAlerts()
    setAlertsOpen(v => !v)
  }

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (alertsRef.current && !alertsRef.current.contains(e.target)) {
        setAlertsOpen(false)
      }
    }
    if (alertsOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [alertsOpen])

  // ─── METRICS ──────────────────────────────────────────
  const counts = useMemo(() => {
    const c = {}
    STATUSES.forEach(s => { c[s.key] = 0 })
    orders.forEach(o => { if (c[o.current_status] !== undefined) c[o.current_status]++ })
    return c
  }, [orders])

  // ─── LIFECYCLE COUNTS (from loaded orders) ────────────
  const lifecycleCounts = useMemo(() => {
    let allActive = 0    // not complete, not inactive lifecycle
    let inactive = 0     // lifecycle_status === 'inactive'
    let done = 0         // complete (includes canceled)
    let canceledInDone = 0

    orders.forEach(o => {
      if (o.current_status === 'complete') {
        done++
        if (o.lifecycle_status === 'canceled') canceledInDone++
      } else if (o.lifecycle_status === 'inactive') {
        inactive++
      } else {
        allActive++
      }
    })

    return { allActive, inactive, done, canceledInDone, allNonDone: allActive + inactive }
  }, [orders])

  // ─── FILTERING + SORTING ──────────────────────────────
  const filteredOrders = useMemo(() => {
    let list = orders

    // Tab filtering
    if (activeTab === 'done') {
      // Done tab: only complete orders
      list = list.filter(o => o.current_status === 'complete')
    } else if (activeTab === 'inactive') {
      // Inactive tab: non-complete orders with lifecycle_status === 'inactive'
      list = list.filter(o => o.current_status !== 'complete' && o.lifecycle_status === 'inactive')
    } else {
      // "All" tab: all non-complete orders (both active and inactive lifecycle)
      list = list.filter(o => o.current_status !== 'complete')
    }

    // Status filter (from metric cards) — only applies within current tab
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
  }, [orders, activeTab, statusFilter, searchQuery, sortCol, sortDir])

  // Group alerts by type for dropdown (must be before early returns - Rules of Hooks)
  const alertsByType = useMemo(() => {
    const grouped = {}
    allAlerts.forEach(a => {
      if (!grouped[a.alert_type]) grouped[a.alert_type] = []
      grouped[a.alert_type].push(a)
    })
    return grouped
  }, [allAlerts])

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
      setActiveTab('done')
      setStatusFilter(null)
    } else {
      if (activeTab === 'done') setActiveTab('all')
      setStatusFilter(statusFilter === key ? null : key)
    }
  }

  const handleTabClick = (tab) => {
    setActiveTab(tab)
    setStatusFilter(null)
  }

  // ─── DETAIL PANEL ─────────────────────────────────────
  const openDetail = (order) => {
    setSelectedOrder(order)
    setPanelTab('details')
    setComprehensiveSummary('')
    loadOrderAlerts(order.order_id)
  }

  const closeDetail = () => {
    setSelectedOrder(null)
    setComprehensiveSummary('')
    setOrderAlerts([])
  }

  // ─── AI SUMMARY ───────────────────────────────────────
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

  // ─── SHIPPING ─────────────────────────────────────────
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

  // ─── EMAIL ────────────────────────────────────────────
  const handleEmailSent = () => { setEmailOrder(null); loadOrders() }

  // ─── STATUS UPDATE ────────────────────────────────────
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

  // ─── LIFECYCLE CHECK (manual trigger) ─────────────────
  const runLifecycleCheck = async () => {
    try {
      const res = await fetch(`${API_URL}/lifecycle/check-all`, { method: 'POST' })
      const data = await res.json()
      if (data.success !== false) {
        loadOrders()
        loadLifecycleSummary()
      }
    } catch (err) {
      console.error('Lifecycle check failed:', err)
    }
  }

  // ─── CONTENT AREA CLICK → CLOSE PANEL ─────────────────
  const handleContentAreaClick = () => {
    if (selectedOrder) closeDetail()
  }

  // ─── RENDER: LOGIN ────────────────────────────────────
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

  const totalAlerts = alertSummary.total_unresolved || 0

  // ─── RENDER: MAIN ─────────────────────────────────────
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

          {/* ─── ALERTS BELL ─── */}
          <div className="alerts-trigger-wrap" ref={alertsRef}>
            <button
              onClick={toggleAlerts}
              className={`alerts-bell-btn${totalAlerts > 0 ? ' has-alerts' : ''}${alertsOpen ? ' active' : ''}`}
              title={`${totalAlerts} unresolved alerts`}
            >
              &#x1F514;
              {totalAlerts > 0 && <span className="alerts-badge-count">{totalAlerts}</span>}
            </button>

            {/* ─── ALERTS DROPDOWN ─── */}
            {alertsOpen && (
              <div className="alerts-dropdown">
                <div className="alerts-dropdown-header">
                  <div className="alerts-dropdown-title">
                    <span style={{ fontSize: '16px' }}>&#x26A0;&#xFE0F;</span>
                    <span>{totalAlerts} Unresolved Alert{totalAlerts !== 1 ? 's' : ''}</span>
                  </div>
                  <button
                    className="btn btn-sm btn-primary"
                    onClick={runAlertCheck}
                    disabled={checkingAlerts}
                  >
                    {checkingAlerts ? '\u27f3 Checking...' : '\u27f3 Run Check'}
                  </button>
                </div>

                <div className="alerts-dropdown-body">
                  {alertsLoading ? (
                    <div className="alerts-loading">Loading alerts...</div>
                  ) : allAlerts.length === 0 ? (
                    <div className="alerts-empty">
                      <span style={{ fontSize: '24px' }}>&#x2705;</span>
                      <span>All clear — no unresolved alerts</span>
                    </div>
                  ) : (
                    Object.entries(alertsByType).map(([type, alerts]) => {
                      const meta = ALERT_LABELS[type] || { label: type, icon: '\u26a0\ufe0f' }
                      return (
                        <div key={type} className="alerts-group">
                          <div className="alerts-group-header">
                            <span>{meta.icon}</span>
                            <span className="alerts-group-label">{meta.label}</span>
                            <span className="alerts-group-count">{alerts.length}</span>
                          </div>
                          {alerts.map(alert => (
                            <div key={alert.id} className="alert-row">
                              <div className="alert-row-info">
                                <span
                                  className="alert-order-link"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const order = orders.find(o => o.order_id === alert.order_id)
                                    if (order) { openDetail(order); setAlertsOpen(false) }
                                  }}
                                >
                                  #{alert.order_id}
                                </span>
                                <span className="alert-message">{alert.alert_message}</span>
                                <span className="alert-time">{fmtDateTime(alert.created_at)}</span>
                              </div>
                              <button
                                className="alert-resolve-btn"
                                onClick={(e) => { e.stopPropagation(); resolveAlert(alert.id) }}
                                title="Resolve this alert"
                              >
                                &#x2713;
                              </button>
                            </div>
                          ))}
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Brain Chat toggle */}
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
          <button onClick={() => { loadOrders(); loadAlertSummary(); loadLifecycleSummary() }} disabled={loading}>
            {loading ? '...' : '\u{21BB} Refresh'}
          </button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="main-content">
        <div
          className={`content-area${selectedOrder ? ' panel-open' : ''}`}
          onClick={handleContentAreaClick}
        >

          {/* ─── METRIC CARDS ─── */}
          <div className="metrics-row">
            {STATUSES.map(s => (
              <div
                key={s.key}
                className={`metric-card ${s.card}${statusFilter === s.key || (s.key === 'complete' && activeTab === 'done') ? ' active' : ''}`}
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
              {/* ALL — far left */}
              <button
                className={`tab-btn${activeTab === 'all' && !statusFilter ? ' active' : ''}`}
                onClick={() => handleTabClick('all')}
                title="All active orders (excludes Done)"
              >
                All <span className="tab-count">{lifecycleCounts.allNonDone}</span>
              </button>

              {/* INACTIVE — between All and status filters */}
              <button
                className={`tab-btn tab-inactive${activeTab === 'inactive' ? ' active' : ''}`}
                onClick={() => handleTabClick('inactive')}
                title="Orders with no customer email for 7+ days"
                style={activeTab === 'inactive' ? {
                  backgroundColor: 'rgba(245, 158, 11, 0.15)',
                  borderColor: '#f59e0b',
                  color: '#f59e0b',
                } : {
                  borderColor: 'rgba(245, 158, 11, 0.3)',
                  color: '#f59e0b',
                }}
              >
                Inactive <span className="tab-count">{lifecycleCounts.inactive}</span>
              </button>

              {/* Separator */}
              <span style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px' }} />

              {/* Status filter buttons — Invoice through Ship */}
              {ACTIVE_STATUS_KEYS.map(key => {
                const s = STATUS_MAP[key]
                const isActive = statusFilter === key
                return (
                  <button
                    key={key}
                    className={`tab-btn${isActive ? ' active' : ''}`}
                    onClick={() => {
                      if (activeTab === 'done') setActiveTab('all')
                      setStatusFilter(isActive ? null : key)
                    }}
                    style={isActive ? {
                      backgroundColor: `var(--status-${s.badge}-bg, rgba(255,255,255,0.1))`,
                    } : {}}
                  >
                    {s.short} <span className="tab-count">{counts[key]}</span>
                  </button>
                )
              })}

              {/* Separator */}
              <span style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px' }} />

              {/* DONE — far right */}
              <button
                className={`tab-btn tab-done${activeTab === 'done' ? ' active' : ''}`}
                onClick={() => handleTabClick('done')}
                title="Completed and canceled orders"
                style={activeTab === 'done' ? {
                  backgroundColor: 'rgba(158, 158, 158, 0.15)',
                  borderColor: '#9e9e9e',
                  color: '#9e9e9e',
                } : {}}
              >
                Done <span className="tab-count">{lifecycleCounts.done}</span>
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
                  const isCanceled = order.lifecycle_status === 'canceled'
                  const isInactive = order.lifecycle_status === 'inactive'

                  // Extract first warehouse from shipments
                  const wh = order.shipments?.[0]?.warehouse || ''

                  return (
                    <tr key={order.order_id}
                      className={`${isSelected ? 'row-selected' : ''}${isCanceled ? ' row-canceled' : ''}${isInactive ? ' row-inactive' : ''}`}
                      onClick={(e) => { e.stopPropagation(); openDetail(order) }}
                    >
                      <td>
                        <span className="order-id">#{order.order_id}</span>
                        {isCanceled && <span className="canceled-badge" title="Canceled">CANCELED</span>}
                        {isInactive && activeTab !== 'inactive' && <span className="inactive-badge" title="Inactive 7+ days">INACTIVE</span>}
                      </td>
                      <td>
                        <div className="customer-name">{order.company_name || order.customer_name || '\u2014'}</div>
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
                  {selectedOrder.lifecycle_status === 'canceled' && (
                    <span className="canceled-badge" style={{ marginLeft: '8px' }}>CANCELED</span>
                  )}
                  {selectedOrder.lifecycle_status === 'inactive' && (
                    <span className="inactive-badge" style={{ marginLeft: '8px' }}>INACTIVE</span>
                  )}
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
                    {/* ── PER-ORDER ALERTS ── */}
                    {orderAlerts.length > 0 && (
                      <div className="detail-section order-alerts-section">
                        <h4>&#x26A0;&#xFE0F; Active Alerts ({orderAlerts.length})</h4>
                        {orderAlerts.map(alert => {
                          const meta = ALERT_LABELS[alert.alert_type] || { label: alert.alert_type, icon: '\u26a0\ufe0f' }
                          return (
                            <div key={alert.id} className="order-alert-card">
                              <div className="order-alert-info">
                                <div className="order-alert-type">
                                  <span>{meta.icon}</span>
                                  <span>{meta.label}</span>
                                </div>
                                <div className="order-alert-msg">{alert.alert_message}</div>
                                <div className="order-alert-time">{fmtDateTime(alert.created_at)}</div>
                              </div>
                              <button
                                className="btn btn-sm alert-resolve-inline"
                                onClick={() => resolveAlert(alert.id)}
                              >
                                &#x2713; Resolve
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Lifecycle info (if inactive or canceled) */}
                    {(selectedOrder.lifecycle_status === 'inactive' || selectedOrder.lifecycle_status === 'canceled') && (
                      <div className="detail-section" style={{
                        background: selectedOrder.lifecycle_status === 'canceled'
                          ? 'rgba(239,68,68,0.08)' : 'rgba(245,158,11,0.08)',
                        border: `1px solid ${selectedOrder.lifecycle_status === 'canceled'
                          ? 'rgba(239,68,68,0.3)' : 'rgba(245,158,11,0.3)'}`,
                        borderRadius: '8px',
                        padding: '12px',
                      }}>
                        <h4 style={{ color: selectedOrder.lifecycle_status === 'canceled' ? '#ef4444' : '#f59e0b', margin: '0 0 8px 0' }}>
                          {selectedOrder.lifecycle_status === 'canceled' ? '\u274c Canceled' : '\u23f8\ufe0f Inactive'}
                        </h4>
                        {selectedOrder.lifecycle_deadline_at && (
                          <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                            {selectedOrder.lifecycle_status === 'inactive'
                              ? `Will be canceled: ${fmtDate(selectedOrder.lifecycle_deadline_at)}`
                              : `Canceled at: ${fmtDate(selectedOrder.completed_at || selectedOrder.lifecycle_deadline_at)}`
                            }
                          </div>
                        )}
                        {selectedOrder.last_customer_email_at && (
                          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>
                            Last customer email: {fmtDate(selectedOrder.last_customer_email_at)}
                          </div>
                        )}
                      </div>
                    )}

                    <div className="detail-section">
                      <h4>Customer</h4>
                      <div className="detail-row">
                        <span className="detail-label">Company</span>
                        <span className="detail-value">{selectedOrder.company_name || selectedOrder.customer_name || '\u2014'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Email</span>
                        <span className="detail-value mono">{selectedOrder.email || '\u2014'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Phone</span>
                        <span className="detail-value mono">{selectedOrder.phone || '\u2014'}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Address</span>
                        <span className="detail-value">{formatAddress(selectedOrder) || '\u2014'}</span>
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
                      <button className="btn" onClick={() => {
                        fetch(`${API_URL}/alerts/check/${selectedOrder.order_id}`, { method: 'POST' })
                          .then(r => r.json())
                          .then(() => { loadOrderAlerts(selectedOrder.order_id); loadAlertSummary() })
                      }}>
                        &#x1F514; Check Alerts
                      </button>
                      {/* Reactivate button for inactive orders */}
                      {selectedOrder.lifecycle_status === 'inactive' && (
                        <button className="btn" style={{ borderColor: '#10b981', color: '#10b981' }}
                          onClick={async () => {
                            try {
                              await fetch(`${API_URL}/lifecycle/extend/${selectedOrder.order_id}`, { method: 'POST' })
                              loadOrders()
                              loadLifecycleSummary()
                              closeDetail()
                            } catch (err) { console.error('Failed to reactivate:', err) }
                          }}
                        >
                          &#x267B; Reactivate Order
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

      {/* ═══ BRAIN CHAT ═══ */}
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
