/**
 * ShippingManager.jsx v5.9.4
 * Phase 5C: replaced all fetch() with apiFetch() for X-Admin-Token injection
 * Fix: removed onUpdate() from handleMethodChange to prevent modal blink
 */

import { useState, useEffect } from 'react'
import RLQuoteHelper from './RLQuoteHelper'
import { CustomerAddress } from './CustomerAddress'
import { API_URL } from '../config'
import { apiFetch } from '../api'

const ShippingManager = ({ shipment, orderId, customerInfo, onClose, onUpdate }) => {
  const [method, setMethod] = useState(shipment?.ship_method || '')
  const [rlData, setRlData] = useState(null)
  const [loading, setLoading] = useState(false)
  
  const getInitialView = () => {
    const m = shipment?.ship_method
    if (!m) return 'select'
    if (m === 'LTL') return 'rl'
    if (m === 'Pirateship') return 'pirateship'
    if (m === 'LiDelivery') return 'lidelivery'
    if (m === 'BoxTruck') return 'boxtruck'
    if (m === 'Pickup') return 'tracking'
    return 'select'
  }
  
  const [view, setView] = useState(getInitialView())
  const [liCost, setLiCost] = useState(shipment?.li_quote_price || '')
  const [liCharge, setLiCharge] = useState(shipment?.li_customer_price || '')
  const [btCost, setBtCost] = useState(shipment?.quote_price || '')
  const [btCharge, setBtCharge] = useState(shipment?.customer_price || '')
  const [psQuoteUrl, setPsQuoteUrl] = useState(shipment?.ps_quote_url || '')
  const [psQuotePrice, setPsQuotePrice] = useState(shipment?.ps_quote_price || '')
  const [psSaved, setPsSaved] = useState(!!shipment?.ps_quote_url || !!shipment?.ps_quote_price)
  
  useEffect(() => { if (method === 'LTL' && view === 'rl') loadRLData() }, [method, view])
  useEffect(() => { if (shipment?.ship_method === 'LTL') { setMethod('LTL'); loadRLData() } }, [shipment])
  
  const loadRLData = async () => {
    setLoading(true)
    try {
      const res = await apiFetch(`${API_URL}/shipments/${shipment.shipment_id}/rl-quote-data`)
      const data = await res.json()
      if (data.status === 'ok') setRlData(data)
    } catch (err) { console.error('Failed to load RL data:', err) }
    setLoading(false)
  }
  
  const handleMethodChange = async (newMethod) => {
    setMethod(newMethod)
    try { await apiFetch(`${API_URL}/shipments/${shipment.shipment_id}?ship_method=${newMethod}`, { method: 'PATCH' }) }
    catch (err) { console.error('Failed to update shipping method:', err) }
    if (newMethod === 'LTL') setView('rl')
    else if (newMethod === 'Pirateship') setView('pirateship')
    else if (newMethod === 'LiDelivery') setView('lidelivery')
    else if (newMethod === 'BoxTruck') setView('boxtruck')
    else if (newMethod === 'Pickup') setView('tracking')
    else setView('select')
  }
  
  const handleSave = () => { if (onUpdate) onUpdate(); onClose() }
  
  const saveLiPricing = async () => {
    try {
      const params = new URLSearchParams()
      if (liCost) params.append('li_quote_price', liCost)
      if (liCharge) params.append('li_customer_price', liCharge)
      await apiFetch(`${API_URL}/shipments/${shipment.shipment_id}?${params.toString()}`, { method: 'PATCH' })
      if (onUpdate) onUpdate(); onClose()
    } catch (err) { console.error('Failed to save Li pricing:', err) }
  }
  
  const saveBoxTruckPricing = async () => {
    try {
      const params = new URLSearchParams()
      if (btCost) params.append('quote_price', btCost)
      if (btCharge) params.append('customer_price', btCharge)
      await apiFetch(`${API_URL}/shipments/${shipment.shipment_id}?${params.toString()}`, { method: 'PATCH' })
      if (onUpdate) onUpdate(); onClose()
    } catch (err) { console.error('Failed to save Box Truck pricing:', err) }
  }

  const savePirateshipQuote = async () => {
    try {
      const params = new URLSearchParams()
      if (psQuoteUrl) params.append('ps_quote_url', psQuoteUrl)
      if (psQuotePrice) params.append('ps_quote_price', psQuotePrice)
      await apiFetch(`${API_URL}/shipments/${shipment.shipment_id}?${params.toString()}`, { method: 'PATCH' })
      setPsSaved(true)
    } catch (err) { console.error('Failed to save Pirateship quote:', err) }
  }

  const openNewWindow = (url) => {
    const w = 800, h = window.screen.height, left = window.screen.width - w
    window.open(url, 'ShippingQuote', `width=${w},height=${h},left=${left},top=0,resizable=yes,scrollbars=yes`)
  }

  const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '14px', marginTop: '4px' }
  const labelStyle = { display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px' }
  const inputGroupStyle = { marginBottom: '12px' }
  
  if (view === 'select') {
    return (
      <div className="shipping-manager">
        <h3>Select Shipping Method</h3>
        <p className="subtitle">Warehouse: {shipment.warehouse}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '16px' }}>
          {[
            { key: 'LTL', icon: '🚛', label: 'LTL (RL Carriers)', sub: 'Freight shipping' },
            { key: 'Pirateship', icon: '📦', label: 'Pirateship', sub: 'UPS/USPS parcels' },
            { key: 'BoxTruck', icon: '🚚', label: 'Box Truck', sub: 'Local delivery' },
            { key: 'Pickup', icon: '🏪', label: 'Pickup', sub: 'Customer picks up' },
            { key: 'LiDelivery', icon: '🚐', label: 'Li Delivery', sub: 'Li handles shipping' }
          ].map(m => (
            <button key={m.key} onClick={() => handleMethodChange(m.key)}
              style={{ padding: '12px', borderRadius: '8px', border: `2px solid ${method === m.key ? '#2196f3' : '#ccc'}`, cursor: 'pointer', textAlign: 'left', backgroundColor: method === m.key ? '#e3f2fd' : 'white' }}>
              <span style={{ fontSize: '20px' }}>{m.icon}</span>
              <div style={{ fontWeight: '600' }}>{m.label}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{m.sub}</div>
            </button>
          ))}
        </div>
      </div>
    )
  }
  
  if (view === 'rl') {
    if (loading) return <div className="shipping-manager loading">Loading RL data...</div>
    if (!rlData) return <div className="shipping-manager error"><p>Failed to load RL data</p><button className="btn" onClick={() => setView('select')}>← Back</button></div>
    return (
      <div className="shipping-manager">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button className="btn btn-back" onClick={() => setView('select')} style={{ padding: '6px 12px' }}>← Change Method</button>
          <span style={{ fontWeight: '600' }}>LTL (RL Carriers)</span>
        </div>
        <RLQuoteHelper shipmentId={shipment.shipment_id} data={rlData} onClose={onClose} onSave={handleSave} onOpenRL={() => openNewWindow('https://www.rlcarriers.com/freight/shipping/rate-quote')} />
      </div>
    )
  }
  
  if (view === 'pirateship') {
    return (
      <div className="shipping-manager">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button className="btn btn-back" onClick={() => setView('select')} style={{ padding: '6px 12px' }}>← Change Method</button>
          <span style={{ fontWeight: '600' }}>Pirateship</span>
        </div>
        <h3 style={{ marginBottom: '12px' }}>Pirateship - Copy Address</h3>
        <CustomerAddress destination={customerInfo} title="Ship To" />
        <div style={{ marginTop: '16px', marginBottom: '16px' }}>
          <button onClick={() => openNewWindow('https://ship.pirateship.com/ship/single')} style={{ backgroundColor: '#2196f3', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>Open Pirateship →</button>
        </div>
        <div style={inputGroupStyle}><label style={labelStyle}>Shipping Cost ($):</label><input type="number" step="0.01" value={psQuotePrice} onChange={(e) => setPsQuotePrice(e.target.value)} placeholder="0.00" disabled={psSaved} style={inputStyle} /></div>
        <div style={inputGroupStyle}><label style={labelStyle}>Quote URL:</label><input type="text" value={psQuoteUrl} onChange={(e) => setPsQuoteUrl(e.target.value)} placeholder="https://ship.pirateship.com/..." disabled={psSaved} style={inputStyle} /></div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          {psSaved ? (<><button onClick={() => psQuoteUrl && openNewWindow(psQuoteUrl)} style={{ backgroundColor: '#4caf50', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Open Quote</button><button onClick={() => setPsSaved(false)} style={{ backgroundColor: '#9e9e9e', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Change</button><button onClick={handleSave} style={{ backgroundColor: '#9e9e9e', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Done</button></>)
            : (<><button onClick={savePirateshipQuote} style={{ backgroundColor: '#4caf50', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Save Quote</button><button onClick={handleSave} style={{ backgroundColor: '#9e9e9e', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Done</button></>)}
        </div>
      </div>
    )
  }

  if (view === 'lidelivery') {
    return (
      <div className="shipping-manager">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button className="btn btn-back" onClick={() => setView('select')} style={{ padding: '6px 12px' }}>← Change Method</button>
          <span style={{ fontWeight: '600' }}>Li Delivery</span>
        </div>
        <h3 style={{ marginBottom: '8px' }}>Li Delivery Pricing</h3>
        <p style={{ color: '#666', fontSize: '13px', marginBottom: '16px' }}>Li handles delivery. Enter cost and customer charge.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={inputGroupStyle}><label style={labelStyle}>Our Cost ($):</label><input type="number" step="0.01" value={liCost} onChange={(e) => setLiCost(e.target.value)} placeholder="200.00" style={inputStyle} /></div>
          <div style={inputGroupStyle}><label style={labelStyle}>Customer Charge ($):</label><input type="number" step="0.01" value={liCharge} onChange={(e) => setLiCharge(e.target.value)} placeholder="250.00" style={inputStyle} /></div>
        </div>
        {liCost && liCharge && <p style={{ color: '#2e7d32', fontWeight: '600', marginTop: '8px' }}>Profit: ${(parseFloat(liCharge || 0) - parseFloat(liCost || 0)).toFixed(2)}</p>}
        <button onClick={saveLiPricing} style={{ backgroundColor: '#4caf50', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', marginTop: '16px', fontWeight: '600' }}>Save Pricing</button>
      </div>
    )
  }
  
  if (view === 'boxtruck') {
    return (
      <div className="shipping-manager">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button className="btn btn-back" onClick={() => setView('select')} style={{ padding: '6px 12px' }}>← Change Method</button>
          <span style={{ fontWeight: '600' }}>Box Truck</span>
        </div>
        <h3 style={{ marginBottom: '8px' }}>Box Truck Pricing</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={inputGroupStyle}><label style={labelStyle}>Our Cost ($):</label><input type="number" step="0.01" value={btCost} onChange={(e) => setBtCost(e.target.value)} placeholder="0.00" style={inputStyle} /></div>
          <div style={inputGroupStyle}><label style={labelStyle}>Customer Charge ($):</label><input type="number" step="0.01" value={btCharge} onChange={(e) => setBtCharge(e.target.value)} placeholder="0.00" style={inputStyle} /></div>
        </div>
        {btCost && btCharge && <p style={{ color: '#2e7d32', fontWeight: '600', marginTop: '8px' }}>Profit: ${(parseFloat(btCharge || 0) - parseFloat(btCost || 0)).toFixed(2)}</p>}
        <button onClick={saveBoxTruckPricing} style={{ backgroundColor: '#4caf50', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', marginTop: '16px', fontWeight: '600' }}>Save Pricing</button>
      </div>
    )
  }
  
  if (view === 'tracking') {
    return (
      <div className="shipping-manager">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button className="btn btn-back" onClick={() => setView('select')} style={{ padding: '6px 12px' }}>← Change Method</button>
          <span style={{ fontWeight: '600' }}>{method}</span>
        </div>
        {method === 'Pickup' && <p style={{ color: '#666', marginBottom: '16px' }}>Customer will pick up from warehouse.</p>}
        <button onClick={handleSave} style={{ backgroundColor: '#4caf50', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600' }}>Done</button>
      </div>
    )
  }
  
  return null
}

export default ShippingManager
