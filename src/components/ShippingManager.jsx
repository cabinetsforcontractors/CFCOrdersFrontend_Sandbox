/**
 * ShippingManager.jsx v5.9.8
 * WS6: Added Manual shipping override — free-form cost/charge, saves to quote_price + customer_price
 */

import { useState, useEffect } from 'react'
import RLQuoteHelper from './RLQuoteHelper'
import { CustomerAddress } from './CustomerAddress'
import { API_URL } from '../config'
import { apiFetch } from '../api'

const WAREHOUSE_ZIPS = {
  'LI':               '32148',
  'DL':               '32256',
  'ROC':              '30071',
  'GHI':              '34221',
  'Go Bravura':       '77066',
  'Love-Milestone':   '32824',
  'Cabinet & Stone':  '77043',
  'Cabinet & Stone CA': '90723',
  'DuraStone':        '77037',
  'L&C Cabinetry':    '23454',
  'Linda':            '30110',
  'Liberty Industries':     '32148',
  'Cabinetry Distribution': '32148',
  'DL Cabinetry':           '32256',
  'ROC Cabinetry':          '30071',
  'GHI Cabinets':           '34221',
  'Dealer Cabinetry':       '30110',
}

const resolveWeight = (shipment, customerInfo) => {
  if (shipment?.weight && parseFloat(shipment.weight) > 0) return String(parseFloat(shipment.weight))
  if (shipment?.weight_lbs && parseFloat(shipment.weight_lbs) > 0) return String(parseFloat(shipment.weight_lbs))
  if (customerInfo?.orderWeight && parseFloat(customerInfo.orderWeight) > 0) return String(parseFloat(customerInfo.orderWeight))
  return ''
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
    if (m === 'Manual') return 'manual'
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

  // Manual override
  const [manualCost, setManualCost] = useState(shipment?.quote_price || '')
  const [manualCharge, setManualCharge] = useState(shipment?.customer_price || '')
  const [manualNote, setManualNote] = useState('')

  // Shippo
  const [shippoWeight, setShippoWeight] = useState(() => resolveWeight(shipment, customerInfo))
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
    else if (newMethod === 'Manual') setView('manual')
    else setView('select')
  }

  const handleSave = () => { if (onUpdate) onUpdate(); onClose() }

  const handleGetShippoRates = async () => {
    const originZip = WAREHOUSE_ZIPS[shipment?.warehouse] || ''
    const destZip = customerInfo?.zip || ''
    if (!originZip || !destZip) { setShippoError(`Missing ZIP — origin warehouse "${shipment?.warehouse}" not in ZIP map, dest: ${destZip || 'unknown'}`); return }
    if (!shippoWeight || parseFloat(shippoWeight) <= 0) { setShippoError('Enter a weight to get rates'); return }
    setShippoLoading(true); setShippoError(null); setShippoRates(null); setSelectedRate(null)
    try {
      const res = await apiFetch(`${API_URL}/shippo/rates?origin_zip=${originZip}&dest_zip=${destZip}&weight_lbs=${shippoWeight}&is_residential=true`)
      const data = await res.json()
      if (data.success && data.rates?.length > 0) { setShippoRates(data); setSelectedRate(data.cheapest) }
      else setShippoError(data.error || 'No rates returned from Shippo')
    } catch (err) { setShippoError('Failed to get Shippo rates: ' + err.message) }
    setShippoLoading(false)
  }

  const handleSaveShippoRate = async () => {
    if (!selectedRate) return
    try {
      const cost = selectedRate.amount
      const params = new URLSearchParams()
      params.append('quote_price', cost)
      params.append('customer_price', cost)
      if (shippoWeight) params.append('weight', shippoWeight)
      await apiFetch(`${API_URL}/shipments/${shipment.shipment_id}?${params.toString()}`, { method: 'PATCH' })
      setShippoSaved(true)
      if (onUpdate) onUpdate()
    } catch (err) { console.error('Failed to save Shippo rate:', err) }
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

  const saveManualPricing = async () => {
    try {
      const params = new URLSearchParams()
      if (manualCost) params.append('quote_price', manualCost)
      if (manualCharge) params.append('customer_price', manualCharge)
      await apiFetch(`${API_URL}/shipments/${shipment.shipment_id}?${params.toString()}`, { method: 'PATCH' })
      if (onUpdate) onUpdate(); onClose()
    } catch (err) { console.error('Failed to save manual pricing:', err) }
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

  const inputStyle = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', marginTop: '4px', background: 'var(--bg-input)', color: 'var(--text)', fontFamily: 'inherit' }
  const labelStyle = { display: 'block', marginBottom: '4px', fontWeight: '600', fontSize: '13px' }
  const inputGroupStyle = { marginBottom: '12px' }

  // ============================================================
  // SELECT VIEW
  // ============================================================
  if (view === 'select') {
    return (
      <div className="shipping-manager">
        <h3 style={{ marginBottom: '4px' }}>Select Shipping Method</h3>
        <p style={{ color: 'var(--text-dim)', fontSize: '13px', marginBottom: '16px' }}>Warehouse: {shipment.warehouse}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
          {[
            { key: 'LTL',        icon: '🚛', label: 'LTL (RL Carriers)',    sub: 'Freight shipping' },
            { key: 'Shippo',     icon: '📦', label: 'Shippo (UPS/USPS)',    sub: 'Small package auto-quote' },
            { key: 'Pirateship', icon: '🏴', label: 'Pirateship',           sub: 'UPS/USPS parcels' },
            { key: 'BoxTruck',   icon: '🚚', label: 'Box Truck',            sub: 'Local delivery' },
            { key: 'Pickup',     icon: '🏪', label: 'Pickup',               sub: 'Customer picks up' },
            { key: 'LiDelivery', icon: '🚐', label: 'Li Delivery',          sub: 'Li handles shipping' },
            { key: 'Manual',     icon: '✏️',  label: 'Manual Override',      sub: 'Enter cost/charge directly' },
          ].map(m => (
            <button key={m.key} onClick={() => handleMethodChange(m.key)}
              style={{ padding: '12px', borderRadius: '8px', border: `2px solid ${method === m.key ? 'var(--accent)' : 'var(--border)'}`, cursor: 'pointer', textAlign: 'left', backgroundColor: method === m.key ? 'var(--accent-glow)' : 'var(--bg-raised)' }}>
              <span style={{ fontSize: '20px' }}>{m.icon}</span>
              <div style={{ fontWeight: '600', fontSize: '13px', marginTop: '4px' }}>{m.label}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{m.sub}</div>
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
    if (loading) return <div style={{ padding: '20px', color: 'var(--text-dim)' }}>Loading RL data...</div>
    if (!rlData) return <div><p>Failed to load RL data</p><button className="btn" onClick={() => setView('select')}>← Back</button></div>
    return (
      <div className="shipping-manager">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button className="btn btn-sm" onClick={() => setView('select')}>← Change Method</button>
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
    const originZip = WAREHOUSE_ZIPS[shipment?.warehouse] || ''
    const destZip = customerInfo?.zip || ''
    return (
      <div className="shipping-manager">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button className="btn btn-sm" onClick={() => setView('select')}>← Change Method</button>
          <span style={{ fontWeight: '600' }}>Shippo (UPS / USPS)</span>
        </div>
        <div style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: '6px', padding: '10px 12px', marginBottom: '16px', fontSize: '13px', display: 'flex', gap: '24px' }}>
          <div><span style={{ color: 'var(--text-dim)' }}>From ZIP: </span><strong>{originZip || '⚠️ unknown'}</strong></div>
          <div><span style={{ color: 'var(--text-dim)' }}>To ZIP: </span><strong>{destZip || '⚠️ unknown'}</strong></div>
          <div style={{ color: 'var(--text-dim)', fontSize: '11px', alignSelf: 'center' }}>Warehouse: {shipment?.warehouse}</div>
        </div>
        <div style={inputGroupStyle}>
          <label style={labelStyle}>Weight (lbs): {shippoWeight && <span style={{ color: 'var(--text-dim)', fontWeight: '400', marginLeft: '6px', fontSize: '11px' }}>pre-filled from order</span>}</label>
          <input type="number" step="0.1" min="0.1" value={shippoWeight} onChange={e => setShippoWeight(e.target.value)} placeholder="e.g. 15" style={inputStyle} />
        </div>
        <button onClick={handleGetShippoRates} disabled={shippoLoading}
          style={{ width: '100%', padding: '10px', marginBottom: '12px', backgroundColor: shippoLoading ? 'var(--border)' : 'var(--accent)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: shippoLoading ? 'not-allowed' : 'pointer' }}>
          {shippoLoading ? '⏳ Getting Rates...' : '⚡ Get Shippo Rates'}
        </button>
        {shippoError && <div style={{ background: '#FFFBEB', border: '1px solid #FCD34D', borderRadius: '6px', padding: '10px', marginBottom: '12px', fontSize: '13px', color: '#92400E' }}>⚠️ {shippoError}</div>}
        {shippoRates && (
          <>
            <div style={{ marginBottom: '8px', fontSize: '12px', color: 'var(--text-dim)' }}>Select a rate:</div>
            {shippoRates.rates.map(rate => (
              <div key={rate.rate_id} onClick={() => setSelectedRate(rate)}
                style={{ padding: '10px 12px', marginBottom: '6px', borderRadius: '6px', cursor: 'pointer', border: `2px solid ${selectedRate?.rate_id === rate.rate_id ? 'var(--accent)' : 'var(--border)'}`, background: selectedRate?.rate_id === rate.rate_id ? 'var(--accent-glow)' : 'var(--bg-raised)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontWeight: '600', fontSize: '13px' }}>{rate.provider} — {rate.service}</div>
                  {rate.estimated_days && <div style={{ fontSize: '11px', color: 'var(--text-dim)' }}>{rate.estimated_days} day{rate.estimated_days !== 1 ? 's' : ''}</div>}
                </div>
                <div style={{ fontWeight: '700', color: 'var(--accent)', fontSize: '15px' }}>${rate.amount.toFixed(2)}</div>
              </div>
            ))}
            {selectedRate && !shippoSaved && (
              <button onClick={handleSaveShippoRate} style={{ width: '100%', padding: '10px', marginTop: '8px', backgroundColor: 'var(--success)', color: 'white', border: 'none', borderRadius: '6px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
                Save — {selectedRate.provider} {selectedRate.service} ${selectedRate.amount.toFixed(2)}
              </button>
            )}
            {shippoSaved && (
              <>
                <div style={{ background: '#ECFDF5', border: '1px solid #86EFAC', borderRadius: '6px', padding: '10px', marginTop: '8px', textAlign: 'center', color: '#166534', fontWeight: '600' }}>
                  ✅ Rate saved — {selectedRate.provider} {selectedRate.service} ${selectedRate.amount.toFixed(2)}
                </div>
                <button onClick={handleSave} style={{ width: '100%', padding: '10px', marginTop: '8px', backgroundColor: 'var(--bg-hover)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '14px', cursor: 'pointer' }}>Done</button>
              </>
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
          <button className="btn btn-sm" onClick={() => setView('select')}>← Change Method</button>
          <span style={{ fontWeight: '600' }}>Pirateship</span>
        </div>
        <CustomerAddress destination={customerInfo} title="Ship To" />
        <div style={{ marginTop: '16px', marginBottom: '16px' }}>
          <button onClick={() => openNewWindow('https://ship.pirateship.com/ship/single')} style={{ backgroundColor: 'var(--accent)', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '6px', cursor: 'pointer', fontWeight: '600', fontSize: '14px' }}>Open Pirateship →</button>
        </div>
        <div style={inputGroupStyle}><label style={labelStyle}>Shipping Cost ($):</label><input type="number" step="0.01" value={psQuotePrice} onChange={(e) => setPsQuotePrice(e.target.value)} placeholder="0.00" disabled={psSaved} style={inputStyle} /></div>
        <div style={inputGroupStyle}><label style={labelStyle}>Quote URL:</label><input type="text" value={psQuoteUrl} onChange={(e) => setPsQuoteUrl(e.target.value)} placeholder="https://ship.pirateship.com/..." disabled={psSaved} style={inputStyle} /></div>
        <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
          {psSaved
            ? (<><button onClick={() => psQuoteUrl && openNewWindow(psQuoteUrl)} className="btn btn-sm btn-primary">Open Quote</button><button onClick={() => setPsSaved(false)} className="btn btn-sm">Change</button><button onClick={handleSave} className="btn btn-sm">Done</button></>)
            : (<><button onClick={savePirateshipQuote} className="btn btn-sm btn-primary">Save Quote</button><button onClick={handleSave} className="btn btn-sm">Done</button></>)}
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
          <button className="btn btn-sm" onClick={() => setView('select')}>← Change Method</button>
          <span style={{ fontWeight: '600' }}>Li Delivery</span>
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: '13px', marginBottom: '16px' }}>Li handles delivery. Enter cost and customer charge.</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={inputGroupStyle}><label style={labelStyle}>Our Cost ($):</label><input type="number" step="0.01" value={liCost} onChange={(e) => setLiCost(e.target.value)} placeholder="200.00" style={inputStyle} /></div>
          <div style={inputGroupStyle}><label style={labelStyle}>Customer Charge ($):</label><input type="number" step="0.01" value={liCharge} onChange={(e) => setLiCharge(e.target.value)} placeholder="250.00" style={inputStyle} /></div>
        </div>
        {liCost && liCharge && <p style={{ color: 'var(--success)', fontWeight: '600', marginTop: '8px' }}>Profit: ${(parseFloat(liCharge || 0) - parseFloat(liCost || 0)).toFixed(2)}</p>}
        <button onClick={saveLiPricing} className="btn btn-primary" style={{ marginTop: '16px' }}>Save Pricing</button>
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
          <button className="btn btn-sm" onClick={() => setView('select')}>← Change Method</button>
          <span style={{ fontWeight: '600' }}>Box Truck</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={inputGroupStyle}><label style={labelStyle}>Our Cost ($):</label><input type="number" step="0.01" value={btCost} onChange={(e) => setBtCost(e.target.value)} placeholder="0.00" style={inputStyle} /></div>
          <div style={inputGroupStyle}><label style={labelStyle}>Customer Charge ($):</label><input type="number" step="0.01" value={btCharge} onChange={(e) => setBtCharge(e.target.value)} placeholder="0.00" style={inputStyle} /></div>
        </div>
        {btCost && btCharge && <p style={{ color: 'var(--success)', fontWeight: '600', marginTop: '8px' }}>Profit: ${(parseFloat(btCharge || 0) - parseFloat(btCost || 0)).toFixed(2)}</p>}
        <button onClick={saveBoxTruckPricing} className="btn btn-primary" style={{ marginTop: '16px' }}>Save Pricing</button>
      </div>
    )
  }

  // ============================================================
  // MANUAL OVERRIDE VIEW
  // ============================================================
  if (view === 'manual') {
    const profit = parseFloat(manualCharge || 0) - parseFloat(manualCost || 0)
    return (
      <div className="shipping-manager">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button className="btn btn-sm" onClick={() => setView('select')}>← Change Method</button>
          <span style={{ fontWeight: '600' }}>Manual Shipping Override</span>
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: '13px', marginBottom: '16px' }}>
          Enter actual cost and what you're charging the customer. Bypasses all auto-quote logic.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Our Cost ($):</label>
            <input type="number" step="0.01" min="0" value={manualCost} onChange={e => setManualCost(e.target.value)} placeholder="0.00" style={inputStyle} autoFocus />
          </div>
          <div style={inputGroupStyle}>
            <label style={labelStyle}>Customer Charge ($):</label>
            <input type="number" step="0.01" min="0" value={manualCharge} onChange={e => setManualCharge(e.target.value)} placeholder="0.00" style={inputStyle} />
          </div>
        </div>
        <div style={inputGroupStyle}>
          <label style={labelStyle}>Note (optional):</label>
          <input type="text" value={manualNote} onChange={e => setManualNote(e.target.value)} placeholder="e.g. Local pickup arranged, flat rate negotiated" style={inputStyle} />
        </div>
        {manualCost && manualCharge && (
          <div style={{ background: profit >= 0 ? '#ECFDF5' : '#FEF2F2', border: `1px solid ${profit >= 0 ? '#86EFAC' : '#FCA5A5'}`, borderRadius: '6px', padding: '10px 12px', marginBottom: '12px', fontSize: '13px', color: profit >= 0 ? '#166534' : '#991B1B', fontWeight: '600' }}>
            Profit: {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
          </div>
        )}
        <button
          onClick={saveManualPricing}
          disabled={!manualCost && !manualCharge}
          className="btn btn-primary"
          style={{ width: '100%', opacity: (!manualCost && !manualCharge) ? 0.5 : 1 }}>
          Save Manual Pricing
        </button>
      </div>
    )
  }

  // ============================================================
  // PICKUP VIEW
  // ============================================================
  if (view === 'tracking') {
    return (
      <div className="shipping-manager">
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <button className="btn btn-sm" onClick={() => setView('select')}>← Change Method</button>
          <span style={{ fontWeight: '600' }}>{method}</span>
        </div>
        {method === 'Pickup' && <p style={{ color: 'var(--text-dim)', marginBottom: '16px', fontSize: '13px' }}>Customer will pick up from warehouse.</p>}
        <button onClick={handleSave} className="btn btn-primary">Done</button>
      </div>
    )
  }

  return null
}

export default ShippingManager
