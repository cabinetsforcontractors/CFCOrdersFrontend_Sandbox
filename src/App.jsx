/**
 * App.jsx - CFC Orders Dashboard
 * v7.9.0 - Add Quotes tab to admin UI with Send Quote Email button
 */

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import ShippingManager from './components/ShippingManager'
import ShipmentRow from './components/ShipmentRow'
import EmailPanel from './components/EmailPanel'
import BrainChat from './components/BrainChat'
import TaskBoard from './components/TaskBoard'

import { API_URL, APP_PASSWORD, IS_SANDBOX, OTHER_ENV_URL, B2BWAVE_ORDER_URL } from './config'
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
  no_action_after_payment:  '\u23f0 NO ACTION \u2014 PAID',
  shipped_no_payment:       '\ud83d\udcb0 SHIPPED \u2014 NO PAYMENT',
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
  const [testHiddenCount, setTestHiddenCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('all')
  const [statusFilter, setStatusFilter] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [sortCol, setSortCol] = useState('order_date')
  const [sortDir, setSortDir] = useState('desc')
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
  const [syncingAI, setSyncingAI] = useState(false)
  const alertsRef = useRef(null)
  const [shippingModal, setShippingModal] = useState(null)
  const [emailOrder, setEmailOrder] = useState(null)
  const [brainOpen, setBrainOpen] = useState(false)
  const [invoiceUrl, setInvoiceUrl] = useState(null)
  const [resendingInvoice, setResendingInvoice] = useState(false)
  const [invoiceCopied, setInvoiceCopied] = useState(false)
  const [notesDraft, setNotesDraft] = useState('')
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [isSavingNotes, setIsSavingNotes] = useState(false)
  const [checkpointLoading, setCheckpointLoading] = useState(null)
  const [pollLoading, setPollLoading] = useState({})
  const [checkpointMsg, setCheckpointMsg] = useState(null)

  // Multi-warehouse LTL quote-all
  const [multiQuoteResults, setMultiQuoteResults] = useState([])
  const [multiQuoteLoading, setMultiQuoteLoading] = useState(false)
  const [liftgateForQuoteAll, setLiftgateForQuoteAll] = useState(false)

  // Quotes tab
  const [quotesData, setQuotesData] = useState([])
  const [quotesLoading, setQuotesLoading] = useState(false)
  const [abandonedCount, setAbandonedCount] = useState(0)
  const [quoteSending, setQuoteSending] = useState(null)

  useEffect(() => { if (localStorage.getItem('cfc_logged_in') === 'true') setIsLoggedIn(true) }, [])
  useEffect(() => { if (isLoggedIn) { loadOrders(); loadAlertSummary() } }, [isLoggedIn])
  useEffect(() => { setNotesDraft(selectedOrder?.notes || ''); setIsEditingNotes(false); setIsSavingNotes(false) }, [selectedOrder?.order_id])

  const handleLogin = (e) => {
    e.preventDefault()
    if (password === APP_PASSWORD) { setIsLoggedIn(true); localStorage.setItem('cfc_logged_in', 'true'); setLoginError('') }
    else setLoginError('Incorrect password')
  }
  const handleLogout = () => { setIsLoggedIn(false); localStorage.removeItem('cfc_logged_in') }

  const loadOrders = useCallback(async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`${API_URL}/orders?limit=200&include_complete=true`)
      const data = await res.json()
      if (data.orders) {
        // Test-order registry (Beat 1): rows flagged is_test never render
        setTestHiddenCount(data.orders.filter(o => o.is_test).length)
        setOrders(data.orders.filter(o => !o.is_test))
      }
    } catch (err) { console.error('Failed to load orders:', err) }
    setLoading(false)
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
    } catch (err) { console.error(err) }
  }

  const runAlertCheck = async () => {
    setCheckingAlerts(true)
    try {
      const res = await apiFetch(`${API_URL}/alerts/check-all`, { method: 'POST' })
      const data = await res.json()
      if (data.success) { loadAllAlerts(); loadAlertSummary() }
    } catch (err) { console.error(err) }
    setCheckingAlerts(false)
  }

  const handleSyncAI = async () => {
    setSyncingAI(true)
    try {
      await apiFetch(`${API_URL}/orders/regenerate-summaries`, { method: 'POST' })
      setTimeout(loadOrders, 3000)
    } catch (err) { console.error('Sync AI failed:', err) }
    setSyncingAI(false)
  }

  const toggleAlerts = () => { if (!alertsOpen) loadAllAlerts(); setAlertsOpen(v => !v) }

  useEffect(() => {
    const handleClickOutside = (e) => { if (alertsRef.current && !alertsRef.current.contains(e.target)) setAlertsOpen(false) }
    if (alertsOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [alertsOpen])

  // Load quotes when quotes tab is selected
  useEffect(() => {
    if (activeTab !== 'quotes') return
    const loadQuotes = async () => {
      setQuotesLoading(true)
      try {
        const res = await apiFetch(`${API_URL}/quotes/list`)
        const data = await res.json()
        if (data.quotes) setQuotesData(data.quotes)
      } catch (err) { console.error('Failed to load quotes:', err) }
      setQuotesLoading(false)
    }
    const loadAbandonedCarts = async () => {
      try {
        const res = await apiFetch(`${API_URL}/quotes/abandoned-carts`)
        const data = await res.json()
        if (data.count !== undefined) setAbandonedCount(data.count)
      } catch (err) { console.error('Failed to load abandoned carts:', err) }
    }
    loadQuotes()
    loadAbandonedCarts()
  }, [activeTab])

  const sendQuoteEmail = async (orderId) => {
    setQuoteSending(orderId)
    try {
      const res = await apiFetch(`${API_URL}/quotes/${orderId}/send`, { method: 'POST' })
      const data = await res.json()
      if (data.success) {
        setQuotesData(prev => prev.map(q => q.order_id === orderId ? { ...q, quote_sent: true } : q))
      }
    } catch (err) { console.error('Failed to send quote:', err) }
    setQuoteSending(null)
  }

  const handleSaveNotes = async () => {
    if (!selectedOrder) return
    setIsSavingNotes(true)
    try {
      await apiFetch(`${API_URL}/orders/${selectedOrder.order_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: notesDraft })
      })
      apiFetch(`${API_URL}/orders/${selectedOrder.order_id}/generate-summary?force=true`, { method: 'POST' }).catch(() => {})
      setIsEditingNotes(false)
      setSelectedOrder(prev => ({ ...prev, notes: notesDraft }))
      loadOrders()
    } catch (err) { alert('Failed to save notes') }
    setIsSavingNotes(false)
  }

  const handleResendInvoice = async () => {
    if (!selectedOrder) return
    setResendingInvoice(true); setInvoiceUrl(null)
    try {
      const res = await apiFetch(`${API_URL}/webhook/b2bwave-order`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: selectedOrder.order_id, customer_email: selectedOrder.email })
      })
      const data = await res.json()
      if (data.checkout_url) setInvoiceUrl(data.checkout_url)
    } catch (err) { console.error(err) }
    setResendingInvoice(false)
  }

  const handleCopyInvoiceUrl = () => {
    if (!invoiceUrl) return
    navigator.clipboard.writeText(invoiceUrl)
    setInvoiceCopied(true)
    setTimeout(() => setInvoiceCopied(false), 2000)
  }

  // ==========================================================================
  // WORKFLOW CHECKPOINT
  // ==========================================================================
  const handleCheckpoint = async (checkpoint) => {
    if (!selectedOrder) return
    setCheckpointLoading(checkpoint)
    setCheckpointMsg(null)
    try {
      const res = await apiFetch(`${API_URL}/orders/${selectedOrder.order_id}/checkpoint`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpoint, source: 'web_ui' })
      })
      const data = await res.json()
      if (data.status === 'ok') {
        setSelectedOrder(prev => ({ ...prev, [checkpoint]: true }))
        // Show poll confirmation if warehouse was notified
        if (checkpoint === 'sent_to_warehouse' && data.supplier_polls?.length) {
          const count = data.supplier_polls.filter(p => p.poll_sent).length
          setCheckpointMsg(`\u2705 Sent to warehouse. Poll email sent to ${count} supplier(s).`)
        } else {
          setCheckpointMsg(`\u2705 ${checkpoint.replace(/_/g, ' ')} marked.`)
        }
        loadOrders()
      } else {
        setCheckpointMsg(`\u26a0\ufe0f ${data.detail || 'Checkpoint update failed'}`)
      }
    } catch (err) {
      setCheckpointMsg(`\u26a0\ufe0f ${err.message}`)
    }
    setCheckpointLoading(null)
    setTimeout(() => setCheckpointMsg(null), 5000)
  }

  // Quote all shipments via LTL auto-quote in sequence
  const handleQuoteAllLTL = async () => {
    if (!selectedOrder?.shipments?.length) return
    setMultiQuoteLoading(true)
    setMultiQuoteResults([])

    const results = []
    for (const shipment of selectedOrder.shipments) {
      const result = { warehouse: shipment.warehouse, shipment_id: shipment.shipment_id }
      try {
        const rlRes = await apiFetch(`${API_URL}/shipments/${shipment.shipment_id}/rl-quote-data`)
        const rlData = await rlRes.json()
        if (rlData.status !== 'ok') throw new Error(rlData.message || 'Failed to load quote data')

        result.weight = rlData.weight?.value
        result.weight_note = rlData.weight?.note
        result.origin_zip = rlData.origin_zip
        result.is_residential = rlData.is_residential !== false

        if (!rlData.weight?.value) {
          result.error = rlData.weight?.note || 'No weight available'
          results.push(result)
          continue
        }

        const payload = {
          origin_zip: rlData.origin_zip || '',
          dest_street: rlData.destination?.street || '',
          dest_city: rlData.destination?.city || '',
          dest_state: rlData.destination?.state || '',
          dest_zipcode: rlData.destination?.zip || '',
          weight: rlData.weight.value,
          freight_class: '85',
          customer_markup: 50.00,
          liftgate_required: result.is_residential ? false : liftgateForQuoteAll,
        }

        const quoteRes = await apiFetch(`${API_URL}/proxy/auto-quote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
        const quoteData = await quoteRes.json()

        if (quoteData.success) {
          result.carrier_price = quoteData.carrier_price
          result.customer_price = quoteData.customer_price
          result.quote_number = quoteData.quote_number
          result.service_days = quoteData.service_days
          result.is_residential = quoteData.is_residential
          result.success = true
        } else {
          result.error = 'Quote returned no price'
        }
      } catch (err) {
        result.error = err.message || 'Error'
      }
      results.push(result)
    }

    setMultiQuoteResults(results)
    setMultiQuoteLoading(false)
  }

  const counts = useMemo(() => {
    const c = {}
    STATUSES.forEach(s => { c[s.key] = 0 })
    orders.forEach(o => { if (c[o.current_status] !== undefined) c[o.current_status]++ })
    return c
  }, [orders])

  const lifecycleCounts = useMemo(() => {
    let allActive = 0, inactive = 0, done = 0
    orders.forEach(o => {
      if (o.current_status === 'complete') done++
      else if (o.lifecycle_status === 'inactive') inactive++
      else allActive++
    })
    return { allActive, inactive, done, allNonDone: allActive + inactive }
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
    setMultiQuoteResults([])
    setMultiQuoteLoading(false)
    setLiftgateForQuoteAll(false)
    setCheckpointMsg(null)
    loadOrderAlerts(order.order_id)
  }
  const closeDetail = () => { setSelectedOrder(null); setComprehensiveSummary(''); setOrderAlerts([]); setMultiQuoteResults([]) }

  const generateSummary = async () => {
    if (!selectedOrder) return
    setSummaryLoading(true); setComprehensiveSummary('')
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
        email: order?.email || '',
        orderWeight: order?.total_weight || ''
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

  const hasCommercialShipments = selectedOrder?.shipments?.some(s => s.is_residential === false) || false

  const renderMarkdown = (text) => {
    if (!text) return ''
    const lines = text.split('\n')
    let html = '', inList = false
    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('## ')) {
        if (inList) { html += '</ul>'; inList = false }
        html += `<h4 style="color:var(--accent);margin:12px 0 6px">${trimmed.slice(3)}</h4>`
      } else if (/^[-*]\s/.test(trimmed)) {
        if (!inList) { html += '<ul style="margin:4px 0;padding-left:20px">'; inList = true }
        html += `<li>${trimmed.slice(2).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</li>`
      } else if (/^\d+\.\s/.test(trimmed)) {
        if (inList) { html += '</ul>'; inList = false }
        html += `<div style="margin:2px 0">${trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</div>`
      } else if (trimmed === '') {
        if (inList) { html += '</ul>'; inList = false }
        html += '<br/>'
      } else {
        if (inList) { html += '</ul>'; inList = false }
        html += `<div>${trimmed.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')}</div>`
      }
    }
    if (inList) html += '</ul>'
    return html
  }

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
  const multiQuoteTotal = multiQuoteResults.reduce((sum, r) => sum + (r.customer_price || 0), 0)

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
                    <div className="alerts-empty"><span style={{ fontSize: '24px' }}>&#x2705;</span><span>All clear</span></div>
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
                              <button className="alert-resolve-btn" onClick={(e) => { e.stopPropagation(); resolveAlert(alert.id) }}>&#x2713;</button>
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

          <button onClick={handleSyncAI} disabled={syncingAI} title="Regenerate AI summaries for all active orders"
            style={{ background: syncingAI ? 'rgba(124,58,237,0.06)' : 'rgba(124,58,237,0.08)', borderColor: 'rgba(124,58,237,0.3)', color: '#7c3aed' }}>
            {syncingAI ? '\u27f3 Syncing...' : '\u{1F9E0} Sync AI'}
          </button>

          <button onClick={() => setBrainOpen(v => !v)} title="Brain Chat"
            style={{ background: brainOpen ? 'rgba(124,58,237,0.12)' : undefined, borderColor: brainOpen ? '#7c3aed' : undefined, color: brainOpen ? '#7c3aed' : undefined }}>
            &#x1F9E0; Brain
          </button>
          <button onClick={() => window.open(OTHER_ENV_URL, '_blank')}
            style={{ background: IS_SANDBOX ? 'rgba(5,150,105,0.08)' : 'rgba(217,119,6,0.08)', borderColor: IS_SANDBOX ? 'rgba(5,150,105,0.3)' : 'rgba(217,119,6,0.3)', color: IS_SANDBOX ? 'var(--success)' : 'var(--warning)' }}>
            {IS_SANDBOX ? '\u{1F7E2} Open Live' : '\u{1F9EA} Open Sandbox'}
          </button>
          <button onClick={() => { loadOrders(); loadAlertSummary() }} disabled={loading}>{loading ? '...' : '\u{21BB} Refresh'}</button>
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
                const s = STATUS_MAP[key]; const isActive = statusFilter === key
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
              <span style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px' }} />
              <button className={`tab-btn${activeTab === 'quotes' ? ' active' : ''}`} onClick={() => handleTabClick('quotes')}
                style={activeTab === 'quotes' ? { backgroundColor: 'rgba(59,130,246,0.10)', borderColor: '#3b82f6', color: '#3b82f6' } : {}}>
                Quotes {abandonedCount > 0 && <span className="tab-count">{abandonedCount} carts</span>}
              </button>
              <span style={{ width: '1px', height: '24px', background: 'var(--border)', margin: '0 4px' }} />
              <button className={`tab-btn${activeTab === 'tasks' ? ' active' : ''}`} onClick={() => handleTabClick('tasks')}
                style={activeTab === 'tasks' ? { backgroundColor: 'rgba(16,185,129,0.10)', borderColor: '#10b981', color: '#10b981' } : {}}>
                Tasks
              </button>
            </div>
            <div className="tab-actions">
              {testHiddenCount > 0 && (
                <span style={{ color: 'var(--muted, #888)', fontSize: '12px', marginRight: '10px' }}
                  title="Registered test/noise orders are hidden everywhere. Manage via GET/POST /test-orders.">
                  {testHiddenCount} test orders hidden
                </span>
              )}
              {statusFilter && <button className="btn btn-sm" onClick={() => setStatusFilter(null)}>Clear filter</button>}
            </div>
          </div>

          {activeTab === 'tasks' ? (
            <TaskBoard />
          ) : activeTab === 'quotes' ? (
            <div style={{ padding: '16px 0' }}>
              {quotesLoading ? (
                <div className="empty">Loading quotes...</div>
              ) : quotesData.length === 0 ? (
                <div className="empty">No quotes found</div>
              ) : (
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Customer</th>
                      <th>Company</th>
                      <th>Total</th>
                      <th>Products</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quotesData.map(q => (
                      <tr key={q.order_id}>
                        <td><span className="order-id">#{q.order_id}</span></td>
                        <td>{q.customer_name || q.email || '\u2014'}</td>
                        <td>{q.company_name || '\u2014'}</td>
                        <td>{fmtMoney(q.order_total)}</td>
                        <td style={{ maxWidth: '250px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {(q.products || []).map(p => p.name || p.sku).join(', ') || '\u2014'}
                        </td>
                        <td>
                          <button
                            className="btn btn-sm"
                            disabled={quoteSending === q.order_id || q.quote_sent}
                            onClick={() => sendQuoteEmail(q.order_id)}
                            style={q.quote_sent ? { backgroundColor: 'rgba(5,150,105,0.12)', color: '#059669', borderColor: 'rgba(5,150,105,0.3)' } : {}}
                          >
                            {quoteSending === q.order_id ? 'Sending...' : q.quote_sent ? '\u2705 Sent' : 'Send Quote Email'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          ) : filteredOrders.length === 0 ? (
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
                  const orderWarehouses = [...new Set((order.shipments || []).map(s => s.warehouse).filter(Boolean))]
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
                        {order.is_pickup && (
                          <span style={{ display: 'inline-block', marginLeft: '4px', background: 'rgba(5,150,105,0.12)', color: '#059669', border: '1px solid rgba(5,150,105,0.3)', borderRadius: '4px', fontSize: '10px', fontWeight: '700', padding: '1px 5px', verticalAlign: 'middle' }}>PICKUP</span>
                        )}
                        {alertLabel && <div style={{ fontSize: '10px', fontWeight: '700', color: order.alert_level === 'critical' ? '#DC2626' : '#D97706', marginTop: '3px' }}>{alertLabel}</div>}
                      </td>
                      <td>
                        <div className="customer-name">{order.company_name || order.customer_name || '\u2014'}</div>
                        {order.city && <div className="customer-company">{order.city}{order.state ? `, ${order.state}` : ''}</div>}
                        {order.comments && (
                          <div className="comments-block">
                            <strong>Customer:</strong> {order.comments.length > 80 ? order.comments.slice(0, 80) + '\u2026' : order.comments}
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
                          <div style={{ fontSize: '11px', color: 'var(--text-dim)', fontWeight: '600' }}>Total: ${(orderTotal + shipping.charge).toFixed(2)}</div>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-dim)', fontSize: '12px' }}>{fmtDate(order.order_date)}</td>
                      <td><span className={`age-cell ${ageClass}`}>{days}d</span></td>
                      <td>{orderWarehouses.map(w => <span key={w} className="warehouse-tag" style={{display:'block',marginBottom:'2px'}}>{w}</span>)}</td>
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
                  {selectedOrder.is_pickup && (
                    <span style={{ marginLeft: '8px', background: 'rgba(5,150,105,0.12)', color: '#059669', border: '1px solid rgba(5,150,105,0.3)', borderRadius: '4px', fontSize: '10px', fontWeight: '700', padding: '2px 6px' }}>PICKUP</span>
                  )}
                </h3>
                <button className="panel-close" onClick={closeDetail}>{'\u00D7'}</button>
              </div>

              <div className="panel-tabs">
                <button className={`panel-tab${panelTab === 'details' ? ' active' : ''}`} onClick={() => setPanelTab('details')}>Details</button>
                <button className={`panel-tab${panelTab === 'fullanalysis' ? ' active' : ''}`} onClick={() => setPanelTab('fullanalysis')}>Full Analysis</button>
                <button className={`panel-tab${panelTab === 'actions' ? ' active' : ''}`} onClick={() => setPanelTab('actions')}>Actions</button>
              </div>

              <div className="panel-content">
                {panelTab === 'details' && (
                  <>
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

                    {selectedOrder.ai_summary && (
                      <div className="detail-section" style={{ background: '#F8F7FF', border: '1px solid #DDD6FE', borderLeft: '4px solid #7C3AED', borderRadius: '0 6px 6px 0', padding: '12px 14px', marginBottom: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <h4 style={{ margin: 0, color: '#7C3AED', fontSize: '10px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>&#x1F9E0; AI State Summary</h4>
                          <button className="btn btn-sm" style={{ fontSize: '10px', padding: '2px 8px', borderColor: '#DDD6FE', color: '#7C3AED' }} onClick={() => setPanelTab('ai')}>Full analysis &#x2192;</button>
                        </div>
                        <div style={{ fontSize: '12px', color: 'var(--text)', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{selectedOrder.ai_summary}</div>
                      </div>
                    )}

                    {selectedOrder.comments && (
                      <div className="detail-section">
                        <h4>Customer Comments</h4>
                        <div style={{ background: '#FFF7ED', border: '1px solid #FCD34D', borderLeft: '4px solid #F59E0B', borderRadius: '0 6px 6px 0', padding: '10px 12px', fontSize: '13px', color: '#92400E', lineHeight: '1.5' }}>{selectedOrder.comments}</div>
                      </div>
                    )}

                    <div className="detail-section">
                      <h4>Customer</h4>
                      <div className="detail-row"><span className="detail-label">Company</span><span className="detail-value">{selectedOrder.company_name || selectedOrder.customer_name || '\u2014'}</span></div>
                      <div className="detail-row"><span className="detail-label">Email</span><span className="detail-value mono">{selectedOrder.email || '\u2014'}</span></div>
                      <div className="detail-row"><span className="detail-label">Phone</span><span className="detail-value mono">{selectedOrder.phone || '\u2014'}</span></div>
                      <div className="detail-row"><span className="detail-label">Address</span><span className="detail-value">{formatAddress(selectedOrder) || '\u2014'}</span></div>
                    </div>

                    <div className="detail-section">
                      <h4>Order Info</h4>
                      <div className="detail-row"><span className="detail-label">Status</span><span className={`status-badge ${STATUS_MAP[selectedOrder.current_status]?.badge || ''}`}><span className="status-dot" />{STATUS_MAP[selectedOrder.current_status]?.label || selectedOrder.current_status}</span></div>
                      <div className="detail-row"><span className="detail-label">Date</span><span className="detail-value">{fmtDate(selectedOrder.order_date)}</span></div>
                      <div className="detail-row"><span className="detail-label">Days Open</span><span className="detail-value mono">{selectedOrder.days_open || 0}</span></div>
                      <div className="detail-row"><span className="detail-label">Subtotal</span><span className="detail-value mono" style={{ color: 'var(--success)' }}>{fmtMoney(selectedOrder.order_total)}</span></div>
                      <div className="detail-row"><span className="detail-label">Payment</span><span className="detail-value" style={{ color: selectedOrder.payment_received ? 'var(--success)' : 'var(--text-dim)' }}>{selectedOrder.payment_received ? '\u2705 Received' : '\u23f3 Pending'}</span></div>
                      {selectedOrder.payment_received && selectedOrder.payment_amount && (
                        <div className="detail-row"><span className="detail-label">Paid Amount</span><span className="detail-value mono">{fmtMoney(selectedOrder.payment_amount)}</span></div>
                      )}
                      <a href={`${B2BWAVE_ORDER_URL}/${selectedOrder.order_id}`} target="_blank" rel="noopener noreferrer" className="btn btn-sm" style={{ fontSize: '11px', marginTop: '6px' }}>\ud83d\udd17 View in B2BWave</a>
                    </div>

                    {selectedOrder.shipments?.length > 0 && (
                      <div className="detail-section">
                        <h4>Shipments</h4>
                        {selectedOrder.shipments.map((s, i) => (
                          <ShipmentRow key={s.shipment_id || i} shipment={s} order={selectedOrder} onOpenShippingManager={openShippingManager} onUpdate={loadOrders} />
                        ))}
                      </div>
                    )}

                    <div className="detail-section">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <h4 style={{ margin: 0 }}>Internal Notes</h4>
                        {!isEditingNotes && <button className="btn btn-sm" onClick={() => setIsEditingNotes(true)} style={{ fontSize: '11px' }}>{selectedOrder.notes ? 'Edit' : '+ Add Note'}</button>}
                      </div>
                      {isEditingNotes ? (
                        <div style={{ background: '#FAF5FF', border: '1px solid #D8B4FE', borderRadius: '8px', padding: '10px' }}>
                          <textarea value={notesDraft} onChange={e => setNotesDraft(e.target.value)} placeholder="Add internal notes..." rows={4}
                            style={{ width: '100%', padding: '6px 8px', border: '1px solid #D8B4FE', borderRadius: '6px', background: '#fff', color: 'var(--text)', fontFamily: 'inherit', fontSize: '13px', resize: 'vertical', outline: 'none', marginBottom: '8px' }} />
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button className="btn btn-sm btn-primary" onClick={handleSaveNotes} disabled={isSavingNotes}>{isSavingNotes ? 'Saving...' : 'Save'}</button>
                            <button className="btn btn-sm" onClick={() => { setIsEditingNotes(false); setNotesDraft(selectedOrder.notes || '') }}>Cancel</button>
                          </div>
                        </div>
                      ) : selectedOrder.notes ? (
                        <div style={{ background: '#FAF5FF', border: '1px solid #E9D5FF', borderRadius: '8px', padding: '10px', fontSize: '13px', color: 'var(--text)', lineHeight: '1.5', whiteSpace: 'pre-wrap' }}>{selectedOrder.notes}</div>
                      ) : (
                        <div style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic' }}>No notes yet</div>
                      )}
                    </div>

                    <div className="detail-section">
                      <h4>Change Status</h4>
                      <select value={selectedOrder.current_status}
                        onChange={async (e) => {
                          const val = e.target.value
                          if (val === 'complete' && !confirm('Move order #' + selectedOrder.order_id + ' to Done?')) { e.target.value = selectedOrder.current_status; return }
                          try {
                            await apiFetch(`${API_URL}/orders/${selectedOrder.order_id}/set-status?status=${val}`, { method: 'PATCH' })
                            setSelectedOrder({ ...selectedOrder, current_status: val })
                            loadOrders()
                          } catch (err) { console.error('Status update failed:', err) }
                        }}
                        style={{ width: '100%', padding: '8px 10px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text)', fontFamily: 'inherit', fontSize: '13px' }}>
                        {STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                      </select>
                    </div>
                  </>
                )}

                {panelTab === 'fullanalysis' && (
                  <div className="detail-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <h4 style={{ margin: 0 }}>Full AI Analysis</h4>
                      <button className="btn btn-primary btn-sm" onClick={generateSummary} disabled={summaryLoading}>{summaryLoading ? 'Generating...' : 'Generate'}</button>
                    </div>
                    <div style={{ background: 'var(--bg-input)', borderRadius: '8px', padding: '16px', minHeight: '200px', border: '1px solid var(--border)' }}>
                      {summaryLoading ? (
                        <div style={{ textAlign: 'center', paddingTop: '40px' }}>
                          <div style={{ width: '32px', height: '32px', border: '3px solid var(--border)', borderTop: '3px solid var(--accent)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 12px' }} />
                          <div style={{ color: 'var(--text-dim)', fontSize: '13px' }}>Analyzing order data...</div>
                        </div>
                      ) : comprehensiveSummary ? (
                        <div style={{ lineHeight: '1.7', fontSize: '13px', color: 'var(--text)' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(comprehensiveSummary) }} />
                      ) : selectedOrder.ai_summary ? (
                        <>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '8px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Current 6-Bullet State Summary</div>
                          <div style={{ lineHeight: '1.7', fontSize: '13px', color: 'var(--text)' }} dangerouslySetInnerHTML={{ __html: renderMarkdown(selectedOrder.ai_summary) }} />
                          <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--border)' }} />
                          <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>Click Generate for a full historical analysis</div>
                        </>
                      ) : (
                        <div style={{ textAlign: 'center', paddingTop: '50px', color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.8' }}>Click Generate for a comprehensive AI analysis.</div>
                      )}
                    </div>
                  </div>
                )}

                {panelTab === 'actions' && (
                  <div className="detail-section">
                    <h4>Quick Actions</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <button className="btn" onClick={() => setEmailOrder(selectedOrder)}>&#x2709; Send Email</button>
                      <button className="btn" onClick={handleResendInvoice} disabled={resendingInvoice} style={{ borderColor: '#6366f1', color: '#6366f1' }}>
                        {resendingInvoice ? '\u23f3 Sending Invoice...' : '\ud83d\udcc4 Send Invoice + PDF'}
                      </button>
                      {invoiceUrl && (
                        <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 12px', fontSize: '12px' }}>
                          <div style={{ color: 'var(--text-dim)', marginBottom: '6px' }}>Checkout URL:</div>
                          <div style={{ wordBreak: 'break-all', color: 'var(--text)', marginBottom: '8px', fontFamily: 'monospace', fontSize: '11px' }}>{invoiceUrl}</div>
                          <button className="btn btn-sm" onClick={handleCopyInvoiceUrl} style={{ borderColor: 'var(--success)', color: invoiceCopied ? 'var(--success)' : undefined }}>
                            {invoiceCopied ? '\u2705 Copied!' : '\ud83d\udccb Copy Link'}
                          </button>
                          <button className="btn btn-sm" onClick={() => { navigator.clipboard.writeText(invoiceUrl + (invoiceUrl.includes('?') ? '&' : '?') + 'view=quote'); }} style={{ borderColor: '#6366f1', color: '#6366f1', marginLeft: '6px' }}>\ud83d\udccb Copy Quote Link</button>
                        </div>
                      )}

                      {/* ================================================ */}
                      {/* WORKFLOW CHECKPOINTS */}
                      {/* ================================================ */}
                      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '10px', marginTop: '2px' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
                          Workflow Checkpoints
                        </div>

                        {/* Payment Received \u2014 only if not yet received */}
                        {!selectedOrder.payment_received && (
                          <button className="btn" style={{ borderColor: '#059669', color: '#059669', marginBottom: '6px', width: '100%' }}
                            onClick={() => handleCheckpoint('payment_received')}
                            disabled={checkpointLoading === 'payment_received'}>
                            {checkpointLoading === 'payment_received' ? '\u23f3 Marking...' : '\u2705 Mark Payment Received'}
                          </button>
                        )}

                        {/* Per-shipment send-poll buttons (replaces single sent_to_warehouse) */}
                        {selectedOrder.shipments && selectedOrder.shipments.filter(sh => !sh.supplier_poll_1_sent_at).map(sh => (
                          <button key={sh.shipment_id} className="btn" style={{ borderColor: '#2196f3', color: '#2196f3', fontWeight: '700', marginBottom: '6px', width: '100%' }}
                            onClick={async () => {
                              setPollLoading(prev => ({ ...prev, [sh.shipment_id]: 'loading' }))
                              try {
                                const res = await apiFetch(`${API_URL}/supplier/${sh.shipment_id}/send-poll`, { method: 'POST' })
                                if (!res.ok) throw new Error('Poll failed')
                                setPollLoading(prev => ({ ...prev, [sh.shipment_id]: 'done' }))
                                loadOrders(); if (selectedOrder) openDetail(selectedOrder)
                              } catch (err) { setPollLoading(prev => ({ ...prev, [sh.shipment_id]: 'error' })); console.error(err) }
                            }}
                            disabled={pollLoading[sh.shipment_id] === 'loading'}>
                            {pollLoading[sh.shipment_id] === 'loading' ? '\u23f3 Sending...' : pollLoading[sh.shipment_id] === 'done' ? '\u2705 Sent' : `\ud83d\udce6 Send to Warehouse: ${sh.warehouse}`}
                          </button>
                        ))}

                        {/* Warehouse Confirmed \u2014 manual fallback if supplier didn't click */}
                        {selectedOrder.sent_to_warehouse && !selectedOrder.warehouse_confirmed && (
                          <button className="btn" style={{ borderColor: '#9c27b0', color: '#9c27b0', marginBottom: '6px', width: '100%' }}
                            onClick={() => handleCheckpoint('warehouse_confirmed')}
                            disabled={checkpointLoading === 'warehouse_confirmed'}>
                            {checkpointLoading === 'warehouse_confirmed' ? '\u23f3 Marking...' : '\u2705 Warehouse Confirmed (manual)'}
                          </button>
                        )}

                        {/* Mark Complete */}
                        {selectedOrder.bol_sent && !selectedOrder.is_complete && (
                          <button className="btn" style={{ borderColor: '#607d8b', color: '#607d8b', marginBottom: '6px', width: '100%' }}
                            onClick={() => handleCheckpoint('is_complete')}
                            disabled={checkpointLoading === 'is_complete'}>
                            {checkpointLoading === 'is_complete' ? '\u23f3 Marking...' : '\u2705 Mark Complete'}
                          </button>
                        )}

                        {/* Checkpoint feedback message */}
                        {checkpointMsg && (
                          <div style={{ background: checkpointMsg.startsWith('\u26a0\ufe0f') ? '#FFF3CD' : '#D1FAE5', border: `1px solid ${checkpointMsg.startsWith('\u26a0\ufe0f') ? '#FCD34D' : '#6EE7B7'}`, borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: checkpointMsg.startsWith('\u26a0\ufe0f') ? '#92400E' : '#065F46', marginTop: '4px' }}>
                            {checkpointMsg}
                          </div>
                        )}
                      </div>

                      {/* Liftgate toggle */}
                      {selectedOrder.shipments?.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid var(--border)', paddingTop: '10px' }}>
                          {hasCommercialShipments && (
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '6px', padding: '8px 10px', fontSize: '13px', color: '#1E40AF', fontWeight: '500' }}>
                              <input type="checkbox" checked={liftgateForQuoteAll} onChange={e => setLiftgateForQuoteAll(e.target.checked)} style={{ width: '15px', height: '15px', cursor: 'pointer' }} />
                              \ud83c\udfe2 Destination liftgate required (no dock)
                            </label>
                          )}
                          <button className="btn" onClick={handleQuoteAllLTL} disabled={multiQuoteLoading} style={{ borderColor: '#0ea5e9', color: '#0ea5e9', fontWeight: '600' }}>
                            {multiQuoteLoading ? '\u23f3 Quoting...' : '\u26a1 Quote All Warehouses (LTL)'}
                          </button>
                        </div>
                      )}

                      {/* Multi-quote results */}
                      {multiQuoteResults.length > 0 && (
                        <div style={{ background: 'var(--bg-input)', border: '1px solid #0ea5e9', borderRadius: '8px', padding: '12px', fontSize: '13px' }}>
                          <div style={{ fontWeight: '700', color: '#0ea5e9', marginBottom: '10px', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                            \u26a1 LTL Quotes \u2014 All Warehouses
                          </div>
                          {multiQuoteResults.map((r, i) => (
                            <div key={r.shipment_id || i} style={{ marginBottom: i < multiQuoteResults.length - 1 ? '10px' : 0, paddingBottom: i < multiQuoteResults.length - 1 ? '10px' : 0, borderBottom: i < multiQuoteResults.length - 1 ? '1px solid var(--border)' : 'none' }}>
                              <div style={{ fontWeight: '600', marginBottom: '4px' }}>
                                {r.warehouse}
                                {r.is_residential === false && <span style={{ marginLeft: '6px', fontSize: '11px', color: '#1E40AF', background: '#EFF6FF', padding: '1px 5px', borderRadius: '3px' }}>\ud83c\udfe2 Commercial</span>}
                              </div>
                              {r.error ? (
                                <div style={{ color: 'var(--danger)', fontSize: '12px' }}>\u26a0\ufe0f {r.error}</div>
                              ) : (
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px', fontSize: '12px', color: 'var(--text-dim)' }}>
                                  <span>Weight:</span><span style={{ color: 'var(--text)', fontWeight: '600' }}>{r.weight} lbs</span>
                                  <span>Carrier (R+L NET):</span><span style={{ color: 'var(--text)', fontWeight: '600' }}>${r.carrier_price?.toFixed(2)}</span>
                                  <span>Customer (+$50):</span><span style={{ color: 'var(--success)', fontWeight: '700' }}>${r.customer_price?.toFixed(2)}</span>
                                  {r.quote_number && <><span>Quote #:</span><span style={{ color: 'var(--text)', fontFamily: 'monospace' }}>{r.quote_number}</span></>}
                                  {r.service_days && <><span>Transit:</span><span style={{ color: 'var(--text)' }}>{r.service_days} days</span></>}
                                </div>
                              )}
                            </div>
                          ))}
                          {multiQuoteTotal > 0 && (
                            <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '2px solid #0ea5e9', display: 'flex', justifyContent: 'space-between', fontWeight: '700', fontSize: '13px' }}>
                              <span>Total Shipping (customer):</span>
                              <span style={{ color: 'var(--success)' }}>${multiQuoteTotal.toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Per-warehouse shipping manager */}
                      {selectedOrder.shipments?.length > 0 && selectedOrder.shipments.map((s, i) => (
                        <button key={s.shipment_id || i} className="btn" onClick={() => openShippingManager(s, selectedOrder)}>\ud83d\ude9a Ship: {s.warehouse}</button>
                      ))}

                      <button className="btn btn-danger" onClick={async () => { if (confirm('Mark order #' + selectedOrder.order_id + ' as Done?')) { await apiFetch(`${API_URL}/orders/${selectedOrder.order_id}/set-status?status=complete`, { method: 'PATCH' }); closeDetail(); loadOrders() } }}>Done</button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <BrainChat isOpen={brainOpen} onClose={() => setBrainOpen(false)} />
      {emailOrder && <EmailPanel orderId={emailOrder.order_id} customerEmail={emailOrder.email} onClose={() => setEmailOrder(null)} onSent={handleEmailSent} />}

      {shippingModal && (
        <div className="modal-overlay shipping-modal-overlay" onClick={closeShippingManager}>
          <div className="modal shipping-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Shipping \u2014 {shippingModal.shipment.warehouse}</h2>
              <button className="modal-close" onClick={closeShippingManager}>{'\u00D7'}</button>
            </div>
            <div className="modal-body">
              <ShippingManager shipment={shippingModal.shipment} orderId={shippingModal.orderId} customerInfo={shippingModal.customerInfo} onClose={closeShippingManager} onUpdate={loadOrders} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
