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
  { value: 'needs_payment_link', label: '