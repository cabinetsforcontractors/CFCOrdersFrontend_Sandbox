/**
 * ShippingManager.jsx v5.9.5
 * WS6: Added Shippo as shipping method — auto-quotes UPS/USPS rates
 * Phase 5C: all fetch() replaced with apiFetch() for X-Admin-Token injection
 */

import { useState, useEffect } from 'react'
import RLQuoteHelper from './RLQuoteHelper'
import { CustomerAddress } from './CustomerAddress'
import { API_URL } from '../config'
import { apiFetch } from '../api'

// Warehouse ZIP codes (mirrors checkout.py WAREHOUSES)
const WAREHOUSE_ZIPS = {
  'Liberty Industries':     '32148',
  'Cabinetry Distribution': '32148',
  'DL Cabinetry':           '32256',
  'ROC Cabinetry':          '30071',
  'GHI Cabinets':           '34221',
  'Go Bravura':             '77066',
  'Love-Milestone':         '32824',
  'Artisan (fallback)':     '77066',
  'Cabinet & Stone':        '77043',
  'Cabinet & Stone CA':     '90723',
  'DuraStone':              '77037',
  'L&C Cabinetry':          '23454',
  'Dealer Cabinetry':       '30110',
}

const ShippingManager = ({ shipment, orderId, customerInfo, onClose, onUpdate }) => {
  const [method, setMethod] = useState(shipment?.ship_method || '')
  const [rlData, setRlData] = useState(null)
  const [loading, setLoading] = useState(false)

  const getInitialView = () => {
    const m = shipment?.ship_method
    if (!m) return 'select'
    if (m === 'LTL') return 'rl'
    if (m === 'Shippo') return 'shippo'
    if (m === 'Pirateship') return 'pirateship'
    if (m === 'LiDelivery') return 'lidelivery'
    if (m === 'BoxTruck') return 'boxtruck'
    if (m === 'Pickup') return 'tracking'
    return 'select'
  }

  const [view, setView] = useState(getInitialView())

  // Pirateship
  const [psQuoteUrl, setPsQuoteUrl] = useState(shipment?.ps_quote_url || '')
  const [psQuotePrice, setPsQuotePrice] = useState(shipment?.ps_quote_price || '')
  const [psSaved, setPsSaved] = useState(!!shipment?.ps_quote_url || !!shipment?.ps_quote_price)

  // Li Delivery
  const [liCost, setLiCost] = useState(shipment?.li_quote_price || '')
  const [liCharge, setLiCharge] = useState(shipment?.li_customer_price || '')

  // Box Truck
  const [btCost, setBtCost] = useState(shipment?.quote_price || '')
  const [btCharge, setBtCharge] = useState(shipment?.customer_price || '')

  // Shippo
  const [shippoWeight, setShippoWeight] = useState(shipment?.weight_lbs || '')
  const [shippoRates, setShippoRates] = useState(null)
  const [shippoLoading, setShippoLoading] = useState(false)
  const [shippoError, setShippoError] = useState(null)
  const [shippoSaved, setShippoSaved] = useState(false)
  const [selectedRate, setSelectedRate] = useState(null)

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
    else if (newMethod === 'Shippo') setView('shippo')
    else if (newMethod === 'Pirateship') setView('pirateship')
    else if (newMethod === 'LiDelivery') setView('lidelivery')
    else if (newMethod === 'BoxTruck') setView('boxtruck')
    else if (newMethod === 'Pickup') setView('tracking')
    else setView('select')
  }

  const handleSave = () => { if (onUpdate) onUpdate(); onClose() }

  // Shippo: get rates
  const handleGetShippoRates = async () => {
    const originZip = WAREHOUSE_ZIPS[shipment?.warehouse] || ''
    const destZip = customerInfo?.zip || ''

    if (!originZip || !destZip) {
      setShippoError(`Missing ZIP — origin: ${originZip || 'unknown'}, dest: ${destZip || 'unknown'}`)
      return
    }
    if (!shippoWeight || parseFloat(shippoWeight) <= 0) {
      setShippoError('Enter a weight to get rates')
      return
    }

    setShippoLoading(true)
    setShippoError(null)
    setShippoRates(null)
    setSelectedRate(null)

    try {
      const res = await apiFetch(
        `${API_URL}/shippo/rates?origin_zip=${originZip}&dest_zip=${destZip}&weight_lbs=${shippoWeight}&is_residential=true`
      )
      const data = await res.json()
      if (data.success && data.rates?.length > 0) {
        setShippoRates(data)
        setSelectedRate(data.cheapest)
      } else {
        setShippoError(data.error || 'No rates returned from Shippo')
      }
    } catch (err) {
      setShippoError('Failed to get Shippo rates: ' + err.message)
    }
    setShippoLoading(false)
  }

  // Shippo: save selected rate
  const handleSaveShippoRate = async () => {
    if (!selectedRate) return
    try {
      const cost = selectedRate.amount
      const params = new URLSearchParams()
      params.append('quote_price', cost)
      params.append('customer_price', cost)  // pass-through — no markup on Shippo
      await apiFetch(`${API_URL}/shipments/${shipment.shipment_id}?${params.toString()}`, { method: 'PATCH' })
      setShippoSaved(true)
      if (onUpdate) onUpdate()
    } catch (err) {
      console.error('Failed to save Shippo rate:', err)
    }
  }

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

  // ============================================================
  // SELECT VIEW
  // ============================================================
  if (view === 'select') {
    return (
      <div className="shipping-manager">
        <h3>Select Shipping Method</h3>
        <p className="subtitle">Warehouse: {shipment.warehouse}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginTop: '16px' }}>
          {[
            { key: 'LTL',        icon: '🚛', label: 'LTL (RL Carriers)',   sub: 'Freight shipping' },
            { key: 'Shippo',     icon: '📦', label: 'Shippo (UPS/USPS)',   sub: 'Small package auto-quote' },
            { key: 'Pirateship', icon: '🏴', label: 'Pirateship',          sub: 'UPS/USPS parcels' },
            { key: 'BoxTruck',   icon: '🚚', label: 'Box Truck',           sub: 'Local delivery' },
            { key: 'Pickup',     icon: '🏪', label: 'Pickup',              sub: 'Customer picks up' },
            { key: 'LiDelivery', icon: '🚐', label: 'Li Delivery',         sub: 'Li handles shipping' },
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

  // ============================================================
  // LTL VIEW
  // ============================================================
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

  // ============================================================
  // SHIPPO VIEW
  // ============================================================
  if (view === 'shippo') {
    const originZip = WAREHOUSE_ZIPS[shipment?.warehouse] || '?'
    const destZip = customerInfo?.zip || '?'

    return (
      <div className="shipping-manager">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button className="btn btn-back" onClick={() => setView('select')} style={{ padding: '6px 12px' }}>← Change Method</button>
          <span style={{ fontWeight: '600' }}>Shippo (UPS / USPS)</span>
        </div>

        {/* ZIP + weight info */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', padding: '12px', marginBottom: '16px', fontSize: '13px' }}>
          <div style={{ display: 'flex', gap: '24px' }}>
            <div><span style={{ color: '#718096' }}>From ZIP: </span><strong>{originZip}</strong></div>
            <div><span style={{ color: '#718096' }}>To ZIP: </span><strong>{destZip}</strong></div>
          </div>
        </div>

        <div style={inputGroupStyle}>
          <label style={labelStyle}>Weight (lbs):</label>
          <input
            type="number"
            step="0.1"
            min="0.1"
            value={shippoWeight}
            onChange={e => setShippoWeight(e.target.value)}
            placeholder="e.g. 15"
            style={inputStyle}
          />
        </div>

        <button
          onClick={handleGetShippoRates}
          disabled={shippoLoading}
          style={{
            width: '100%', padding: '10px', marginBottom: '12px',
            backgroundColor: shippoLoading ? '#ccc' : '#2563eb',
            color: 'white', border: 'none', borderRadius: '6px',
            fontSize: '14px', fontWeight: '600', cursor: shippoLoading ? 'not-allowed' : 'pointer'
          }}
        >
          {shippoLoading ? '⏳ Getting Rates...' : '⚡ Get Shippo Rates'}
        </button>

        {shippoError && (
          <div style={{ background: '#fff3cd', border: '1px solid #ffc107', borderRadius: '6px', padding: '10px', marginBottom: '12px', fontSize: '13px', color: '#856404' }}>
            ⚠️ {shippoError}
          </div>
        )}

        {shippoRates && (
          <>
            <div style={{ marginBottom: '8px', fontSize: '12px', color: '#718096' }}>
              Select a rate:
            </div>
            {shippoRates.rates.map(rate => (
              <div
                key={rate.rate_id}
                onClick={() => setSelectedRate(rate)}
                style={{
                  padding: '10px 12px', marginBottom: '6px', borderRadius: '6px', cursor: 'pointer',
                  border: `2px solid ${selectedRate?.rate_id === rate.rate_id ? '#2563eb' : '#e2e8f0'}`,
                  background: selectedRate?.rate_id === rate.rate_id ? '#eff6ff' : '#fff',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div>
                  <div style={{ fontWeight: '600', fontSize: '13px' }}>{rate.provider} — {rate.service}</div>
                  {rate.estimated_days && (
                    <div style={{ fontSize: '11px', color: '#718096' }}>{rate.estimated_days} day{rate.estimated_days !== 1 ? 's' : ''}</div>
                  )}
                </div>
                <div style={{ fontWeight: '700', color: '#1a365d', fontSize: '15px' }}>
                  ${rate.amount.toFixed(2)}
                </div>
              </div>
            ))}

            {selectedRate && !shippoSaved && (
              <button
                onClick={handleSaveShippoRate}
                style={{
                  width: '100%', padding: '10px', marginTop: '8px',
                  backgroundColor: '#10b981', color: 'white', border: 'none',
                  borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer'
                }}
              >
                Save — {selectedRate.provider} {selectedRate.service} ${selectedRate.amount.toFixed(2)}
              </button>
            )}

            {shippoSaved && (
              <div style={{ background: '#ecfdf5', border: '1px solid #86efac', borderRadius: '6px', padding: '10px', marginTop: '8px', textAlign: 'center', color: '#166534', fontWeight: '600' }}>
                ✅ Rate saved — {selectedRate.provider} {selectedRate.service} ${selectedRate.amount.toFixed(2)}
              </div>
            )}

            {shippoSaved && (
              <button onClick={handleSave} style={{ width: '100%', padding: '10px', marginTop: '8px', backgroundColor: '#9e9e9e', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}>
                Done
              </button>
            )}
          </>
        )}
      </div>
    )
  }

  // ============================================================
  // PIRATESHIP VIEW
  // ============================================================
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
          {psSaved
            ? (<><button onClick={() => psQuoteUrl && openNewWindow(psQuoteUrl)} style={{ backgroundColor: '#4caf50', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Open Quote</button><button onClick={() => setPsSaved(false)} style={{ backgroundColor: '#9e9e9e', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Change</button><button onClick={handleSave} style={{ backgroundColor: '#9e9e9e', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Done</button></>)
            : (<><button onClick={savePirateshipQuote} style={{ backgroundColor: '#4caf50', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Save Quote</button><button onClick={handleSave} style={{ backgroundColor: '#9e9e9e', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>Done</button></>)}
        </div>
      </div>
    )
  }

  // ============================================================
  // LI DELIVERY VIEW
  // ============================================================
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

  // ============================================================
  // BOX TRUCK VIEW
  // ============================================================
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

  // ============================================================
  // PICKUP / TRACKING VIEW
  // ============================================================
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
