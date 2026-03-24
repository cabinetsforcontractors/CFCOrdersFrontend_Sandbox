/**
 * App.jsx - Main Application
 * v5.10.0 - No login required, X-Admin-Token header fix
 */

import { useState, useEffect } from 'react'
import StatusBar from './components/StatusBar'
import OrderCard from './components/OrderCard'
import ShippingManager from './components/ShippingManager'
import OrderComments from './components/OrderComments'

import { API_URL } from './config'

const ADMIN_TOKEN = 'CFC2026'

const STATUS_MAP = {
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
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState(null)
  const [showArchived, setShowArchived] = useState(false)
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [shippingModal, setShippingModal] = useState(null)
  const [comprehensiveSummary, setComprehensiveSummary] = useState('')
  const [summaryLoading, setSummaryLoading] = useState(false)

  useEffect(() => {
    loadOrders()
  }, [])

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

  const getFilteredOrders = () => {
    let filtered = orders
    if (statusFilter) {
      filtered = filtered.filter(o => o.current_status === statusFilter)
    } else if (showArchived) {
      filtered = filtered.filter(o => o.current_status === 'complete')
    } else {
      filtered = filtered.filter(o => o.current_status !== 'complete')
    }
    return filtered
  }

  const updateOrderStatus = async (orderId, field, value) => {
    try {
      await fetch(`${API_URL}/orders/${orderId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Token': ADMIN_TOKEN
        },
        body: JSON.stringify({ [field]: value })
      })
      loadOrders()
    } catch (err) {
      console.error('Failed to update order:', err)
    }
  }

  const openOrderDetail = (order) => {
    setSelectedOrder(order)
    setComprehensiveSummary('')
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
      setComprehensiveSummary('