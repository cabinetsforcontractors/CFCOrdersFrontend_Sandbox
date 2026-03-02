/**
 * App.jsx - Main Application
 * v5.10.0 - AI Config Panel + Dynamic Theming
 * 
 * Orchestrates:
 * - Login/auth
 * - Order loading
 * - Component rendering
 * - Modal management
 * - Comprehensive AI Summary
 * - AI Config Panel (Connie's natural language UI customization)
 */

import { useState, useEffect, useMemo } from 'react'
import StatusBar from './components/StatusBar'
import OrderCard from './components/OrderCard'
import ShippingManager from './components/ShippingManager'
import OrderComments from './components/OrderComments'
import AiConfigPanel from './components/AiConfigPanel'

import { API_URL, APP_PASSWORD } from './config'

// Base status mapping (labels can be overridden by AI config)
const BASE_STATUS_MAP = {
  'needs_payment_link': { label: '1-Need Invoice', class: 'needs-invoice' },
  'awaiting_payment': { label: '2-Awaiting Pay', class: 'awaiting-pay' },
  'needs_warehouse_order': { label: '3-Need to Order', class: 'needs-order' },
  'awaiting_warehouse': { label: '4-At Warehouse', class: 'at-warehouse' },
  'needs_bol': { label: '5-Need BOL', class: 'needs-bol' },
  'awaiting_shipment': { label: '6-Ready Ship', class: 'ready-ship' },
  'complete': { label: 'Complete', class: 'complete' }
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

function App() {
  // Auth state
  const [isLoggedIn, setIsLoggedIn] = useState(false)
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  
  // Data state
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  
  // Filter state
  const [statusFilter, setStatusFilter] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  
  // Modal state
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [shippingModal, setShippingModal] = useState(null)
  
  // Comprehensive AI Summary state
  const [comprehensiveSummary, setComprehensiveSummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)

  // AI Config state
  const [aiConfig, setAiConfig] = useState({})
  
  // Build dynamic STATUS_MAP from base + AI label overrides
  const STATUS_MAP = useMemo(() => {
    const map = { ...BASE_STATUS_MAP }
    if (aiConfig.statusLabels) {
      Object.entries(aiConfig.statusLabels).forEach(([key, label]) => {
        if (map[key] && label) {
          map[key] = { ...map[key], label }
        }
      })
    }
    return map
  }, [aiConfig.statusLabels])

  // Generate dynamic CSS from AI config
  const dynamicCSS = useMemo(() => {
    const parts = []
    
    // Status color overrides
    if (aiConfig.statusColors) {
      Object.entries(aiConfig.statusColors).forEach(([status, color]) => {
        if (!color) return
        const cssClass = BASE_STATUS_MAP[status]?.class
        if (!cssClass) return
        parts.push(`.filter-btn.${cssClass} { border-color: ${color} !important; color: ${color} !important; }`)
        parts.push(`.filter-btn.${cssClass}.active { background-color: ${color} !important; color: #fff !important; }`)
        parts.push(`.status-badge.${cssClass} { background-color: ${color} !important; }`)
        parts.push(`.status-dropdown.${cssClass} { border-color: ${color} !important; color: ${color} !important; }`)
        parts.push(`.order-card.${cssClass} { border-left-color: ${color} !important; }`)
      })
    }
    
    // Header color
    if (aiConfig.headerColor) {
      parts.push(`.app-header { background-color: ${aiConfig.headerColor} !important; }`)
    }
    
    // Accent color
    if (aiConfig.accentColor) {
      parts.push(`button:not(.modal-close):not(.filter-btn) { background-color: ${aiConfig.accentColor} !important; }`)
    }
    
    // Font size
    if (aiConfig.fontSize) {
      parts.push(`body { font-size: ${aiConfig.fontSize} !important; }`)
    }
    
    // Dark theme
    if (aiConfig.theme === 'dark') {
      parts.push(`
        body { background-color: #0f0f23 !important; color: #e0e0e0 !important; }
        .app { background-color: #0f0f23 !important; }
        .app-header { background-color: #1a1a2e !important; }
        .status-bar { background-color: #16213e !important; border-color: #2a2a4a !important; }
        .orders-grid { background-color: #0f0f23 !important; }
        .order-card { background-color: #16213e !important; color: #e0e0e0 !important; border-color: #2a2a4a !important; }
        .order-card:hover { background-color: #1a1a3e !important; }
        .modal { background-color: #16213e !important; color: #e0e0e0 !important; }
        .modal-overlay { background-color: rgba(0,0,0,0.7) !important; }
        .modal-header { background-color: #1a1a2e !important; border-color: #2a2a4a !important; }
        .filter-btn { border-color: #444 !important; }
        input, select, textarea { background-color: #0f3460 !important; color: #e0e0e0 !important; border-color: #2a2a4a !important; }
        .login-form { background-color: #16213e !important; color: #e0e0e0 !important; }
      `)
    }
    
    // Custom CSS pass-through
    if (aiConfig.customCSS) {
      parts.push(aiConfig.customCSS)
    }
    
    return parts.join('\n')
  }, [aiConfig])

  // Handle AI config changes
  const handleConfigChange = (changes) => {
    setAiConfig(prev => {
      const updated = { ...prev }
      
      if (changes.statusColors) {
        updated.statusColors = { ...(prev.statusColors || {}), ...changes.statusColors }
      }
      if (changes.statusLabels) {
        updated.statusLabels = { ...(prev.statusLabels || {}), ...changes.statusLabels }
      }
      if (changes.theme !== undefined && changes.theme !== null) {
        updated.theme = changes.theme
      }
      if (changes.headerColor !== undefined) {
        updated.headerColor = changes.headerColor
      }
      if (changes.fontSize !== undefined) {
        updated.fontSize = changes.fontSize
      }
      if (changes.accentColor !== undefined) {
        updated.accentColor = changes.accentColor
      }
      if (changes.cardStyle !== undefined) {
        updated.cardStyle = changes.cardStyle
      }
      if (changes.customCSS !== undefined) {
        updated.customCSS = changes.customCSS
      }
      
      return updated
    })
  }

  // Check saved login
  useEffect(() => {
    const saved = localStorage.getItem('cfc_logged_in')
    if (saved === 'true') {
      setIsLoggedIn(true)
    }
  }, [])
  
  // Load data when logged in
  useEffect(() => {
    if (isLoggedIn) {
      loadOrders()
    }
  }, [isLoggedIn])
  
  // === AUTH ===
  
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
  
  // === DATA LOADING ===
  
  const loadOrders = async () => {
    setLoading(true)
    try {
      const res = await fetch(`${API_URL}/orders?limit=200&include_complete=true`)
      const data = await res.json()
      if (data.orders) {
        setOrders(data.orders)
      }
    } catch (err) {
      console.error('Failed to load orders:', err)
    }
    setLoading(false)
  }
  
  // === FILTERING ===
  
  const getFilteredOrders = () => {
    let filtered = orders
    
    // Filter by status
    if (statusFilter) {
      filtered = filtered.filter(o => o.current_status === statusFilter)
    } else if (showArchived) {
      // Show ONLY complete/archived orders
      filtered = filtered.filter(o => o.current_status === 'complete')
    } else {
      // Hide complete orders (show active only)
      filtered = filtered.filter(o => o.current_status !== 'complete')
    }
    
    return filtered
  }
  
  // === STATUS UPDATES ===
  
  const updateOrderStatus = async (orderId, field, value) => {
    try {
      await fetch(`${API_URL}/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value })
      })
      loadOrders()
    } catch (err) {
      console.error('Failed to update order:', err)
    }
  }
  
  // === MODALS ===
  
  const openOrderDetail = (order) => {
    setSelectedOrder(order)
    setComprehensiveSummary('') // Reset summary when opening new order
  }
  
  const closeOrderDetail = () => {
    setSelectedOrder(null)
    setComprehensiveSummary('')
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
  
  const closeShippingManager = () => {
    setShippingModal(null)
    loadOrders()
  }
  
  // === COMPREHENSIVE AI SUMMARY ===
  
  const generateComprehensiveSummary = async () => {
    if (!selectedOrder) return
    
    setSummaryLoading(true)
    setComprehensiveSummary('')
    
    try {
      const res = await fetch(`${API_URL}/orders/${selectedOrder.order_id}/comprehensive-summary`, {
        method: 'POST'
      })
      const data = await res.json()
      
      if (data.summary) {
        setComprehensiveSummary(data.summary)
      } else if (data.detail) {
        setComprehensiveSummary(`Error: ${data.detail}`)
      }
    } catch (err) {
      console.error('Failed to generate summary:', err)
      setComprehensiveSummary('Failed to generate summary. Please try again.')
    }
    
    setSummaryLoading(false)
  }
  
  // === HELPER: Format Address ===
  const formatAddress = (order) => {
    const parts = []
    if (order.street) parts.push(order.street)
    
    const cityStateZip = []
    if (order.city) cityStateZip.push(order.city)
    if (order.state) {
      if (order.zip_code) {
        cityStateZip.push(`${order.state} ${order.zip_code}`)
      } else {
        cityStateZip.push(order.state)
      }
    } else if (order.zip_code) {
      cityStateZip.push(order.zip_code)
    }
    
    if (cityStateZip.length > 0) {
      parts.push(cityStateZip.join(', '))
    }
    
    return parts.join(', ')
  }
  
  // === RENDER: LOGIN ===
  
  if (!isLoggedIn) {
    return (
      <>
        <style>{dynamicCSS}</style>
        <div className="login-container">
          <form onSubmit={handleLogin} className="login-form">
            <h2>CFC Orders</h2>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password"
            />
            <button type="submit">Login</button>
            {loginError && <p className="error">{loginError}</p>}
          </form>
        </div>
      </>
    )
  }

  // Gate main app render until orders are ready
  if (loading) {
    return <div className="loading">Loading orders...</div>
  }

  if (!Array.isArray(orders)) {
    return <div className="loading">Loading orders...</div>
  }

  // === RENDER: MAIN APP ===

  const filteredOrders = getFilteredOrders()

  return (
    <div className="app">
      {/* Dynamic CSS from AI Config */}
      <style>{dynamicCSS}</style>
      
      {/* Header */}
      <header className="app-header">
        <h1>CFC Orders <span style={{ fontSize: '11px', fontWeight: 400, opacity: 0.7, marginLeft: '8px' }}>SANDBOX</span></h1>
        <div className="header-actions">
          <button onClick={loadOrders} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </button>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>
      
      {/* Status Filter Bar */}
      <StatusBar 
        orders={orders}
        activeFilter={statusFilter}
        onFilterChange={setStatusFilter}
        showArchived={showArchived}
        onToggleArchived={setShowArchived}
      />
      
      {/* Orders Grid */}
      <main className="orders-grid">
        {loading ? (
          <div className="loading">Loading orders...</div>
        ) : !Array.isArray(filteredOrders) ? (
          <div className="loading">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="empty">No orders found</div>
        ) : (
          filteredOrders.map(order => (
            <OrderCard
              key={order.order_id}
              order={order}
              onOpenDetail={openOrderDetail}
              onOpenShippingManager={(shipment) => openShippingManager(shipment, order)}
              onUpdate={loadOrders}
            />
          ))
        )}
      </main>
      
      {/* Order Detail Modal - Redesigned */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={closeOrderDetail}>
          <div 
            className="modal order-detail-modal" 
            onClick={(e) => e.stopPropagation()} 
            style={{ 
              maxHeight: '90vh', 
              display: 'flex', 
              flexDirection: 'column',
              width: '420px',
              maxWidth: '95vw'
            }}
          >
            {/* Header: Order # and Total */}
            <div className="modal-header" style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              padding: '16px 20px',
              backgroundColor: '#f8f9fa',
              borderBottom: '1px solid #e0e0e0'
            }}>
              <h2 style={{ margin: 0, fontSize: '20px' }}>Order #{selectedOrder.order_id}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <span style={{ fontSize: '18px', fontWeight: 'bold', color: '#28a745' }}>
                  ${parseFloat(selectedOrder.order_total || 0).toFixed(2)}
                </span>
                <button 
                  className="modal-close" 
                  onClick={closeOrderDetail}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    border: 'none',
                    backgroundColor: '#eee',
                    cursor: 'pointer',
                    fontSize: '18px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >×</button>
              </div>
            </div>
            
            <div className="modal-body" style={{ 
              flex: 1, 
              display: 'flex', 
              flexDirection: 'column', 
              overflow: 'hidden',
              padding: '16px'
            }}>
              {/* Order Details Section */}
              <div style={{ 
                border: '1px solid #e0e0e0', 
                borderRadius: '6px', 
                padding: '12px 14px',
                marginBottom: '12px',
                backgroundColor: '#fff'
              }}>
                {/* Row 1: Order Details - Company Name */}
                <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#666', marginBottom: '4px' }}>
                  Order Details - <span style={{ color: '#333', fontWeight: 'normal' }}>{selectedOrder.company_name || selectedOrder.customer_name}</span>
                </div>
                
                {/* Row 2: Address */}
                <div style={{ fontSize: '11px', color: '#666', marginBottom: '8px' }}>
                  {formatAddress(selectedOrder)}
                </div>
                
                {/* Row 3: Date | Days Open */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontSize: '13px', color: '#333' }}>
                    Date: {new Date(selectedOrder.order_date).toLocaleDateString()}
                  </span>
                  <span style={{ fontSize: '13px', color: '#333' }}>
                    Days Open: <strong>{selectedOrder.days_open}</strong>
                  </span>
                </div>
                
                {/* Row 4: Status | Generate AI Summary Button */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#333' }}>
                    Status: {STATUS_MAP[selectedOrder.current_status]?.label || selectedOrder.current_status}
                  </span>
                  <button
                    onClick={generateComprehensiveSummary}
                    disabled={summaryLoading}
                    style={{
                      padding: '5px 10px',
                      backgroundColor: summaryLoading ? '#ccc' : '#28a745',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: summaryLoading ? 'not-allowed' : 'pointer',
                      fontSize: '11px',
                      fontWeight: '500'
                    }}
                  >
                    {summaryLoading ? 'Generating...' : 'Generate AI Summary'}
                  </button>
                </div>
              </div>
              
              {/* AI Analysis Section */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '250px' }}>
                <h3 style={{ margin: '0 0 8px 0', fontSize: '12px', fontWeight: 'bold', color: '#666' }}>
                  AI Analysis
                </h3>
                
                {/* Summary Content Area */}
                <div style={{ 
                  flex: 1, 
                  backgroundColor: '#f8f9fa', 
                  borderRadius: '6px', 
                  padding: '14px',
                  overflow: 'auto',
                  minHeight: '220px'
                }}>
                  {summaryLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ 
                          width: '36px', 
                          height: '36px', 
                          border: '3px solid #e0e0e0',
                          borderTop: '3px solid #28a745',
                          borderRadius: '50%',
                          animation: 'spin 1s linear infinite',
                          margin: '0 auto 12px'
                        }}></div>
                        <p style={{ color: '#666', margin: 0, fontSize: '13px' }}>Generating comprehensive analysis...</p>
                      </div>
                    </div>
                  ) : comprehensiveSummary ? (
                    <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', fontSize: '13px' }}>
                      {comprehensiveSummary}
                    </div>
                  ) : (
                    <div style={{ 
                      display: 'flex', 
                      flexDirection: 'column',
                      alignItems: 'center', 
                      justifyContent: 'center', 
                      height: '100%',
                      color: '#999'
                    }}>
                      <p style={{ margin: 0, textAlign: 'center', fontSize: '13px', lineHeight: '1.6' }}>
                        Click "Generate AI Summary" above to create<br/>
                        a comprehensive AI analysis of this order<br/>
                        including all history and communications.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Shipping Manager Modal */}
      {shippingModal && (
        <div className="modal-overlay shipping-modal-overlay" onClick={closeShippingManager}>
          <div className="modal shipping-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Shipping - {shippingModal.shipment.warehouse}</h2>
              <button className="modal-close" onClick={closeShippingManager}>×</button>
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

      {/* AI Config Panel — Connie's natural language UI customization */}
      <AiConfigPanel
        apiUrl={API_URL}
        onConfigChange={handleConfigChange}
      />
      
      {/* CSS for spinner animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default App
