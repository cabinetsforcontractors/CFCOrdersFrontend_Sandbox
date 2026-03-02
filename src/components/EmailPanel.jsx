/**
 * EmailPanel.jsx
 * Phase 4: Email template picker + send + history view
 * 
 * Usage in OrderCard or detail view:
 *   <EmailPanel orderId="5307" customerEmail="john@example.com" onClose={() => {}} />
 */

import { useState, useEffect } from 'react'
import { API_URL } from '../config'

const EmailPanel = ({ orderId, customerEmail, onClose, onSent }) => {
  const [templates, setTemplates] = useState([])
  const [history, setHistory] = useState([])
  const [selectedTemplate, setSelectedTemplate] = useState('')
  const [toEmail, setToEmail] = useState(customerEmail || '')
  const [sending, setSending] = useState(false)
  const [previewHtml, setPreviewHtml] = useState('')
  const [showPreview, setShowPreview] = useState(false)
  const [activeTab, setActiveTab] = useState('send') // 'send' | 'history'
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(true)

  // Load templates + history on mount
  useEffect(() => {
    loadTemplates()
    loadHistory()
  }, [orderId])

  const loadTemplates = async () => {
    try {
      const res = await fetch(`${API_URL}/email/templates`)
      const data = await res.json()
      if (data.success) {
        setTemplates(data.templates || [])
      }
    } catch (err) {
      console.error('Failed to load templates:', err)
    }
  }

  const loadHistory = async () => {
    try {
      setLoading(true)
      const res = await fetch(`${API_URL}/orders/${orderId}/email-history`)
      const data = await res.json()
      if (data.success) {
        setHistory(data.emails || [])
      }
    } catch (err) {
      console.error('Failed to load email history:', err)
    } finally {
      setLoading(false)
    }
  }

  const handlePreview = async () => {
    if (!selectedTemplate) return
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/preview-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: selectedTemplate,
          to_email: toEmail || 'preview@example.com',
        })
      })
      const data = await res.json()
      if (data.success) {
        setPreviewHtml(data.html)
        setShowPreview(true)
      } else {
        alert('Preview failed: ' + (data.error || 'Unknown error'))
      }
    } catch (err) {
      alert('Preview error: ' + err.message)
    }
  }

  const handleSend = async () => {
    if (!selectedTemplate || !toEmail) {
      alert('Select a template and enter an email address')
      return
    }

    if (!window.confirm(`Send "${templates.find(t => t.id === selectedTemplate)?.name}" email to ${toEmail}?`)) {
      return
    }

    setSending(true)
    setResult(null)
    try {
      const res = await fetch(`${API_URL}/orders/${orderId}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template_id: selectedTemplate,
          to_email: toEmail,
          triggered_by: 'manual',
        })
      })
      const data = await res.json()
      setResult(data)

      if (data.success) {
        loadHistory()
        if (onSent) onSent(data)
      }
    } catch (err) {
      setResult({ success: false, error: err.message })
    } finally {
      setSending(false)
    }
  }

  // Group templates by category
  const manualTemplates = templates.filter(t => t.category === 'manual')
  const lifecycleTemplates = templates.filter(t => t.category === 'lifecycle')

  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { 
      month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' 
    })
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      width: '480px',
      height: '100vh',
      backgroundColor: '#fff',
      boxShadow: '-4px 0 20px rgba(0,0,0,0.15)',
      zIndex: 1000,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        backgroundColor: '#1a365d',
        color: '#fff',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: '16px', fontWeight: 600 }}>Email — Order #{orderId}</div>
          <div style={{ fontSize: '12px', color: '#93c5fd' }}>{toEmail}</div>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', color: '#fff', fontSize: '20px', cursor: 'pointer'
        }}>✕</button>
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderBottom: '2px solid #e2e8f0',
      }}>
        {['send', 'history'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '10px',
              border: 'none',
              borderBottom: activeTab === tab ? '3px solid #2563eb' : '3px solid transparent',
              backgroundColor: activeTab === tab ? '#f0f7ff' : '#fff',
              fontWeight: activeTab === tab ? 600 : 400,
              cursor: 'pointer',
              fontSize: '14px',
              color: activeTab === tab ? '#2563eb' : '#64748b',
            }}
          >
            {tab === 'send' ? '📧 Send Email' : `📋 History (${history.length})`}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'auto', padding: '16px 20px' }}>
        {activeTab === 'send' ? (
          <>
            {/* To Email */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '4px' }}>
                To:
              </label>
              <input
                type="email"
                value={toEmail}
                onChange={(e) => setToEmail(e.target.value)}
                placeholder="customer@email.com"
                style={{
                  width: '100%',
                  padding: '8px 12px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>

            {/* Template Selection */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '13px', color: '#64748b', marginBottom: '8px' }}>
                Template:
              </label>

              {/* Manual Templates */}
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                Standard
              </div>
              {manualTemplates.map(t => (
                <label key={t.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  backgroundColor: selectedTemplate === t.id ? '#eff6ff' : '#fff',
                  border: selectedTemplate === t.id ? '1px solid #93c5fd' : '1px solid #f1f5f9',
                }}>
                  <input
                    type="radio"
                    name="template"
                    value={t.id}
                    checked={selectedTemplate === t.id}
                    onChange={() => setSelectedTemplate(t.id)}
                    style={{ accentColor: '#2563eb' }}
                  />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500 }}>{t.name}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{t.description}</div>
                  </div>
                </label>
              ))}

              {/* Lifecycle Templates */}
              <div style={{ fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '12px', marginBottom: '6px' }}>
                Lifecycle (auto-send, won't reset clock)
              </div>
              {lifecycleTemplates.map(t => (
                <label key={t.id} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 10px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  marginBottom: '4px',
                  backgroundColor: selectedTemplate === t.id ? '#fef2f2' : '#fff',
                  border: selectedTemplate === t.id ? '1px solid #fca5a5' : '1px solid #f1f5f9',
                }}>
                  <input
                    type="radio"
                    name="template"
                    value={t.id}
                    checked={selectedTemplate === t.id}
                    onChange={() => setSelectedTemplate(t.id)}
                    style={{ accentColor: '#dc2626' }}
                  />
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 500, color: '#991b1b' }}>{t.name}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{t.description}</div>
                  </div>
                </label>
              ))}
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
              <button
                onClick={handlePreview}
                disabled={!selectedTemplate}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: '1px solid #e2e8f0',
                  borderRadius: '6px',
                  backgroundColor: '#fff',
                  cursor: selectedTemplate ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  color: selectedTemplate ? '#333' : '#94a3b8',
                }}
              >
                👁 Preview
              </button>
              <button
                onClick={handleSend}
                disabled={!selectedTemplate || !toEmail || sending}
                style={{
                  flex: 1,
                  padding: '10px',
                  border: 'none',
                  borderRadius: '6px',
                  backgroundColor: sending ? '#94a3b8' : '#2563eb',
                  color: '#fff',
                  cursor: selectedTemplate && toEmail && !sending ? 'pointer' : 'not-allowed',
                  fontSize: '14px',
                  fontWeight: 600,
                }}
              >
                {sending ? '⏳ Sending...' : '📤 Send Email'}
              </button>
            </div>

            {/* Result */}
            {result && (
              <div style={{
                padding: '12px',
                borderRadius: '6px',
                backgroundColor: result.success ? '#ecfdf5' : '#fef2f2',
                border: `1px solid ${result.success ? '#86efac' : '#fca5a5'}`,
                marginBottom: '16px',
              }}>
                <div style={{ fontWeight: 600, color: result.success ? '#166534' : '#991b1b' }}>
                  {result.success ? '✅ Email Sent!' : '❌ Send Failed'}
                </div>
                {result.success && (
                  <div style={{ fontSize: '12px', color: '#166534', marginTop: '4px' }}>
                    To: {result.to} — {result.subject}
                    {result.source_tag === 'system_generated' && (
                      <span style={{ color: '#94a3b8' }}> (lifecycle — won't reset clock)</span>
                    )}
                  </div>
                )}
                {result.error && (
                  <div style={{ fontSize: '12px', color: '#991b1b', marginTop: '4px' }}>
                    {result.error}
                  </div>
                )}
              </div>
            )}

            {/* Preview Modal */}
            {showPreview && (
              <div style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                backgroundColor: 'rgba(0,0,0,0.6)',
                zIndex: 2000,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <div style={{
                  width: '680px',
                  maxHeight: '90vh',
                  backgroundColor: '#fff',
                  borderRadius: '12px',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                }}>
                  <div style={{
                    padding: '12px 20px',
                    backgroundColor: '#f8fafc',
                    borderBottom: '1px solid #e2e8f0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <span style={{ fontWeight: 600 }}>Email Preview</span>
                    <button onClick={() => setShowPreview(false)} style={{
                      background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer'
                    }}>✕</button>
                  </div>
                  <div style={{ flex: 1, overflow: 'auto' }}>
                    <iframe
                      srcDoc={previewHtml}
                      style={{ width: '100%', height: '600px', border: 'none' }}
                      title="Email Preview"
                    />
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* History Tab */
          <>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                Loading history...
              </div>
            ) : history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                No emails sent for this order yet.
              </div>
            ) : (
              history.map((entry, i) => {
                const data = entry.event_data || {}
                const isFailed = entry.event_type === 'email_send_failed'
                return (
                  <div key={entry.id || i} style={{
                    padding: '12px',
                    borderRadius: '6px',
                    border: '1px solid #e2e8f0',
                    marginBottom: '8px',
                    backgroundColor: isFailed ? '#fef2f2' : '#fff',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 600, fontSize: '13px' }}>
                        {isFailed ? '❌' : '✅'} {data.template_name || data.template_id || 'Email'}
                      </span>
                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                        {formatDate(entry.created_at)}
                      </span>
                    </div>
                    <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                      To: {data.to_email || '—'}
                    </div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                      {data.subject || ''}
                    </div>
                    {data.is_lifecycle && (
                      <span style={{
                        fontSize: '10px',
                        backgroundColor: '#fef2f2',
                        color: '#991b1b',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        marginTop: '4px',
                        display: 'inline-block',
                      }}>
                        Lifecycle (won't reset clock)
                      </span>
                    )}
                    <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                      Triggered by: {data.triggered_by || entry.source || 'unknown'}
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default EmailPanel
