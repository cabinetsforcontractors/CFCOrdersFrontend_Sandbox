/**
 * App.jsx - CFC Orders Dashboard
 * v7.3.0 - Notes inline, customer comments, ShipmentRow inline, profit tracking,
 *           AI summary on Details tab, alert backgrounds + labels, light theme
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import ShippingManager from './components/ShippingManager'
import ShipmentRow from './components/ShipmentRow'
import EmailPanel from './components/EmailPanel'
import BrainChat from './components/BrainChat'

import { API_URL, APP_PASSWORD, IS_SANDBOX, OTHER_ENV_URL } from './config'
import { apiFetch } from './api'

const STATUSES = [
  { key: 'needs_payment_link',    label: 'Need Invoice',   short: 'Invoice',   badge: 'sb-invoice',   card: 'mc-invoice' },
  { key: 'awaiting_payment',      label: 'Awaiting Pay',   short: 'Pay',       badge: 'sb-pay',       card: 'mc-pay' },
  { key: 'needs_warehouse_order', label: 'Need to Order',  short: 'Order',     badge: 'sb-order',     card: 'mc-order' },
  { key: 'awaiting_warehouse',    label: 'At Warehouse',   short: 'Warehouse', badge: 'sb-warehouse', card: 'mc-warehouse' },
  { key: 'needs_bol',             label: 'Need BOL',       short: 'BOL',       badge: 'sb-bol',       card: 'mc-bol' },
  { key: 'awaiting_shipment',     label: 'Ready Ship',     short: 'Ship',      badge: 'sb-ship',      card: 'mc-ship' },
  { key: 'complete',              label: 'Complete',       short: 'Done',      badge: 'sb-complete',  card: 'mc-complete' },
]

const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.key, s]))
const ACTIVE_STATUS_KEYS = STATUSES.filter(s => s.key !== 'complete').map(s => s.key)

const ALERT_LABELS = {
  needs_invoice:            { label: 'Needs Invoice',            icon: '\ud83d\udccb' },
  awaiting_payment_long:    { label: 'Awaiting Payment',         icon: '\ud83d\udcb0' },
  needs_warehouse_order:    { label: 'Needs Warehouse Order',    icon: '\ud83c\udfed' },
  at_warehouse_long:        { label: 'At Warehouse Too Long',    icon: '\u23f3' },
  needs_bol:                { label: 'Needs BOL',                icon: '\ud83d\udcc4' },
  ready_ship_long:          { label: 'Ready to Ship Too Long',   icon: '\ud83d\ude9b' },
  tracking_not_sent:        { label: 'Tracking Not Sent',        icon: '\ud83d\udcec' },
  delivery_confirm_needed:  { label: 'Needs Delivery Confirm',   icon: '\u2705' },
}

const ALERT_TYPE_LABELS = {
  out_of_stock:             '\u26a0\ufe0f OUT OF STOCK',
  backorder:                '\u26a0\ufe0f BACKORDER',
  inventory_issue:          '\u26a0\ufe0f INVENTORY ISSUE',
  no_action_after_payment:  '\u23f0 NO ACTION — PAID',
  shipped_no_payment:       '\ud83d\udcb0 SHIPPED — NO PAYMENT',
  no_response:              '\ud83d\udce7 NO WAREHOUSE RESPONSE',
  not_available:            '\u26a0\ufe0f NOT AVAILABLE',
  discontinued:             '\u26a0\ufe0f DISCONTINUED',
}

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

// Calculate shipping totals + profit for an order
const getShippingTotals = (order) => {
  return (order.shipments || []).reduce((acc, s) => {
    const charge = Number(s.rl_customer_price) || Number(s.li_customer_price) || Number(s.customer_price) || Number(s.ps_quote_price) || 0
    const cost   = Number(s.rl_quote_price)    || Number(s.li_quote_price)    || Number(s.quote_price)    || Number(s.ps_quote_price) || 0
    acc.charge += charge
    acc.profit += charge - cost
    return acc
  }, { charge: 0, profit: 0 })
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [statusFilter, setStatusFilter] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortCol, setSortCol] = useState('order_date')
  const [sortDir, setSortDir] = useState('desc')
  const [lifecycleSummary, setLifecycleSummary] = useState({ active: 0, inactive: 0, canceled: 0, total: 0 })
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [panelTab, setPanelTab] = useState('details')
  const [comprehensiveSummary, setComprehensiveSummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [alertSummary, setAlertSummary] = useState({ total_unresolved: 0, by_type: {} })
  const [allAlerts, setAllAlerts] = useState([])
  const [alertsOpen, setAlertsOpen] = useState(false)
  const [alertsLoading, setAlertsLoading] = useState(false)
  const [orderAlerts, setOrderAlerts] = useState([])
  const [checkingAlerts, setCheckingAlerts] = useState(false)
  const alertsRef = useRef(null)
  const [shippingModal, setShippingModal] = useState(null)
  const [emailOrder, setEmailOrder] = useState(null)
  const [brainOpen, setBrainOpen] = useState(false)

  // Invoice / resend state
  const [invoiceUrl, setInvoiceUrl] = useState(null)
  const [resendingInvoice, setResendingInvoice] = useState(false)
  const [invoiceCopied, setInvoiceCopied] = useState(false)

  // Notes inline editing (detail panel)
  const [notesDraft, setNotesDraft] = useState('')
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [isSavingNotes, setIsSavingNotes] = useState(false)

  useEffect(() => {
    if (localStorage.getItem('cfc_logged_in') === 'true') setIsLoggedIn(true)
  }, [])

  useEffect(() => {
    if (isLoggedIn) { loadOrders(); loadAlertSummary(); loadLifecycleSummary() }
  }, [isLoggedIn])

  // Reset notes state when selected order changes
  useEffect(() => {
    setNotesDraft(selectedOrder?.notes || '')
    setIsEditingNotes(false)
    setIsSavingNotes(false)
  }, [selectedOrder?.order_id])

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

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`${API_URL}/orders?limit=200&include_complete=true`)
      const data = await res.json()
      if (data.orders) setOrders(data.orders)
    } catch (err) { console.error('Failed to load orders:', err) }
    setLoading(false)
  }, [])

  const loadLifecycleSummary = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_URL}/lifecycle/summary`)
      const data = await res.json()
      if (data.success !== false) setLifecycleSummary({ active: data.active || 0, inactive: data.inactive || 0, canceled: data.canceled || 0, total: data.total || 0 })
    } catch (err) { console.log('Lifecycle summary not available:', err.message) }
  }, [])

  const loadAlertSummary = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_URL}/alerts/summary`)
      const data = await res.json()
      if (data.success) setAlertSummary({ total_unresolved: data.total_unresolved, by_type: data.by_type })
    } catch (err) { console.error('Failed to load alert summary:', err) }
  }, [])

  const loadAllAlerts = useCallback(async () => {
    setAlertsLoading(true)
    try {
      const res = await apiFetch(`${API_URL}/alerts/`)
      const data = await res.json()
      if (data.success) setAllAlerts(data.alerts || [])
    } catch (err) { console.error('Failed to load alerts:', err) }
    setAlertsLoading(false)
  }, [])

  const loadOrderAlerts = useCallback(async (orderId) => {
    try {
      const res = await apiFetch(`${API_URL}/alerts/?order_id=${orderId}`)
      const data = await res.json()
      if (data.success) setOrderAlerts(data.alerts || [])
    } catch (err) { setOrderAlerts([]) }
  }, [])

  const resolveAlert = async (alertId) => {
    try {
      const res = await apiFetch(`${API_URL}/alerts/${alertId}/resolve`, { method: 'POST' })
      const data = await res.json()
      if (data.success) { loadAllAlerts(); loadAlertSummary(); if (selectedOrder) loadOrderAlerts(selectedOrder.order_id) }
    } catch (err) { console.error('Failed to resolve alert:', err) }
  }

  const runAlertCheck = async () => {
    setCheckingAlerts(true)
    try {
      const res = await apiFetch(`${API_URL}/alerts/check-all`, { method: 'POST' })
      const data = await res.json()
      if (data.success) { loadAllAlerts(); loadAlertSummary() }
    } catch (err) { console.error('Failed to run alert check:', err) }
    setCheckingAlerts(false)
  }

  const toggleAlerts = () => { if (!alertsOpen) loadAllAlerts(); setAlertsOpen(v => !v) }

  useEffect(() => {
    const handleClickOutside = (e) => { if (alertsRef.current && !alertsRef.current.contains(e.target)) setAlertsOpen(false) }
    if (alertsOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [alertsOpen])

  // Notes save — also triggers AI summary refresh
  const handleSaveNotes = async () => {
    if (!selectedOrder) return
    setIsSavingNotes(true)
    try {
      await apiFetch(`${API_URL}/orders/${selectedOrder.order_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesDraft })
      })
      // Refresh AI summary after note change
      apiFetch(`${API_URL}/orders/${selectedOrder.order_id}/generate-summary?force=true`, { method: 'POST' }).catch(() => {})
      setIsEditingNotes(false)
      setSelectedOrder(prev => ({ ...prev, notes: notesDraft }))
      loadOrders()
    } catch (err) { alert('Failed to save notes') }
    setIsSavingNotes(false)
  }

  // Invoice resend
  const handleResendInvoice = async () => {
    if (!selectedOrder) return
    setResendingInvoice(true)
    setInvoiceUrl(null)
    try {
      const res = await apiFetch(`${API_URL}/webhook/b2bwave-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedOrder.order_id, customer_email: selectedOrder.email })
      })
      const data = await res.json()
      if (data.checkout_url) setInvoiceUrl(data.checkout_url)
    } catch (err) { console.error('Failed to resend invoice:', err) }
    setResendingInvoice(false)
  }

  const handleCopyInvoiceUrl = () => {
    if (!invoiceUrl) return
    navigator.clipboard.writeText(invoiceUrl)
    setInvoiceCopied(true)
    setTimeout(() => setInvoiceCopied(false), 2000)
  }

  const counts = useMemo(() => {
    const c = {}
    STATUSES.forEach(s => { c[s.key] = 0 })
    orders.forEach(o => { if (c[o.current_status] !== undefined) c[o.current_status]++ })
    return c
  }, [orders])

  const lifecycleCounts = useMemo(() => {
    let allActive = 0, inactive = 0, done = 0, canceledInDone = 0
    orders.forEach(o => {
      if (o.current_status === 'complete') { done++; if (o.lifecycle_status === 'canceled') canceledInDone++ }
      else if (o.lifecycle_status === 'inactive') inactive++
      else allActive++
    })
    return { allActive, inactive, done, canceledInDone, allNonDone: allActive + inactive }
  }, [orders])

  const filteredOrders = useMemo(() => {
    let list = orders
    if (activeTab === 'done') list = list.filter(o => o.current_status === 'complete')
    else if (activeTab === 'inactive') list = list.filter(o => o.current_status !== 'complete' && o.lifecycle_status === 'inactive')
    else list = list.filter(o => o.current_status !== 'complete')
    if (statusFilter) list = list.filter(o => o.current_status === statusFilter)
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
    list = [...list].sort((a, b) => {
      let av = a[sortCol], bv = b[sortCol]
      if (sortCol === 'order_total' || sortCol === 'days_open') { av = parseFloat(av || 0); bv = parseFloat(bv || 0) }
      else { av = String(av || '').toLowerCase(); bv = String(bv || '').toLowerCase() }
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })
    return list
  }, [orders, activeTab, statusFilter, searchQuery, sortCol, sortDir])

  const alertsByType = useMemo(() => {
    const grouped = {}
    allAlerts.forEach(a => { if (!grouped[a.alert_type]) grouped[a.alert_type] = []; grouped[a.alert_type].push(a) })
    return grouped
  }, [allAlerts])

  const handleSort = (col) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortCol(col); setSortDir('asc') }
  }

  const handleMetricClick = (key) => {
    if (key === 'complete') { setActiveTab('done'); setStatusFilter(null) }
    else { if (activeTab === 'done') setActiveTab('all'); setStatusFilter(statusFilter === key ? null : key) }
  }

  const handleTabClick = (tab) => { setActiveTab(tab); setStatusFilter(null) }

  const openDetail = (order) => {
    setSelectedOrder(order)
    setPanelTab('details')
    setComprehensiveSummary('')
    setInvoiceUrl(null)
    setInvoiceCopied(false)
    loadOrderAlerts(order.order_id)
  }

  const closeDetail = () => { setSelectedOrder(null); setComprehensiveSummary(''); setOrderAlerts([]) }

  const generateSummary = async () => {
    if (!selectedOrder) return
    setSummaryLoading(true)
    setComprehensiveSummary('')
    try {
      const res = await apiFetch(`${API_URL}/orders/${selectedOrder.order_id}/comprehensive-summary`, { method: 'POST' })
      const data = await res.json()
      setComprehensiveSummary(data.summary || data.detail || 'No summary returned.')
    } catch (err) { setComprehensiveSummary('Failed to generate summary.') }
    setSummaryLoading(false)
  }

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
  const handleEmailSent = () => { setEmailOrder(null); loadOrders() }

  const updateStatus = async (orderId, value) => {
    try {
      await apiFetch(`${API_URL}/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_status: value })
      })
      loadOrders()
    } catch (err) { console.error('Failed to update:', err) }
  }

  const handleContentAreaClick = () => { if (selectedOrder) closeDetail() }

  if (!isLoggedIn) {
    return (
      <div className="login-container">
        <form className="login-form" onSubmit={handleLogin}>
          <h2>CFC Orders</h2>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter password" />
          <button type="submit">Login</button>
          {loginError && <p className="error">{loginError}</p>}
        </form>
      </div>
    )
  }

  if (loading && orders.length === 0) return <div className="loading">Loading orders...</div>

  const totalAlerts = alertSummary.total_unresolved || 0

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <h1>CFC <span>Orders</span></h1>
          {IS_SANDBOX && <span className="env-badge env-sandbox">SANDBOX</span>}
        </div>
        <div className="header-actions">
          <div className="search-box">
            <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>&#x1F50D;</span>
            <input type="text" placeholder="Search orders..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>

          <div className="alerts-trigger-wrap" ref={alertsRef}>
            <button onClick={toggleAlerts} className={`alerts-bell-btn${totalAlerts > 0 ? ' has-alerts' : ''}${alertsOpen ? ' active' : ''}`} title={`${totalAlerts} unresolved alerts`}>
              &#x1F514;
              {totalAlerts > 0 && <span className="alerts-badge-count">{totalAlerts}</span>}
            </button>
            {alertsOpen && (
              <div className="alerts-dropdown">
                <div className="alerts-dropdown-header">
                  <div className="alerts-dropdown-title">
                    <span style={{ fontSize: '16px' }}>&#x26A0;&#xFE0F;</span>
                    <span>{totalAlerts} Unresolved Alert{totalAlerts !== 1 ? 's' : ''}</span>
                  </div>
                  <button className="btn btn-sm btn-primary" onClick={runAlertCheck} disabled={checkingAlerts}>
                    {checkingAlerts ? '\u27f3 Checking...' : '\u27f3 Run Check'}
                  </button>
                </div>
                <div className="alerts-dropdown-body">
                  {alertsLoading ? (
                    <div className="alerts-loading">Loading alerts...</div>
                  ) : allAlerts.length === 0 ? (
                    <div className="alerts-empty"><span style={{ fontSize: '24px' }}>&#x2705;</span><span>All clear — no unresolved alerts</span></div>
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
                                <span className="alert-order-link" onClick={(e) => { e.stopPropagation(); const o = orders.find(o => o.order_id === alert.order_id); if (o) { openDetail(o); setAlertsOpen(false) } }}>#{alert.order_id}</span>
                                <span className="alert-message">{alert.alert_message}</span>
                                <span className="alert-time">{fmtDateTime(alert.created_at)}</span>
                              </div>
                              <button className="alert-resolve-btn" onClick={(e) => { e.stopPropagation(); resolveAlert(alert.id) }} title="Resolve">&#x2713;</button>
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

          <button onClick={() => setBrainOpen(v => !v)} title="Brain Chat"
            style={{ background: brainOpen ? 'rgba(124,58,237,0.12)' : undefined, borderColor: brainOpen ? '#7c3aed' : undefined, color: brainOpen ? '#7c3aed' : undefined }}>
            &#x1F9E0; Brain
          </button>

          <button onClick={() => window.open('/sort_order_review.html', '_blank')} title="WS17 Sort Order Review"
            style={{ background: 'rgba(5,150,105,0.08)', borderColor: 'rgba(5,150,105,0.3)', color: '#059669' }}>
            &#x1F4CA; Sort Review
          </button>

          <button onClick={() => window.open(OTHER_ENV_URL, '_blank')}
            style={{ background: IS_SANDBOX ? 'rgba(5,150,105,0.08)' : 'rgba(217,119,6,0.08)', borderColor: IS_SANDBOX ? 'rgba(5,150,105,0.3)' : 'rgba(217,119,6,0.3)', color: IS_SANDBOX ? 'var(--success)' : 'var(--warning)' }}>
            {IS_SANDBOX ? '\u{1F7E2} Open Live' : '\u{1F9EA} Open Sandbox'}
          </button>
          <button onClick={() => { loadOrders(); loadAlertSummary(); loadLifecycleSummary() }} disabled={loading}>
            {loading ? '...' : '\u{21BB} Refresh'}
          </button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      <div className="main-content">
        <div className={`content-area${selectedOrder ? ' panel-open' : ''}`} onClick={handleContentAreaClick}>

          <div className="metrics-row">
            {STATUSES.map(s => (
              <div key={s.key} className={`metric-card ${s.card}${statusFilter === s.key || (s.key === 'complete' && activeTab === 'done') ? ' active' : ''}`} onClick={() => handleMetricClick(s.key)}>
                <div className="metric-count">{counts[s.key]}</div>
                <div className="metric-label">{s.short}</div>
              </div>
            ))}
          </div>

          <div className="tabs-row">
            <div className="tabs">
              <button className={`tab-btn${activeTab === 'all' && !statusFilter ? ' active' : ''}`} onClick={() => handleTabClick('all')}>
                All <span className="tab-count">{lifecycleCounts.allNonDone}</span>
              </button>
              <button className={`tab-btn tab-inactive${activeTab === 'inactive' ? ' active' : ''}`} onClick={() => handleTabClick('inactive')}
                style={activeTab === 'inactive' ? { backgroundColor: 'rgba(217,119,6,0.10)', borderColor: '#d97706', color: '#d97706' } : { borderColor: 'rgba(217,119,6,0.3)', color: '#d97706' }}>
                Inactive <span className="tab-count">{lifecycleCounts.inactive}</span>
              </button>
              <span style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px' }} />
              {ACTIVE_STATUS_KEYS.map(key => {
                const s = STATUS_MAP[key]
                const isActive = statusFilter === key
                return (
                  <button key={key} className={`tab-btn${isActive ? ' active' : ''}`}
                    onClick={() => { if (activeTab === 'done') setActiveTab('all'); setStatusFilter(isActive ? null : key) }}>
                    {s.short} <span className="tab-count">{counts[key]}</span>
                  </button>
                )
              })}
              <span style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px' }} />
              <button className={`tab-btn tab-done${activeTab === 'done' ? ' active' : ''}`} onClick={() => handleTabClick('done')}
                style={activeTab === 'done' ? { backgroundColor: 'rgba(107,114,128,0.10)', borderColor: '#6b7280', color: '#6b7280' } : {}}>
                Done <span className="tab-count">{lifecycleCounts.done}</span>
              </button>
            </div>
            <div className="tab-actions">
              {statusFilter && <button className="btn btn-sm" onClick={() => setStatusFilter(null)}>Clear filter</button>}
            </div>
          </div>

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
                  const wh = order.shipments?.[0]?.warehouse || ''
                  const alertBg = order.alert_level === 'critical' ? '#FFF1F1' : order.alert_level === 'warning' ? '#FFFBEB' : undefined
                  const alertLabel = order.alert_type ? ALERT_TYPE_LABELS[order.alert_type] : null
                  const shipping = getShippingTotals(order)
                  const orderTotal = parseFloat(order.order_total || 0)

                  return (
                    <tr key={order.order_id}
                      style={{ backgroundColor: isSelected ? undefined : alertBg }}
                      className={`${isSelected ? 'row-selected' : ''}${isCanceled ? ' row-canceled' : ''}${isInactive ? ' row-inactive' : ''}`}
                      onClick={(e) => { e.stopPropagation(); openDetail(order) }}
                    >
                      <td>
                        <span className="order-id">#{order.order_id}</span>
                        {isCanceled && <span className="canceled-badge">CANCELED</span>}
                        {isInactive && activeTab !== 'inactive' && <span className="inactive-badge">INACTIVE</span>}
                        {order.payment_received && (
                          <span style={{ display: 'inline-block', marginLeft: '4px', background: 'rgba(5,150,105,0.12)', color: '#059669', border: '1px solid rgba(5,150,105,0.3)', borderRadius: '4px', fontSize: '10px', fontWeight: '700', padding: '1px 5px', verticalAlign: 'middle' }}>PAID</span>
                        )}
                        {alertLabel && (
                          <div style={{ fontSize: '10px', fontWeight: '700', color: order.alert_level === 'critical' ? '#DC2626' : '#D97706', marginTop: '3px' }}>{alertLabel}</div>
                        )}
                      </td>
                      <td>
                        <div className="customer-name">{order.company_name || order.customer_name || '\u2014'}</div>
                        {order.city && <div className="customer-company">{order.city}{order.state ? `, ${order.state}` : ''}</div>}
                        {order.comments && (
                          <div className="comments-block" style={{ marginTop: '4px' }}>
                            <strong>Customer:</strong> {order.comments.length > 80 ? order.comments.slice(0, 80) + '…' : order.comments}
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`status-badge ${st.badge || ''}`}>
                          <span className="status-dot" />{st.label || order.current_status}
                        </span>
                      </td>
                      <td>
                        <div className="amount">{fmtMoney(order.order_total)}</div>
                        {shipping.charge > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px' }}>
                            Ship: ${shipping.charge.toFixed(2)}
                            {shipping.profit !== 0 && (
                              <span style={{ marginLeft: '4px', color: shipping.profit >= 0 ? 'var(--success)' : 'var(--danger)', fontWeight: '600' }}>
                                ({shipping.profit >= 0 ? '+' : ''}${shipping.profit.toFixed(2)})
                              </span>
                            )}
                          </div>
                        )}
                        {shipping.charge > 0 && orderTotal > 0 && (
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '600' }}>
                            Total: ${(orderTotal + shipping.charge).toFixed(2)}
                          </div>
                        )}
                      </td>
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

        {/* ====== DETAIL PANEL ====== */}
        <div className={`detail-panel${selectedOrder ? ' open' : ''}`}>
          {selectedOrder && (
            <>
              <div className="panel-header">
                <h3>
                  <span className="order-id">#{selectedOrder.order_id}</span>
                  <span className="amount" style={{ marginLeft: '8px' }}>{fmtMoney(selectedOrder.order_total)}</span>
                  {selectedOrder.lifecycle_status === 'canceled' && <span className="canceled-badge" style={{ marginLeft: '8px' }}>CANCELED</span>}
                  {selectedOrder.lifecycle_status === 'inactive' && <span className="inactive-badge" style={{ marginLeft: '8px' }}>INACTIVE</span>}
                  {selectedOrder.payment_received && (
                    <span style={{ marginLeft: '8px', background: 'rgba(5,150,105,0.12)', color: '#059669', border: '1px solid rgba(5,150,105,0.3)', borderRadius: '4px', fontSize: '10px', fontWeight: '700', padding: '2px 6px' }}>PAID</span>
                  )}
                </h3>
                <button className="panel-close" onClick={closeDetail}>{'\u00D7'}</button>
              </div>

              <div className="panel-tabs">
                <button className={`panel-tab${panelTab === 'details' ? ' active' : ''}`} onClick={() => setPanelTab('details')}>Details</button>
                <button className={`panel-tab${panelTab === 'ai' ? ' active' : ''}`} onClick={() => setPanelTab('ai')}>AI Summary</button>
                <button className={`panel-tab${panelTab === 'actions' ? ' active' : ''}`} onClick={() => setPanelTab('actions')}>Actions</button>
              </div>

              <div className="panel-content">
                {panelTab === 'details' && (
                  <>
                    {/* Alert section */}
                    {orderAlerts.length > 0 && (
                      <div className="detail-section order-alerts-section">
                        <h4>&#x26A0;&#xFE0F; Active Alerts ({orderAlerts.length})</h4>
                        {orderAlerts.map(alert => {
                          const meta = ALERT_LABELS[alert.alert_type] || { label: alert.alert_type, icon: '\u26a0\ufe0f' }
                          return (
                            <div key={alert.id} className="order-alert-card">
                              <div className="order-alert-info">
                                <div className="order-alert-type"><span>{meta.icon}</span><span>{meta.label}</span></div>
                                <div className="order-alert-msg">{alert.alert_message}</div>
                                <div className="order-alert-time">{fmtDateTime(alert.created_at)}</div>
                              </div>
                              <button className="btn btn-sm alert-resolve-inline" onClick={() => resolveAlert(alert.id)}>&#x2713; Resolve</button>
                            </div>
                          )
                        })}
                      </div>
                    )}

                    {/* Lifecycle warning */}
                    {(selectedOrder.lifecycle_status === 'inactive' || selectedOrder.lifecycle_status === 'canceled') && (
                      <div className="detail-section" style={{ background: selectedOrder.lifecycle_status === 'canceled' ? 'rgba(220,38,38,0.06)' : 'rgba(217,119,6,0.06)', border: `1px solid ${selectedOrder.lifecycle_status === 'canceled' ? 'rgba(220,38,38,0.25)' : 'rgba(217,119,6,0.25)'}`, borderRadius: '8px', padding: '12px' }}>
                        <h4 style={{ color: selectedOrder.lifecycle_status === 'canceled' ? '#DC2626' : '#D97706', margin: '0 0 8px 0' }}>
                          {selectedOrder.lifecycle_status === 'canceled' ? '\u274c Canceled' : '\u23f8\ufe0f Inactive'}
                        </h4>
                        {selectedOrder.lifecycle_deadline_at && (
                          <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>
                            {selectedOrder.lifecycle_status === 'inactive' ? `Will be canceled: ${fmtDate(selectedOrder.lifecycle_deadline_at)}` : `Canceled: ${fmtDate(selectedOrder.completed_at || selectedOrder.lifecycle_deadline_at)}`}
                          </div>
                        )}
                        {selectedOrder.last_customer_email_at && (
                          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px' }}>Last customer email: {fmtDate(selectedOrder.last_customer_email_at)}</div>
                        )}
                      </div>
                    )}

                    {/* Customer comments */}
                    {selectedOrder.comments && (
                      <div className="detail-section">
                        <h4>Customer Comments</h4>
                        <div style={{ background: '#FFF7ED', border: '1px solid #FCD34D', borderLeft: '4px solid #F59E0B', borderRadius: '0 6px 6px 0', padding: '10px 12px', fontSize: '13px', color: '#92400E', lineHeight: '1.5' }}>
                          {selectedOrder.comments}
                        </div>
                      </div>
                    )}

                    {/* Customer info */}
                    <div className="detail-section">
                      <h4>Customer</h4>
                      <div className="detail-row"><span className="detail-label">Company</span><span className="detail-value">{selectedOrder.company_name || selectedOrder.customer_name || '\u2014'}</span></div>
                      <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value mono">{selectedOrder.email || '\u2014'}</span></div>
                      <div className="detail-row"><span className="detail-label">Phone</span><span className="detail-value mono">{selectedOrder.phone || '\u2014'}</span></div>
                      <div className="detail-row"><span className="detail-label">Address</span><span className="detail-value">{formatAddress(selectedOrder) || '\u2014'}</span></div>
                    </div>

                    {/* Order info */}
                    <div className="detail-section">
                      <h4>Order Info</h4>
                      <div className="detail-row">
                        <span className="detail-label">Status</span>
                        <span className={`status-badge ${STATUS_MAP[selectedOrder.current_status]?.badge || ''}`}>
                          <span className="status-dot" />{STATUS_MAP[selectedOrder.current_status]?.label || selectedOrder.current_status}
                        </span>
                      </div>
                      <div className="detail-row"><span className="detail-label">Date</span><span className="detail-value">{fmtDate(selectedOrder.order_date)}</span></div>
                      <div className="detail-row"><span className="detail-label">Days Open</span><span className="detail-value mono">{selectedOrder.days_open || 0}</span></div>
                      <div className="detail-row"><span className="detail-label">Subtotal</span><span className="detail-value mono" style={{ color: 'var(--success)' }}>{fmtMoney(selectedOrder.order_total)}</span></div>
                      <div className="detail-row">
                        <span className="detail-label">Payment</span>
                        <span className="detail-value" style={{ color: selectedOrder.payment_received ? 'var(--success)' : 'var(--text-dim)' }}>
                          {selectedOrder.payment_received ? '✅ Received' : '⏳ Pending'}
                        </span>
                      </div>
                      {selectedOrder.payment_received && selectedOrder.payment_amount && (
                        <div className="detail-row"><span className="detail-label">Paid Amount</span><span className="detail-value mono">{fmtMoney(selectedOrder.payment_amount)}</span></div>
                      )}
                      {selectedOrder.payment_received && selectedOrder.payment_received_at && (
                        <div className="detail-row"><span className="detail-label">Paid At</span><span className="detail-value" style={{ fontSize: '12px' }}>{fmtDateTime(selectedOrder.payment_received_at)}</span></div>
                      )}
                    </div>

                    {/* Shipments */}
                    {selectedOrder.shipments?.length > 0 && (
                      <div className="detail-section">
                        <h4>Shipments</h4>
                        {selectedOrder.shipments.map((s, i) => (
                          <ShipmentRow
                            key={s.shipment_id || i}
                            shipment={s}
                            order={selectedOrder}
                            onOpenShippingManager={openShippingManager}
                            onUpdate={loadOrders}
                          />
                        ))}
                      </div>
                    )}

                    {/* Notes */}
                    <div className="detail-section">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h4 style={{ margin: 0 }}>Internal Notes</h4>
                        {!isEditingNotes && (
                          <button className="btn btn-sm" onClick={() => setIsEditingNotes(true)} style={{ fontSize: '11px' }}>
                            {selectedOrder.notes ? 'Edit' : '+ Add Note'}
                          </button>
                        )}
                      </div>
                      {isEditingNotes ? (
                        <div style={{ background: '#FAF5FF', border: '1px solid #D8B4FE', borderRadius: '8px', padding: '10px' }}>
                          <textarea
                            value={notesDraft}
                            onChange={e => setNotesDraft(e.target.value)}
                            placeholder="Add internal notes..."
                            rows={4}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #D8B4FE', borderRadius: '6px', background: '#fff', color: 'var(--text)', fontFamily: 'inherit', fontSize: '13px', resize: 'vertical', outline: 'none', marginBottom: '8px' }}
                          />
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn btn-sm btn-primary" onClick={handleSaveNotes} disabled={isSavingNotes}>
                              {isSavingNotes ? 'Saving...' : 'Save'}
                            </button>
                            <button className="btn btn-sm" onClick={() => { setIsEditingNotes(false); setNotesDraft(selectedOrder.notes || '') }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : selectedOrder.notes ? (
                        <div style={{ background: '#FAF5FF', border: '1px solid #E9D5FF', borderRadius: '8px', padding: '10px', fontSize: '13px', color: 'var(--text)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>
                          {selectedOrder.notes}
                        </div>
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>No notes yet</div>
                      )}
                    </div>

                    {/* AI Summary snippet */}
                    {selectedOrder.ai_summary && (
                      <div className="detail-section">
                        <h4>AI Summary</h4>
                        <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderLeft: '3px solid var(--accent)', borderRadius: '0 6px 6px 0', padding: '10px 12px', fontSize: '12px', color: 'var(--text-dim)', lineHeight: '1.6', whiteSpace: 'pre-wrap', maxHeight: '120px', overflow: 'hidden', position: 'relative' }}>
                          {selectedOrder.ai_summary.slice(0, 300)}{selectedOrder.ai_summary.length > 300 ? '…' : ''}
                        </div>
                        <button className="btn btn-sm" style={{ marginTop: '6px', fontSize: '11px' }} onClick={() => setPanelTab('ai')}>View full AI analysis →</button>
                      </div>
                    )}

                    {/* Change status */}
                    <div className="detail-section">
                      <h4>Change Status</h4>
                      <select
                        value={selectedOrder.current_status}
                        onChange={e => { updateStatus(selectedOrder.order_id, e.target.value); setSelectedOrder({ ...selectedOrder, current_status: e.target.value }) }}
                        style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontFamily: 'inherit', fontSize: '13px' }}
                      >
                        {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {panelTab === 'ai' && (
                  <div className="detail-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <h4 style={{ margin: 0 }}>AI Analysis</h4>
                      <button className="btn btn-primary btn-sm" onClick={generateSummary} disabled={summaryLoading}>
                        {summaryLoading ? 'Generating...' : 'Generate Summary'}
                      </button>
                    </div>
                    <div style={{ background: 'var(--bg-input)', borderRadius: '8px', padding: '16px', minHeight: '200px', border: '1px solid var(--border)' }}>
                      {summaryLoading ? (
                        <div style={{ textAlign: 'center', paddingTop: '40px' }}>
                          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTop: '3px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                          <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>Analyzing order data...</div>
                        </div>
                      ) : comprehensiveSummary ? (
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '13px', color: 'var(--text)' }}>{comprehensiveSummary}</div>
                      ) : selectedOrder.ai_summary ? (
                        <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '13px', color: 'var(--text)' }}>{selectedOrder.ai_summary}</div>
                      ) : (
                        <div style={{ textAlign: 'center', paddingTop: '50px', color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.8' }}>
                          Click "Generate Summary" for a comprehensive<br />AI analysis of this order.
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {panelTab === 'actions' && (
                  <div className="detail-section">
                    <h4>Quick Actions</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button className="btn" onClick={() => setEmailOrder(selectedOrder)}>&#x2709; Send Email</button>

                      <button className="btn" onClick={handleResendInvoice} disabled={resendingInvoice}
                        style={{ borderColor: '#6366f1', color: '#6366f1' }}>
                        {resendingInvoice ? '⏳ Sending Invoice...' : '📄 Send Invoice + PDF'}
                      </button>

                      {invoiceUrl && (
                        <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 12px', fontSize: '12px' }}>
                          <div style={{ color: 'var(--text-dim)', marginBottom: '6px' }}>Invoice / Checkout URL:</div>
                          <div style={{ wordBreak: 'break-all', color: 'var(--text)', marginBottom: '8px', fontFamily: 'monospace', fontSize: '11px' }}>{invoiceUrl}</div>
                          <button className="btn btn-sm" onClick={handleCopyInvoiceUrl} style={{ borderColor: 'var(--success)', color: invoiceCopied ? 'var(--success)' : undefined }}>
                            {invoiceCopied ? '✅ Copied!' : '📋 Copy Link'}
                          </button>
                        </div>
                      )}

                      {selectedOrder.shipments?.length > 0 && (
                        <button className="btn" onClick={() => openShippingManager(selectedOrder.shipments[0], selectedOrder)}>&#x1F69A; Shipping Manager</button>
                      )}
                      <button className="btn" onClick={() => {
                        apiFetch(`${API_URL}/alerts/check/${selectedOrder.order_id}`, { method: 'POST' })
                          .then(r => r.json())
                          .then(() => { loadOrderAlerts(selectedOrder.order_id); loadAlertSummary() })
                      }}>&#x1F514; Check Alerts</button>
                      {selectedOrder.lifecycle_status === 'inactive' && (
                        <button className="btn" style={{ borderColor: 'var(--success)', color: 'var(--success)' }}
                          onClick={async () => {
                            try { await apiFetch(`${API_URL}/lifecycle/extend/${selectedOrder.order_id}`, { method: 'POST' }); loadOrders(); loadLifecycleSummary(); closeDetail() }
                            catch (err) { console.error('Failed to reactivate:', err) }
                          }}>&#x267B; Reactivate Order</button>
                      )}
                      <button className="btn btn-danger" onClick={() => { if (confirm('Archive this order?')) updateStatus(selectedOrder.order_id, 'complete') }}>Archive Order</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <BrainChat isOpen={brainOpen} onClose={() => setBrainOpen(false)} />

      {emailOrder && (
        <EmailPanel orderId={emailOrder.order_id} customerEmail={emailOrder.email} onClose={() => setEmailOrder(null)} onSent={handleEmailSent} />
      )}

      {shippingModal && (
        <div className="modal-overlay shipping-modal-overlay" onClick={closeShippingManager}>
          <div className="modal shipping-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Shipping — {shippingModal.shipment.warehouse}</h2>
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
