/**
 * CustomerAddress.jsx v5.9.2 - With checkboxes for copying
 */

import { useState } from 'react'

const CopyButton = ({ text, label }) => {
  const [copied, setCopied] = useState(false)
  
  if (!text) return null
  
  const handleCopy = () => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  
  return (
    <div className="copy-row" style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
      <span className="copy-label" style={{ minWidth: '100px', color: '#666', fontSize: '12px' }}>{label}:</span>
      <span className="copy-value" style={{ flex: 1, fontSize: '13px' }}>{text}</span>
      <button 
        className="copy-btn" 
        onClick={handleCopy} 
        title="Copy"
        style={{ 
          backgroundColor: copied ? '#4caf50' : '#e0e0e0', 
          color: copied ? 'white' : '#333',
          border: 'none', 
          padding: '2px 8px', 
          borderRadius: '4px', 
          cursor: 'pointer',
          fontSize: '11px'
        }}
      >
        {copied ? '✓' : '📋'}
      </button>
    </div>
  )
}

const CustomerAddress = ({ destination, title = "Ship To (Customer)" }) => {
  const [selectedFields, setSelectedFields] = useState({
    name: true, street: true, city: true, state: true, zip: true, phone: false, email: false
  })
  const [copied, setCopied] = useState(false)
  
  if (!destination) return null
  
  const fields = [
    { key: 'name', label: 'Name', value: destination.name || destination.company_name || destination.customer_name || '' },
    { key: 'street', label: 'Street', value: destination.street || destination.address || '' },
    { key: 'city', label: 'City', value: destination.city || '' },
    { key: 'state', label: 'State', value: destination.state || '' },
    { key: 'zip', label: 'ZIP', value: destination.zip || destination.postal_code || '' },
    { key: 'phone', label: 'Phone', value: destination.phone || '' },
    { key: 'email', label: 'Email', value: destination.email || '' }
  ]
  
  const copySelected = async () => {
    const selectedValues = fields.filter(f => selectedFields[f.key] && f.value).map(f => f.value).join('\n')
    try {
      await navigator.clipboard.writeText(selectedValues)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch (err) { console.error('Failed to copy:', err) }
  }
  
  const toggleField = (key) => setSelectedFields({ ...selectedFields, [key]: !selectedFields[key] })
  
  return (
    <div className="address-section" style={{ backgroundColor: '#f5f5f5', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ margin: 0 }}>{title}</h4>
        <button onClick={copySelected}
          style={{ backgroundColor: copied ? '#4caf50' : '#2196f3', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>
          {copied ? '✓ Copied!' : 'Copy Selected'}
        </button>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {fields.map(field => field.value && (
          <div key={field.key} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input type="checkbox" checked={selectedFields[field.key]} onChange={() => toggleField(field.key)} style={{ cursor: 'pointer' }} />
            <span style={{ minWidth: '50px', color: '#666', fontSize: '12px' }}>{field.label}:</span>
            <span style={{ flex: 1, fontSize: '13px' }}>{field.value}</span>
            <button onClick={() => { navigator.clipboard.writeText(field.value) }}
              style={{ backgroundColor: '#e0e0e0', color: '#333', border: 'none', padding: '2px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '11px' }}>
              Copy
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

const BillToAddress = () => {
  const billTo = {
    company: 'Cabinets For Contactors-Cust Number C00VP1',
    street: '185 Stevenson Point',
    city: 'DALLAS',
    state: 'GA',
    zip: '30132',
    email: 'cabinetsforcontractors@gmail.com',
    phone: '(770) 990-4885'
  }
  
  return (
    <div className="address-section bill-to" style={{ backgroundColor: '#e3f2fd', borderRadius: '8px', padding: '12px', marginBottom: '12px' }}>
      <h4 style={{ margin: '0 0 12px 0', color: '#111' }}>Bill To (Section 3 - Always Same)</h4>
      <CopyButton label="Company" text={billTo.company} />
      <CopyButton label="Street" text={billTo.street} />
      <CopyButton label="City" text={billTo.city} />
      <CopyButton label="State" text={billTo.state} />
      <CopyButton label="ZIP" text={billTo.zip} />
      <CopyButton label="Email" text={billTo.email} />
      <CopyButton label="Phone" text={billTo.phone} />
    </div>
  )
}

export { CustomerAddress, BillToAddress, CopyButton }
export default CustomerAddress
